# REQ-SDK-008: SDK npm Release Workflow

## Overview

The SDK must be published to npm as `@aegis/infra-sdk` via an automated CI workflow triggered by git tags. Plugin authors install the SDK as a standard npm dependency. The release process must be reproducible, auditable, and require no manual npm CLI steps.

## Specification

### npm Package

- Scope: `@aegis`
- Package name: `@aegis/infra-sdk`
- Registry: npmjs.com (public)
- Access: public (no paid scope required for public packages)

### Release Trigger

- A git tag matching `v*` (e.g., `v0.1.0`, `v1.0.0`) triggers the release workflow
- The workflow runs the full CI suite (format, lint, typecheck, unit tests, integration tests) before publishing
- If any CI step fails, the publish is aborted
- The tag version must match `package.json` version

### Release Workflow Steps

1. Checkout code at the tagged commit
2. Install dependencies
3. Run full CI (format, lint, build, unit tests, integration tests)
4. Verify `package.json` version matches the git tag
5. Run `npm publish --access public`
6. Create a GitHub Release with auto-generated release notes

### Authentication

- npm publish uses an `NPM_TOKEN` stored as a GitHub Actions secret
- The token is a granular access token scoped to the `@aegis` org with publish permissions
- No interactive login required

### Versioning Policy

- SDK follows semver
- Patch: bug fixes, no API changes
- Minor: new exports, backward-compatible additions
- Major: breaking changes to PluginConfig, port interfaces, or protocol contract version
- The protocol contract version (`aegis-infra/v1`) changes only on major SDK releases
- Plugin authors pin `"@aegis/infra-sdk": "^0.x.0"` for compatible updates

### Pre-publish Checklist (automated)

- [ ] All CI passes
- [ ] Version in package.json matches git tag
- [ ] `dist/` builds cleanly from source
- [ ] No `devDependencies` leak into the published package (checked via `npm pack --dry-run`)

## BDD Scenarios

### Scenario 1: Tag push triggers publish
- Given a git tag `v0.1.0` is pushed
- And package.json version is "0.1.0"
- When the release workflow runs
- Then CI passes
- And npm publish succeeds
- And a GitHub Release is created

### Scenario 2: Tag-version mismatch aborts publish
- Given a git tag `v0.2.0` is pushed
- But package.json version is "0.1.0"
- When the release workflow runs
- Then the workflow fails before npm publish
- And no package is published

### Scenario 3: CI failure aborts publish
- Given a git tag is pushed
- But unit tests fail
- When the release workflow runs
- Then npm publish is not attempted

## Acceptance Criteria

- [AC1] `npm install @aegis/infra-sdk` works after a release
- [AC2] Release is triggered only by version tags, not by branch pushes
- [AC3] Full CI runs before publish
- [AC4] Tag-version mismatch is detected and blocks publish
- [AC5] GitHub Release is created with release notes

## Traceability

- Parent: REQ-SDK-004 (Plugin Release and Distribution)
- Workflow: .github/workflows/release.yml
