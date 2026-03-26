# Changelog

## 0.2.0 (2026-03-26)

### Added
- Plugin manifest schema validation (REQ-SDK-010)
- File integrity checking via SHA-256 (REQ-SDK-010)
- Output value validation with type-safe patterns (REQ-SDK-011)
- SDK dependency pinning verification (REQ-SDK-011)
- CI compliance CLI tool (`aegis-ci-check`) (REQ-SDK-012)
- Plugin distribution via GitHub repos with three-layer verification (REQ-SDK-009)

### Security
- REQ-SDK-010: Plugin ecosystem security (manifest schema, file integrity)
- REQ-SDK-011: Runtime security boundaries (output injection prevention, dependency pinning)
- REQ-SDK-012: CI compliance enforcement

### Changed
- Renamed npm scope from `@aegis` to `@aegis-cli`
- Switched release workflow to npm Trusted Publishing (OIDC)

## 0.1.0 (2026-03-20)

### Added
- Initial SDK extraction from gcp-assured-workloads
- `createPluginCli()` entrypoint with full lifecycle orchestration
- CLI argument parsing: subcommand routing, `--input` JSON, `--confirm-destroy`
- Lifecycle state machine: preflight, API enablement, provision, verify
- `StdoutEmitter` for aegis-infra/v1 JSON-line protocol
- Health check aggregator
- Local Pulumi state backend management
- Three port interfaces: `CspClient`, `IaCEngine`, `HealthChecker`
- PLUGIN_GUIDE.md developer documentation
- PluginConfig validation and partial failure handling
- CI pipeline: format, lint, typecheck, unit tests, integration tests
- npm release workflow
