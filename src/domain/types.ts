/**
 * Domain value objects for @aegis/infra-sdk.
 * Zero I/O dependencies -- pure data types and validation.
 */

/** Validated input configuration for provisioning. */
export interface InfraConfig {
  readonly params: Record<string, string>;
}

/** Outputs from a successfully provisioned boundary. */
export type BoundaryOutput = Record<string, string>;

/** Result of a single health check. */
export type CheckStatus = "pass" | "fail" | "warn";

export interface HealthCheck {
  readonly name: string;
  readonly status: CheckStatus;
  readonly detail: string;
}

/** Input schema declaration for the manifest. */
export interface InputField {
  readonly name: string;
  readonly type: "string" | "enum";
  readonly required?: boolean;
  readonly default?: string;
  readonly values?: readonly string[];
}

/** Output schema declaration for the manifest. */
export interface OutputField {
  readonly name: string;
  readonly type: "string";
}

/** Plugin manifest returned by the `manifest` subcommand. */
export interface Manifest {
  readonly name: string;
  readonly version: string;
  readonly contract: string;
  readonly description: string;
  readonly requires: {
    readonly credentials: readonly string[];
    readonly inputs: readonly InputField[];
  };
  readonly provides: {
    readonly outputs: readonly OutputField[];
  };
}

/** The five subcommands supported by the plugin. */
export const SUBCOMMANDS = ["manifest", "preview", "up", "status", "destroy"] as const;
export type Subcommand = (typeof SUBCOMMANDS)[number];
