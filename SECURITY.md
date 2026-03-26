# Security Policy

## Threat Model

@aegis-cli/infra-sdk runs as a library within aegis-cli infrastructure plugins. These plugins execute with the user's cloud credentials and provision security-critical infrastructure (compliance boundaries, encryption keys, audit sinks). The SDK's security posture addresses:

1. **Plugin supply chain** -- Manifest schema validation ensures plugins declare expected metadata. File integrity checks (SHA-256) detect tampering with plugin binaries.

2. **Output injection** -- Plugins return structured outputs (endpoint URLs, resource IDs) that aegis-cli may interpolate into subsequent operations. Output validation enforces type-safe patterns to prevent injection attacks.

3. **Dependency pinning** -- SDK consumers must pin their SDK dependency to prevent silent upgrades that could introduce vulnerabilities. The CI compliance tool verifies this.

4. **Protocol boundary** -- All plugin-to-host communication flows through the aegis-infra/v1 JSON-line protocol on stdout. The protocol schema is strictly typed, preventing arbitrary data exfiltration via protocol events.

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.2.x   | Yes       |
| < 0.2   | No        |

## Responsible Disclosure

If you discover a security vulnerability, please report it privately:

1. **Do not** open a public GitHub issue
2. Email security@rtmx.ai with:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact assessment
3. You will receive acknowledgment within 48 hours
4. We will coordinate a fix and disclosure timeline

## Security Features

- `validatePluginManifest()` -- Schema validation for plugin manifests
- `computeFileSha256()` -- Integrity verification for plugin binaries
- `validateOutputValues()` -- Pattern-based output injection prevention
- `validateSdkPinning()` -- Ensures consumers pin their SDK dependency
- `aegis-ci-check` -- CI compliance CLI tool for automated verification
