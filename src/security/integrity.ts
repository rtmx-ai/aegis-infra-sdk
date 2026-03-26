/**
 * Binary integrity self-check utility.
 * Computes SHA256 of files using node:crypto (zero external deps).
 *
 * Implements: REQ-SDK-010
 */

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

/**
 * Compute the SHA256 hash of a file.
 * Returns the hex-encoded hash string.
 */
export async function computeFileSha256(filePath: string): Promise<string> {
  const data = await readFile(filePath);
  return createHash("sha256").update(data).digest("hex");
}
