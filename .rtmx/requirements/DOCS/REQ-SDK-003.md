# REQ-SDK-003: PLUGIN_GUIDE.md Developer Documentation

## Overview

The SDK must ship with a comprehensive plugin authoring guide that serves as the single reference for anyone building an aegis-cli infrastructure backend. The guide lives in the SDK repo because that is the dependency every plugin author imports.

## Specification

### Location

`PLUGIN_GUIDE.md` in the root of the `@aegis/infra-sdk` repo.

### Required Sections

1. **Overview** -- what a plugin is, how aegis-cli discovers and invokes it, the subprocess model
2. **Naming convention** -- `<csp>-<compliance-regime>` with examples and anti-patterns
3. **Quick start** -- step-by-step creation of a new plugin from `npm init` to first `manifest` output
4. **Project structure** -- the five-file layout (index.ts, csp-client.ts, engine.ts, health.ts, stack definition)
5. **Input design** -- CSP-specific vs. universal params, model as runtime parameter
6. **Implementing CspClient** -- method-by-method guide with examples from GCP and AWS
7. **Implementing IaCEngine** -- Pulumi Automation API pattern, state backend, idempotency
8. **Implementing HealthChecker** -- pass/fail/warn contract, outputs parameter, honest failure
9. **The 10 best practices** -- each with rationale and code example
10. **Testing your plugin** -- Tier 1 (mock ports), Tier 2 (Pulumi preview), Tier 3 (live lifecycle)
11. **Packaging for distribution** -- npm for development, bundled binary for release
12. **Release process** -- versioning, changelog, compatibility with SDK versions

### Diagrams

All diagrams in Mermaid format:
- Plugin communication flow (aegis-cli <-> plugin <-> CSP)
- State machine lifecycle
- Three-file architecture
- Testing pyramid for plugins

## BDD Scenarios

### Scenario 1: New developer creates a working plugin from the guide
- Given a developer with Node.js and the SDK installed
- And no prior aegis-cli plugin experience
- When they follow the quick start section of PLUGIN_GUIDE.md
- Then they produce a plugin that passes `manifest` and `preview` subcommands
- And the plugin follows the naming convention and file structure

### Scenario 2: Guide covers all port interfaces
- Given PLUGIN_GUIDE.md
- When the CspClient, IaCEngine, and HealthChecker sections are reviewed
- Then every method on every interface has an explanation, example, and testing guidance

## Acceptance Criteria

- [AC1] PLUGIN_GUIDE.md exists in the SDK repo root
- [AC2] All 12 sections listed above are present
- [AC3] All diagrams are Mermaid, not ASCII art
- [AC4] The guide references the exemplar plugin as a concrete example
- [AC5] The guide is self-contained -- a developer can build a plugin using only the guide and the SDK

## Traceability

- Parent: REQ-SDK-001 (Naming Convention), REQ-SDK-002 (Best Practices)
- Deliverable: PLUGIN_GUIDE.md
