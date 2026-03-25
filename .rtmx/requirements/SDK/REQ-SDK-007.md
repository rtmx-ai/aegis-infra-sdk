# REQ-SDK-007: SDK Robustness and Validation

## Overview

The SDK has solid happy-path coverage but lacks robustness in error handling, configuration validation, and failure-path testing. Identified in testability audit on 2026-03-25.

## Specification

### PluginConfig Validation

`createPluginCli()` must validate the config object at registration time:
- `name`: non-empty string
- `version`: non-empty string matching semver pattern
- `description`: non-empty string
- `credentials`: non-empty string array
- `inputs`: array of InputField objects, each with valid name and type
- `outputs`: non-empty string array
- `cspClient`: object implementing all 4 CspClient methods
- `engine`: object implementing all 4 IaCEngine methods
- `healthChecker`: object implementing checkAll method
- `requiredApis`: string array (may be empty)

Invalid config emits a result event with success false and specific error, then exits. No swallowed errors.

### Partial API Enablement Handling

`enableApis()` must handle failures gracefully:
- Wrap each `enableApi()` call in try-catch
- On failure, emit a diagnostic with the specific API and error
- Continue attempting remaining APIs (best effort)
- Return false and emit result listing all failed APIs

`checkApiReadiness()` must similarly wrap `getApiState()`:
- On throw, treat as "UNKNOWN" and include in disabled list with error detail

### Manifest-Output Validation

After `engine.up()` returns, the SDK must check that all declared outputs exist in the result:
- Missing outputs: emit diagnostic with severity "warning" listing missing keys
- Extra outputs: silently included (forward compatible)
- This is a warning, not a blocking error -- aegis-cli can handle partial outputs

### Exponential Backoff in pollApiEnabled

Replace fixed-interval polling with exponential backoff:
- Base interval: configurable (default 2s)
- Multiplier: 2x per retry
- Max interval: 30s
- Jitter: +/- 25% of interval
- Total timeout: configurable (default 120s)

### Error Context Wrapping

All catch blocks in the SDK must preserve error context:
- Never `catch { return undefined }` without logging
- Wrap errors with phase name: "PREFLIGHT failed: {original error}"
- Emit diagnostic events for caught errors before returning failure

### Integration Tests with Failure Mocks

Add mock implementations that exercise failure paths:
- `failingCspClient`: validateCredentials returns false
- `partialCspClient`: some APIs enabled, some disabled, some throw
- `failingEngine`: up() throws after partial progress
- `failingHealthChecker`: returns mix of pass/fail/warn
- Test that the SDK produces correct protocol output for each failure

## BDD Scenarios

### Scenario 1: Invalid PluginConfig rejected at registration
- Given a PluginConfig with empty name
- When createPluginCli is called
- Then a result event with success false is emitted
- And the error mentions "name is required"

### Scenario 2: Partial API enablement failure produces per-API diagnostics
- Given 5 required APIs where the 3rd throws on enableApi
- When the up subcommand runs
- Then APIs 1-2 are enabled successfully
- And a diagnostic mentions the 3rd API and its error
- And APIs 4-5 are still attempted
- And the result lists all failed APIs

### Scenario 3: Missing output keys produce warning
- Given engine.up() returns 3 of 5 declared outputs
- When the up subcommand completes
- Then a diagnostic with severity "warning" lists the 2 missing output keys
- And the result still includes the 3 available outputs

### Scenario 4: Exponential backoff increases poll interval
- Given an API that takes 60 seconds to enable
- When pollApiEnabled polls
- Then the first retry waits ~2s, second ~4s, third ~8s
- And no single interval exceeds 30s

### Scenario 5: Failure mock integration test
- Given a plugin with failingEngine (up throws)
- When the up subcommand is invoked
- Then a result event with success false is emitted
- And the error includes the original engine error message

## Acceptance Criteria

- [AC1] PluginConfig is validated with specific error messages before any subcommand runs
- [AC2] enableApis() handles per-API failures without crashing
- [AC3] checkApiReadiness() handles per-API failures without crashing
- [AC4] Missing outputs produce warnings, not silent omission
- [AC5] pollApiEnabled uses exponential backoff with jitter
- [AC6] All catch blocks preserve and surface error context
- [AC7] Integration tests cover credential failure, engine failure, health check failure, partial API failure

## Traceability

- Tests: src/cli/__tests__/validation.test.ts, src/lifecycle/__tests__/partial-failure.test.ts, tests/integration/failure-scenarios.test.ts
