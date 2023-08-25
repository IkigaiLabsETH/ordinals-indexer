import { method } from "@valkyr/api";
import Schema, { number } from "computed-types";

import { ord } from "../../Services/Ord";

export default method({
  params: Schema({
    satoshi: number,
  }),
  handler: async ({ satoshi }) => {
    return ord.traits(satoshi);
  },
});
