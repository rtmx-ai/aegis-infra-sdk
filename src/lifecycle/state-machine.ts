/**
 * Initialization state machine for plugin subcommands.
 *
 * Phases:
 *   0. PREFLIGHT       -- validate credentials and access
 *   1. API_ENABLEMENT  -- enable required APIs and poll until active
 *   2. PROVISION       -- run IaC engine (handled externally)
 *   3. VERIFY          -- run health checks (handled externally)
 *
 * All CSP API calls go through the injectable CspClient port,
 * making every phase testable at Tier 1 with mocks.
 *
 * Implements: REQ-SDK-007 (error handling, backoff, partial failure)
 */

import { InitState } from "./types.js";
import type { InitContext } from "./types.js";

function emitStateTransition(ctx: InitContext, state: InitState): void {
  ctx.emitter.emit({
    type: "diagnostic",
    severity: "info",
    message: `Entering state: ${state}`,
  });
}

/** Identify errors caused by API propagation delay (retryable). */
export function isRetryableError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return (
    (message.includes("403") && message.includes("API has not been used")) ||
    message.includes("SERVICE_DISABLED")
  );
}

/** State 0: Validate credentials and target access. */
export async function runPreflight(ctx: InitContext): Promise<boolean> {
  emitStateTransition(ctx, InitState.PREFLIGHT);

  try {
    const credsValid = await ctx.cspClient.validateCredentials();
    if (!credsValid) {
      ctx.emitter.emit({
        type: "result",
        success: false,
        error: "Credentials are invalid or expired",
      });
      return false;
    }

    ctx.emitter.emit({
      type: "diagnostic",
      severity: "info",
      message: "Credentials validated",
    });

    const accessOk = await ctx.cspClient.checkAccess(ctx.config);
    if (!accessOk) {
      ctx.emitter.emit({
        type: "result",
        success: false,
        error: "Target not found or caller lacks access",
      });
      return false;
    }

    ctx.emitter.emit({
      type: "diagnostic",
      severity: "info",
      message: "Target accessible",
    });

    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    ctx.emitter.emit({
      type: "result",
      success: false,
      error: `Preflight failed: ${message}`,
    });
    return false;
  }
}

/** Calculate backoff delay with jitter for polling. */
export function backoffDelay(attempt: number, baseMs: number, maxMs: number): number {
  const exponential = Math.min(baseMs * Math.pow(2, attempt), maxMs);
  const jitter = exponential * (0.75 + Math.random() * 0.5); // +/- 25%
  return Math.floor(jitter);
}

/** Poll a single API until it reports ENABLED or timeout. Uses exponential backoff. */
export async function pollApiEnabled(ctx: InitContext, api: string): Promise<boolean> {
  const deadline = Date.now() + ctx.apiPollTimeoutMs;
  let attempt = 0;

  while (Date.now() < deadline) {
    try {
      const state = await ctx.cspClient.getApiState(ctx.config, api);
      if (state === "ENABLED") {
        return true;
      }
    } catch {
      // getApiState threw -- treat as "not yet enabled", continue polling
    }

    if (ctx.apiPollIntervalMs > 0) {
      const delay = backoffDelay(attempt, ctx.apiPollIntervalMs, 30000);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    attempt++;
  }

  return false;
}

/** State 1: Enable required APIs and poll until active. */
export async function enableApis(ctx: InitContext): Promise<boolean> {
  emitStateTransition(ctx, InitState.API_ENABLEMENT);
  const failed: string[] = [];

  for (const api of ctx.requiredApis) {
    try {
      const state = await ctx.cspClient.getApiState(ctx.config, api);

      if (state === "ENABLED") {
        ctx.emitter.emit({
          type: "progress",
          resource: "csp:serviceusage:Api",
          name: api,
          operation: "create",
          status: "complete",
        });
        continue;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      ctx.emitter.emit({
        type: "diagnostic",
        severity: "warning",
        message: `Failed to check API state for ${api}: ${msg}`,
      });
      // Attempt to enable anyway
    }

    ctx.emitter.emit({
      type: "progress",
      resource: "csp:serviceusage:Api",
      name: api,
      operation: "create",
      status: "in_progress",
    });

    try {
      await ctx.cspClient.enableApi(ctx.config, api);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      ctx.emitter.emit({
        type: "progress",
        resource: "csp:serviceusage:Api",
        name: api,
        operation: "create",
        status: "failed",
      });
      ctx.emitter.emit({
        type: "diagnostic",
        severity: "error",
        message: `Failed to enable API '${api}': ${msg}`,
      });
      failed.push(api);
      continue; // Continue attempting remaining APIs
    }

    const enabled = await pollApiEnabled(ctx, api);
    if (!enabled) {
      ctx.emitter.emit({
        type: "progress",
        resource: "csp:serviceusage:Api",
        name: api,
        operation: "create",
        status: "failed",
      });
      failed.push(api);
      continue; // Continue attempting remaining APIs
    }

    ctx.emitter.emit({
      type: "progress",
      resource: "csp:serviceusage:Api",
      name: api,
      operation: "create",
      status: "complete",
    });
  }

  if (failed.length > 0) {
    ctx.emitter.emit({
      type: "result",
      success: false,
      error: `Failed to enable APIs: ${failed.join(", ")}`,
    });
    return false;
  }

  return true;
}

/**
 * Check API readiness without enabling. Used by preview, destroy, status.
 * Returns list of disabled or uncheckable API names (empty if all ready).
 */
export async function checkApiReadiness(ctx: InitContext): Promise<string[]> {
  emitStateTransition(ctx, InitState.API_ENABLEMENT);
  const disabled: string[] = [];

  for (const api of ctx.requiredApis) {
    try {
      const state = await ctx.cspClient.getApiState(ctx.config, api);
      if (state !== "ENABLED") {
        disabled.push(api);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      ctx.emitter.emit({
        type: "diagnostic",
        severity: "warning",
        message: `Failed to check API state for ${api}: ${msg}`,
      });
      disabled.push(api);
    }
  }

  return disabled;
}
