import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

import { getNetworkPath } from "./Workers/Ord/Utilities";

export const DIR_ROOT = resolve(__dirname, "..");

// ### Binary Paths

export const DIR_BIN = resolve(DIR_ROOT, "bin");
export const DIR_ORD_BIN = resolve(DIR_BIN, "ord");

// ### Bitcoin Core Paths

export const BTC_DATA = resolve(DIR_ROOT, ".bitcoin");

// ### ORD Paths

export const ORD_DATA = resolve(DIR_ROOT, ".ord");
export const ORD_DATA_GREEN = resolve(ORD_DATA, "green");
export const ORD_DATA_BLUE = resolve(ORD_DATA, "blue");
export const ORD_DATA_SNAPSHOT = resolve(ORD_DATA, "snapshot");
export const ORD_DATA_SNAPSHOTS = resolve(ORD_DATA_SNAPSHOT, "snapshots");

// ### Ensure Paths Exists

mkdirSync(getNetworkPath(ORD_DATA), { recursive: true });
mkdirSync(getNetworkPath(ORD_DATA_GREEN), { recursive: true });
mkdirSync(getNetworkPath(ORD_DATA_BLUE), { recursive: true });
mkdirSync(getNetworkPath(ORD_DATA_SNAPSHOT), { recursive: true });
mkdirSync(ORD_DATA_SNAPSHOTS, { recursive: true });
