/**
 * @aegis/infra-sdk -- Plugin SDK for aegis-cli infrastructure backends.
 *
 * Public API re-exports.
 */

// The single entrypoint for plugin authors
export { createPluginCli } from "./cli/entrypoint.js";
export type { PluginConfig } from "./cli/entrypoint.js";

// Domain types
export type {
  InfraConfig,
  BoundaryOutput,
  HealthCheck,
  CheckStatus,
  InputField,
  OutputField,
  Manifest,
  Subcommand,
} from "./domain/types.js";
export { SUBCOMMANDS } from "./domain/types.js";

// Port interfaces for plugin implementors
export type { EventEmitter, CspClient, IaCEngine, HealthChecker } from "./domain/ports.js";

// Protocol events for type-safe emission
export type {
  ProtocolEvent,
  ProgressEvent,
  DiagnosticEvent,
  CheckEvent,
  ResultEvent,
} from "./protocol/events.js";

// Protocol utilities
export { StdoutEmitter } from "./protocol/emitter.js";
export { buildManifest, CONTRACT_VERSION } from "./protocol/manifest.js";

// Lifecycle state machine
export {
  runPreflight,
  enableApis,
  checkApiReadiness,
  pollApiEnabled,
  isRetryableError,
} from "./lifecycle/state-machine.js";
export { InitState } from "./lifecycle/types.js";
export type { InitContext } from "./lifecycle/types.js";

// Health check aggregation
export { aggregateChecks } from "./health/aggregator.js";

// Local state management
export { resolveStateDir, ensureStateDir, buildStackName } from "./state/local.js";

// CLI arg parsing (useful for plugin-level customization)
export { parseSubcommand, parseInput, extractInput, requireConfirmDestroy } from "./cli/args.js";
