/**
 * Manifest builder for aegis-infra/v1 plugins.
 * Constructs a Manifest from a PluginConfig declaration.
 */

import type { Manifest, InputField } from "../domain/types.js";
import type { PluginConfig } from "../cli/entrypoint.js";

export const CONTRACT_VERSION = "aegis-infra/v1";

/** Build a manifest object from a PluginConfig. */
export function buildManifest(config: PluginConfig): Manifest {
  return {
    name: config.name,
    version: config.version,
    contract: CONTRACT_VERSION,
    description: config.description,
    requires: {
      credentials: config.credentials,
      inputs: config.inputs as readonly InputField[],
    },
    provides: {
      outputs: config.outputs.map((name) => ({ name, type: "string" as const })),
    },
  };
}
