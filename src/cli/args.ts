/**
 * CLI argument parsing for aegis-infra/v1 plugins.
 * Extracts subcommand, --input JSON, and --confirm-destroy flag.
 */

import type { Subcommand, InfraConfig, InputField } from "../domain/types.js";
import { SUBCOMMANDS } from "../domain/types.js";

/** Validate and parse a subcommand string. */
export function parseSubcommand(arg: string | undefined): Subcommand | null {
  if (!arg) return null;
  return (SUBCOMMANDS as readonly string[]).includes(arg) ? (arg as Subcommand) : null;
}

/**
 * Parse --input JSON into an InfraConfig, validating required fields
 * against the plugin's declared input schema.
 */
export function parseInput(json: string, inputs: readonly InputField[]): InfraConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Invalid JSON in --input");
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("--input must be a JSON object");
  }

  const obj = parsed as Record<string, unknown>;
  const params: Record<string, string> = {};

  for (const field of inputs) {
    const value = obj[field.name];
    if (value !== undefined && value !== null) {
      params[field.name] = String(value);
    } else if (field.default !== undefined) {
      params[field.name] = field.default;
    } else if (field.required) {
      throw new Error(`${field.name} is required and must be a non-empty string`);
    }
  }

  // Validate enum fields
  for (const field of inputs) {
    if (field.type === "enum" && field.values && params[field.name] !== undefined) {
      if (!field.values.includes(params[field.name])) {
        throw new Error(
          `${field.name} must be one of: ${field.values.join(", ")} (got '${params[field.name]}')`,
        );
      }
    }
  }

  return { params };
}

/** Extract --input JSON from argv. Throws if missing. */
export function extractInput(argv: string[], inputs: readonly InputField[]): InfraConfig {
  const inputIdx = argv.indexOf("--input");
  if (inputIdx === -1 || inputIdx + 1 >= argv.length) {
    throw new Error("--input JSON argument is required");
  }
  return parseInput(argv[inputIdx + 1], inputs);
}

/** Check if --confirm-destroy flag is present in process args. */
export function requireConfirmDestroy(argv: string[]): boolean {
  return argv.includes("--confirm-destroy");
}
