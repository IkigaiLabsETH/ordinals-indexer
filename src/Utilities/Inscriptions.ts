import { script } from "bitcoinjs-lib";

import { isCoinbase, RawTransaction } from "../Services/Bitcoin";
import { getMetaFromWitness } from "./Oip";
import { Inscription } from "./PSBT";
import { parseLocation } from "./Transaction";

const ORD_WITNESS = "6f7264";

const OP_FALSE = 0;
const OP_IF = 99;
const OP_PUSH_1 = 81;
const OP_PUSH_0 = 0;
const OP_ENDIF = 104;

export function getIdFromOutpoint(outpoint: string) {
  return outpoint.replace(":", "i");
}

export function getLocationFromId(id: string) {
  return parseLocation(getOutpointFromId(id));
}

export function getOutpointFromId(id: string) {
  const outpoint = id.split("");
  outpoint[id.length - 2] = ":";
  return outpoint.join("");
}

export function getInscriptionContent(tx: RawTransaction) {
  for (const vin of tx.vin) {
    if (isCoinbase(vin)) {
      continue;
    }
    if (vin.txinwitness) {
      const media = getInscriptionFromWitness(vin.txinwitness);
      if (media) {
        const meta = getMetaFromWitness(vin.txinwitness);
        if (meta) {
          return { media, meta };
        }
        return { media };
      }
    }
  }
  return undefined;
}

export function getInscriptionFromWitness(txinwitness: string[]) {
  for (const witness of txinwitness) {
    if (witness.includes(ORD_WITNESS)) {
      const data = script.decompile(Buffer.from(witness, "hex"));
      if (!data) {
        continue;
      }

      const envelope = getInscriptionEnvelope(data);
      if (envelope === undefined) {
        continue; // failed to identify inscription envelope
      }

      return { type: envelope.type, content: envelope.content };
    }
  }
}

function getInscriptionEnvelope(data: (number | Buffer)[]) {
  let startIndex = -1;
  let endIndex = -1;

  let index = 0;
  for (const op of data) {
    const started = startIndex !== -1;
    if (started === false && op === OP_FALSE) {
      startIndex = index;
      continue;
    }
    if (op === OP_ENDIF) {
      if (started === false) {
        return undefined;
      }
      endIndex = index;
      break;
    }
    index += 1;
  }

  const envelope = data.slice(startIndex, endIndex + 1);

  const protocol = getInscriptionEnvelopeProtocol(envelope);
  if (protocol !== "ord") {
    return undefined;
  }

  const type = getInscriptionEnvelopeType(envelope);
  if (type === undefined) {
    return undefined;
  }

  const content = getInscriptionEnvelopeContent(envelope);
  if (content === undefined) {
    return undefined;
  }

  return { protocol, type, content };
}

function getInscriptionEnvelopeProtocol(envelope: (number | Buffer)[]) {
  if (envelope.shift() !== OP_FALSE) {
    return undefined;
  }
  if (envelope.shift() !== OP_IF) {
    return undefined;
  }
  const protocol = envelope.shift();
  if (!protocol || !isBuffer(protocol)) {
    return undefined;
  }
  return protocol.toString("utf-8");
}

function getInscriptionEnvelopeType(envelope: (number | Buffer)[]) {
  if (hasOpCode(envelope, OP_PUSH_1) === false) {
    return undefined;
  }
  const type = envelope.shift();
  if (!type || !isBuffer(type)) {
    return undefined;
  }
  return type.toString("utf-8");
}

function getInscriptionEnvelopeContent(envelope: (number | Buffer)[]) {
  const push = envelope.shift();
  if (push !== OP_PUSH_0) {
    return undefined;
  }
  const content: Buffer[] = [];
  for (const op of envelope) {
    if (!isBuffer(op)) {
      return undefined;
    }
    content.push(op);
  }
  return Buffer.concat(content);
}

function hasOpCode(envelope: (number | Buffer)[], opcode: number) {
  let push = envelope.shift();
  while (push !== opcode) {
    push = envelope.shift();
    if (push === undefined) {
      return false;
    }
  }
  return true;
}

function isBuffer(value: unknown): value is Buffer {
  return Buffer.isBuffer(value)
}
export function transformInscriptions(inscriptions: Inscription[] | undefined) {
  if (!inscriptions) return [];

  return inscriptions.map((inscription) => {
    inscription.meta = inscription.meta ? decodeObject(inscription.meta) : inscription.meta;
    return inscription;
  });
}

export function decodeObject(obj: NestedObject) {
  return encodeDecodeObject(obj, { encode: false });
}

function encodeDecodeObject(obj: NestedObject, { encode, depth = 0 }: EncodeDecodeObjectOptions) {
  const maxDepth = 5;

  if (depth > maxDepth) {
    throw new Error("Object too deep");
  }

  for (const key in obj) {
    // eslint-disable-next-line
    if (!obj.hasOwnProperty(key)) continue;

    const value = obj[key];
    if (isObject(value)) {
      obj[key] = encodeDecodeObject(value as NestedObject, { encode, depth: depth++ });
    } else if (isString(value)) {
      obj[key] = encode ? encodeURIComponent(value as string) : decodeURIComponent(value as string);
    }
  }

  return obj;
}

export const isObject = (o: any) => o?.constructor === Object;
export const isString = (s: any) => s instanceof String || typeof s === "string";

interface NestedObject {
  [key: string]: NestedObject | any;
}

export interface EncodeDecodeObjectOptions {
  encode: boolean;
  depth?: number;
}
