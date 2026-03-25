# REQ-SDK-004: Plugin Release and Distribution

## Overview

Plugins must be distributable as both npm packages (for development) and bundled single binaries (for production deployment). aegis-cli invokes plugins as subprocesses, so the distribution format is a standalone executable, not a library import. The release process must produce artifacts that aegis-cli can discover and invoke without requiring Node.js on the target system.

## Specification

### Development Distribution (npm)

During development and testing, plugins are run via `node dist/index.js` or `npx tsx src/index.ts`. The SDK and all dependencies are resolved from `node_modules`. This requires Node.js >= 22 on the developer's workstation.

### Production Distribution (bundled binary)

For production, plugins are compiled into a single executable using `bun compile`, `pkg`, or equivalent bundler. The binary:
- Contains the Node.js runtime, SDK, plugin code, and all dependencies
- Runs without Node.js, npm, or any other runtime installed
- Is named after the plugin: `gcp-assured-workloads` (no extension on Linux/macOS, `.exe` on Windows)
- Is platform-specific: separate builds for darwin-arm64, linux-x64, linux-arm64, windows-x64

### Discovery by aegis-cli

aegis-cli discovers plugins by:
1. Looking for executables matching `aegis-plugin-*` or plugin names in a known directory (`~/.aegis/plugins/`)
2. Running `<plugin> manifest` to discover capabilities
3. Caching the manifest for subsequent invocations

The plugin binary must respond to `manifest` with no network access required (the manifest is a static JSON object compiled into the binary).

### Versioning

- Plugins follow semver
- The SDK contract version (`aegis-infra/v1`) is independent of plugin version
- Breaking SDK changes bump the contract version
- aegis-cli rejects plugins speaking an incompatible contract version

### Release Artifacts

Each plugin release produces:
- npm package (for development: `npm install gcp-assured-workloads`)
- Platform binaries (for production: uploaded to GitHub Releases)
- SHA256 checksums for all binaries
- SBOM (CycloneDX format) for supply chain accountability

### SDK Versioning

- The SDK follows semver
- Plugins declare the SDK as a dependency: `"@aegis/infra-sdk": "^0.1.0"`
- SDK patch/minor updates are backward compatible
- SDK major updates may change the contract version

## BDD Scenarios

### Scenario 1: Bundled binary responds to manifest without Node.js
- Given a compiled plugin binary
- And Node.js is not installed on the system
- When the binary is invoked with "manifest"
- Then valid manifest JSON is emitted on stdout

### Scenario 2: aegis-cli discovers plugin via manifest
- Given a plugin binary in ~/.aegis/plugins/
- When aegis-cli runs plugin discovery
- Then the manifest is retrieved and cached
- And the plugin appears in available backends

### Scenario 3: Contract version mismatch is rejected
- Given a plugin speaking aegis-infra/v2
- And aegis-cli supports only aegis-infra/v1
- When aegis-cli invokes the plugin
- Then aegis-cli rejects the plugin with a version mismatch error

## Acceptance Criteria

- [AC1] Plugin builds produce platform-specific single binaries
- [AC2] Binaries run without Node.js installed
- [AC3] Manifest subcommand requires no network access
- [AC4] GitHub Releases include binaries, checksums, and SBOM
- [AC5] SDK contract version is checked by aegis-cli before invocation

## Traceability

- Parent: REQ-GCG-009 (SDK Extraction), aegis-cli REQ-AEG-001 (Infrastructure Automation)
- Docs: PLUGIN_GUIDE.md Section 11 (Packaging) and Section 12 (Release)
