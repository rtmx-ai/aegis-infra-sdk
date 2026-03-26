# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Purpose

@aegis-cli/infra-sdk is the plugin SDK for [aegis-cli](https://github.com/rtmx-ai/aegis-cli) infrastructure backends. It extracts generic plugin infrastructure (CLI argument parsing, lifecycle state machine, JSON-line protocol emission, health check aggregation, local state management) so that each cloud-provider plugin (e.g., gcp-cui-gemini) implements only its domain-specific logic.

The SDK has zero runtime dependencies -- it uses only Node.js built-ins. Plugin authors call `createPluginCli(config)` with their implementations of `CspClient`, `IaCEngine`, and `HealthChecker`, and the SDK handles everything else.

## Prerequisites

- Node.js >= 22 (pinned via `.nvmrc`; use `nvm use` to activate)

## Build and Test Commands

```bash
# Install dependencies
nvm use && npm install

# Build
npm run build              # tsc compilation

# Lint and format
npm run lint               # ESLint
npm run format             # Prettier check
npm run format:fix         # Prettier fix

# Test
npm test                   # all tests
npm run test:unit          # unit tests only

# Run a single test file
npx vitest run src/cli/__tests__/args.test.ts

# Run tests matching a pattern
npx vitest run -t "parseSubcommand"
```

## Architecture

### Plugin Contract (aegis-infra/v1)

Five subcommands, all emitting newline-delimited JSON to stdout:

| Command    | Purpose                          |
|------------|----------------------------------|
| `manifest` | Declare inputs, outputs, version |
| `preview`  | Dry-run of planned changes       |
| `up`       | Provision resources              |
| `status`   | Health check of live boundary    |
| `destroy`  | Tear down all managed resources  |

Four event types in the JSON-line protocol:
- `progress` -- resource operation status (create/update/delete, in_progress/complete/failed)
- `diagnostic` -- warnings and informational messages
- `check` -- health check results (for `status` subcommand)
- `result` -- final output with success/failure and outputs object

### Hexagonal Architecture

```
src/
  cli/
    entrypoint.ts     - createPluginCli() (the single public API)
    args.ts           - CLI argument parsing
  lifecycle/
    state-machine.ts  - Preflight, API enablement, readiness checks
    types.ts          - InitState enum, InitContext interface
  protocol/
    emitter.ts        - JSON-line event emitter to stdout
    events.ts         - Protocol event type definitions
    manifest.ts       - Manifest builder from PluginConfig
  domain/
    types.ts          - Value objects (InfraConfig, BoundaryOutput, HealthCheck)
    ports.ts          - Port interfaces (CspClient, IaCEngine, HealthChecker)
  health/
    aggregator.ts     - Health check aggregation
  state/
    local.ts          - Local state directory management
  index.ts            - Public API re-exports
```

The domain layer has zero I/O dependencies. Port interfaces define contracts for plugin implementors. The protocol layer translates between internal events and the aegis-infra/v1 wire format.

### Key Design Decisions

- `InfraConfig` has `params: Record<string, string>` instead of typed fields. The SDK validates required params against the manifest inputs. The plugin interprets the params.
- `BoundaryOutput` is `Record<string, string>`. Each plugin defines its own output keys.
- `CspClient` replaces `GcpApiClient`. Same interface shape but takes `InfraConfig` instead of `projectId`.
- `createPluginCli(config)` is the only public API. Plugin authors never write protocol or CLI code.

## Development Methodology

This project follows the same DDD/TDD approach as aegis-cli and gcp-cui-gemini.

### Testing

- All tests are unit tests (Tier 1). No network calls, no cloud APIs, no IaC engines.
- Tests use vitest with mocks for all port interfaces.
- Test files are colocated in `__tests__/` directories next to the code they test.
- Write tests before or alongside implementation.

## Key Constraints

- Zero runtime dependencies. Only Node.js built-ins.
- ESM only (`"type": "module"` in package.json).
- Strict TypeScript with explicit return types.
- Stderr is reserved for unstructured debug logs; stdout is exclusively the JSON-line protocol.
- No secrets, tokens, or sensitive data in state or outputs.
