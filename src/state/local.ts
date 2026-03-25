/**
 * Local state directory management.
 * Manages the local file-based state directory for IaC engine backends.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

import type { InfraConfig } from "../domain/types.js";

/** Resolve the absolute path to the local state directory. */
export function resolveStateDir(pluginName: string, stateDir?: string): string {
  if (stateDir) return stateDir;
  return path.join(os.homedir(), ".aegis", "state", pluginName);
}

/** Create the state directory with 0700 permissions if it does not exist. */
export function ensureStateDir(pluginName: string, stateDir?: string): string {
  const dir = resolveStateDir(pluginName, stateDir);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  return dir;
}

/**
 * Build a deterministic stack name from an InfraConfig.
 * Joins all param values with hyphens, lowercased.
 */
export function buildStackName(config: InfraConfig): string {
  const values = Object.values(config.params);
  if (values.length === 0) {
    return "default";
  }
  return values.join("-").toLowerCase();
}
