import fetch from "node-fetch";

import { config } from "../../Config";
import { logger } from "../../Logger";

export async function rpc<R>(method: string, args: any[] = []): Promise<R> {
  const ts = performance.now();
  try {
    const id = "trinity";
    const response = await fetch(config.rpc.endpoint, {
      method: "POST",
      headers: {
        Authorization: "Basic " + btoa(`${config.rpc.user}:${config.rpc.password}`),
        "Content-Type": "text/plain",
      },
      body: JSON.stringify({
        jsonrpc: "1.0",
        method: method,
        params: args,
        id,
      }),
    });

    if (response.status !== 200) {
      throw new Error(`${response.status} ${response.statusText}`);
    }

    const text = await response.text();
    let json: any;
    try {
      json = JSON.parse(text);
    } catch (error) {
      console.log({ text });
      throw new Error(`bitcoin rcp error: ${text}`);
    }
    if (json.error !== null) {
      throw new RpcError(json.error, id);
    }
    return json.result;
  } catch (error) {
    if (error instanceof RpcError === false) {
      console.log("\n⛑️ RpcError", error.message, { endpoint: config.rpc.endpoint, method, args });
    }
    throw error;
  } finally {
    const time = performance.now() - ts;
    if (time / 1000 > 1) {
      console.log("⏲️ rpc call %s args [%s] took %s seconds", method, args.join(", "), (time / 1000).toFixed(3));
    }
    logger.addRpc(method, time);
  }
}

/*
 |--------------------------------------------------------------------------------
 | Utilities
 |--------------------------------------------------------------------------------
 */

/**
 * Make RPC call response optional by handling a specific error code related to
 * values that can be made optional. If the error code is not encountered or the
 * error is not a RpcError then the error is rethrown.
 *
 * @param code     - Error code representing an optional error clause.
 * @param fallback - Fallback value to return if error code is encountered.
 */
export function optional(code: number): (error: unknown) => undefined;
export function optional<F>(code: number, fallback: F): (error: unknown) => F;
export function optional<F>(code: number, fallback?: F): (error: unknown) => F | undefined {
  return (error: unknown) => {
    if (error instanceof RpcError && error.code === code) {
      return fallback ?? undefined;
    }
    throw error;
  };
}

/*
 |--------------------------------------------------------------------------------
 | Errors
 |--------------------------------------------------------------------------------
 */

export class RpcError {
  constructor(
    readonly error: {
      code: number;
      message: string;
    },
    readonly id: string,
  ) {}

  get code(): number {
    return this.error.code;
  }

  get message(): string {
    return this.error.message;
  }
}
