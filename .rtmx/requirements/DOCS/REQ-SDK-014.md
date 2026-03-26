# REQ-SDK-014: Documentation SDK and Multi-Version Strategy

## Overview

A documentation SDK (@rtmx/docs-kit) provides templates, lint rules, and a publish mechanism so product repos build docs consistently and push them to rtmx.ai. This ensures all public documentation is sourced from product repos, versioned with the code, and published through an approval gate.

## Specification

### Push-Based Documentation Flow

Product repos push docs to rtmx.ai (not pull-based submodules) to support private repos:
1. Product repo has `docs/` with Starlight MDX files
2. Release workflow validates docs and creates a PR against rtmx.ai
3. PR requires manual approval before merge
4. On merge, rtmx.ai auto-deploys

### Docs-Kit Components

- `.rtmx-docs.yaml` config schema (product name, version, target path)
- Frontmatter schema extension (product, version fields)
- MDX page templates (overview, getting-started, api-reference, changelog)
- `rtmx-docs lint` -- validate docs against schema
- `rtmx-docs preview` -- local Starlight dev server
- `rtmx-docs publish` -- create PR against rtmx.ai

### Multi-Version Strategy

- `latest/` directory for current release (main branch)
- `vX.Y/` directories for archived minor series
- Patch releases update `latest/` in-place
- Version badge on each page links to other versions
- Sidebar shows `latest` by default

## Status

DEFERRED -- captured as requirement for when a third product needs docs. Currently the two aegis repos maintain docs/ manually with consistent structure.

## Acceptance Criteria

- [AC1] docs-kit package exists with lint, preview, and publish commands
- [AC2] Two or more products use docs-kit successfully
- [AC3] rtmx.ai accepts push-based docs PRs from product repos
- [AC4] Multi-version docs accessible on rtmx.ai

## Traceability

- Parent: REQ-SDK-013 (SDK Docs Infrastructure)
- Depends on: rtmx.ai REQ-SITE-026 (Aegis Section), REQ-SITE-027 (Approval Gate)
