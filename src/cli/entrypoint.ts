/**
 * Plugin CLI entrypoint for aegis-infra/v1 plugins.
 *
 * createPluginCli(config) is the single public API.
 * It parses process.argv, dispatches subcommands, and handles
 * all protocol emission so the plugin author never writes CLI code.
 */

import type { InputField, InfraConfig } from "../domain/types.js";
import type { CspClient, IaCEngine, HealthChecker } from "../domain/ports.js";
import { parseSubcommand, extractInput, requireConfirmDestroy } from "./args.js";
import { StdoutEmitter } from "../protocol/emitter.js";
import { buildManifest } from "../protocol/manifest.js";
import { runPreflight, enableApis, checkApiReadiness } from "../lifecycle/state-machine.js";
import { InitState } from "../lifecycle/types.js";
import type { InitContext } from "../lifecycle/types.js";
import { aggregateChecks } from "../health/aggregator.js";
import { validatePluginConfig } from "./validation.js";

/** Configuration passed to createPluginCli by the plugin author. */
export interface PluginConfig {
  name: string;
  version: string;
  description: string;
  credentials: string[];
  inputs: InputField[];
  outputs: string[];
  cspClient: CspClient;
  engine: IaCEngine;
  healthChecker: HealthChecker;
  requiredApis: string[];
  stateDir?: string;
  apiPollIntervalMs?: number;
  apiPollTimeoutMs?: number;
}

function buildContext(
  config: InfraConfig,
  pluginConfig: PluginConfig,
  emitter: StdoutEmitter,
): InitContext {
  return {
    config,
    emitter,
    cspClient: pluginConfig.cspClient,
    requiredApis: pluginConfig.requiredApis,
    apiPollIntervalMs: pluginConfig.apiPollIntervalMs ?? 5000,
    apiPollTimeoutMs: pluginConfig.apiPollTimeoutMs ?? 120000,
  };
}

/**
 * Create and run a plugin CLI from a PluginConfig.
 * This is the single public API of @aegis-cli/infra-sdk.
 */
export async function createPluginCli(pluginConfig: PluginConfig): Promise<void> {
  const emitter = new StdoutEmitter();

  // Validate config at registration time
  const configError = validatePluginConfig(pluginConfig);
  if (configError) {
    emitter.emit({ type: "result", success: false, error: `Invalid plugin config: ${configError}` });
    process.exitCode = 2;
    return;
  }

  const subcommand = parseSubcommand(process.argv[2]);

  if (!subcommand) {
    process.stderr.write(
      `Usage: ${pluginConfig.name} <manifest|preview|up|status|destroy> [--input JSON]\n`,
    );
    process.exitCode = 1;
    return;
  }

  try {
    switch (subcommand) {
      case "manifest":
        process.stdout.write(JSON.stringify(buildManifest(pluginConfig)) + "\n");
        return;

      case "preview": {
        const infraConfig = extractInput(process.argv, pluginConfig.inputs);
        const ctx = buildContext(infraConfig, pluginConfig, emitter);

        const preflightOk = await runPreflight(ctx);
        if (!preflightOk) {
          process.exitCode = 2;
          return;
        }

        const disabled = await checkApiReadiness(ctx);
        if (disabled.length > 0) {
          emitter.emit({
            type: "result",
            success: false,
            error: `Required APIs not enabled: ${disabled.join(", ")}. Run 'up' first to enable them.`,
          });
          process.exitCode = 2;
          return;
        }

        emitter.emit({
          type: "diagnostic",
          severity: "info",
          message: `Entering state: ${InitState.PROVISION}`,
        });
        await pluginConfig.engine.preview(infraConfig);
        emitter.emit({ type: "result", success: true });
        return;
      }

      case "up": {
        const infraConfig = extractInput(process.argv, pluginConfig.inputs);
        const ctx = buildContext(infraConfig, pluginConfig, emitter);

        const preflightOk = await runPreflight(ctx);
        if (!preflightOk) {
          process.exitCode = 2;
          return;
        }

        const apisOk = await enableApis(ctx);
        if (!apisOk) {
          process.exitCode = 2;
          return;
        }

        emitter.emit({
          type: "diagnostic",
          severity: "info",
          message: `Entering state: ${InitState.PROVISION}`,
        });
        const outputs = await pluginConfig.engine.up(infraConfig);

        emitter.emit({
          type: "diagnostic",
          severity: "info",
          message: `Entering state: ${InitState.VERIFY}`,
        });
        const checks = await pluginConfig.healthChecker.checkAll(infraConfig, outputs);
        for (const check of checks) {
          emitter.emit({
            type: "check",
            name: check.name,
            status: check.status,
            detail: check.detail,
          });
        }
        const { success: healthOk } = aggregateChecks(checks);

        // Validate declared outputs against actual outputs
        const missingOutputs = pluginConfig.outputs.filter((key) => !(key in outputs));
        if (missingOutputs.length > 0) {
          emitter.emit({
            type: "diagnostic",
            severity: "warning",
            message: `Missing declared outputs: ${missingOutputs.join(", ")}`,
          });
        }

        emitter.emit({
          type: "result",
          success: healthOk,
          outputs,
        });
        return;
      }

      case "destroy": {
        const infraConfig = extractInput(process.argv, pluginConfig.inputs);
        const ctx = buildContext(infraConfig, pluginConfig, emitter);

        if (!requireConfirmDestroy(process.argv)) {
          emitter.emit({
            type: "result",
            success: false,
            error:
              "Destroy requires --confirm-destroy flag. This will permanently remove all boundary resources.",
          });
          process.exitCode = 2;
          return;
        }

        const preflightOk = await runPreflight(ctx);
        if (!preflightOk) {
          process.exitCode = 2;
          return;
        }

        const disabled = await checkApiReadiness(ctx);
        if (disabled.length > 0) {
          emitter.emit({
            type: "result",
            success: false,
            error: `Required APIs not enabled: ${disabled.join(", ")}. Run 'up' first to enable them.`,
          });
          process.exitCode = 2;
          return;
        }

        emitter.emit({
          type: "diagnostic",
          severity: "info",
          message: `Entering state: ${InitState.PROVISION}`,
        });
        await pluginConfig.engine.destroy(infraConfig);
        emitter.emit({ type: "result", success: true });
        return;
      }

      case "status": {
        const infraConfig = extractInput(process.argv, pluginConfig.inputs);
        const ctx = buildContext(infraConfig, pluginConfig, emitter);

        const preflightOk = await runPreflight(ctx);
        if (!preflightOk) {
          process.exitCode = 2;
          return;
        }

        const existingOutputs = await pluginConfig.engine.getOutputs(infraConfig);
        const checks = await pluginConfig.healthChecker.checkAll(infraConfig, existingOutputs);
        for (const check of checks) {
          emitter.emit({
            type: "check",
            name: check.name,
            status: check.status,
            detail: check.detail,
          });
        }
        const { success, summary } = aggregateChecks(checks);
        emitter.emit({ type: "result", success, summary });
        return;
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    emitter.emit({
      type: "result",
      success: false,
      error: message,
    });
    process.exitCode = 2;
  }
}
