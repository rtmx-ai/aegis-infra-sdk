/**
 * Health check aggregation.
 * Summarizes a list of HealthCheck results into a pass/fail verdict.
 */

import type { HealthCheck } from "../domain/types.js";

/** Aggregate all health checks into a summary. */
export function aggregateChecks(checks: HealthCheck[]): {
  success: boolean;
  summary: string;
} {
  const passed = checks.filter((c) => c.status === "pass").length;
  const warned = checks.filter((c) => c.status === "warn").length;
  const failed = checks.filter((c) => c.status === "fail").length;
  const total = checks.length;

  const success = failed === 0;
  const parts: string[] = [];
  if (passed > 0) parts.push(`${passed} passed`);
  if (warned > 0) parts.push(`${warned} warned`);
  if (failed > 0) parts.push(`${failed} failed`);

  return { success, summary: `${parts.join(", ")} (${total} total)` };
}
