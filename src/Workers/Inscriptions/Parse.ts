import { db } from "../../Database";
import { Inscription } from "../../Database/Inscriptions";
import { ord } from "../../Services/Ord";
import { getMetaFromTxId, isOIP2Meta, validateOIP2Meta } from "../../Utilities/Oip";
import { parseLocation } from "../../Utilities/Transaction";
import { log, perf } from "../Log";

export async function parse(blockHeight: number) {
  const inscriptionHeight = await getNextInscriptionHeight();
  if (inscriptionHeight === 0) {
    return;
  }

  if (inscriptionHeight > blockHeight) {
    return log("\n   💤 Indexer has latest inscriptions");
  }

  const ts = perf();
  log("\n   🕛 Waiting for block availability");
  await ord.waitForInscriptions(blockHeight);
  log(`\n     👌 Block available [${ts.now} seconds]`);

  let inscriptions: Inscription[] = [];

  let height = inscriptionHeight;
  while (height <= blockHeight) {
    let ts = perf();
    log(`\n   📦 resolving inscriptions from block ${height}`);
    const list = await ord.getBlockInscriptions(height);
    log(` [${ts.now} seconds]`);
    for (const data of list) {
      const [current] = parseLocation(data.output);
      const [media, format] = data.media.kind.split(";");
      const [type, subtype] = media.split("/");
      const [txid] = parseLocation(data.output);

      const inscription: Partial<Inscription> = {
        id: data.id,
        owner: data.address,
        sat: data.sat,
        mimeType: type,
        mimeSubtype: subtype,
        mediaType: media,
        mediaCharset: format?.split("=")[1],
        mediaSize: data.media.size,
        mediaContent: data.media.content,
        timestamp: data.timestamp,
        height: data.height,
        fee: data.fee,
        genesis: data.genesis,
        number: data.number,
        outpoint: data.output,
      };

      if (txid === data.genesis) {
        inscription.creator = data.address;
      }

      if (inscription.genesis === current) {
        const meta = await getMetaFromTxId(inscription.genesis);
        if (meta) {
          inscription.meta = meta;
          if (isOIP2Meta(meta)) {
            inscription.verified = await validateOIP2Meta(meta);
          }
        }
      }

      inscriptions.push(inscription as Inscription);
    }
    ts = perf();
    log(`\n     📬 inserting ${inscriptions.length}`);
    await db.inscriptions.insertMany(inscriptions);
    log(`\n     📭 inserted ${inscriptions.length} inscriptions from block ${height} [${ts.now} seconds]`);
    inscriptions = [];
    height += 1;
  }
}

async function getNextInscriptionHeight(): Promise<number> {
  const inscription = await db.inscriptions.findOne({}, { sort: { height: -1 } });
  if (inscription === undefined) {
    return 0;
  }
  return inscription.height + 1;
}
