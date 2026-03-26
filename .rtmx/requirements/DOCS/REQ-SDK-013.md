# REQ-SDK-013: SDK Documentation Infrastructure

## Overview

The SDK needs a `docs/` directory with Starlight-compatible MDX files that serve as the canonical source for rtmx.ai public documentation. All docs are versioned with the code and pushed to rtmx.ai via PR when released.

## Specification

- `docs/` directory with 6 MDX pages: overview, getting-started, api-reference, plugin-guide, security, changelog
- `docs/.rtmx-docs.yaml` config file identifying the product and version
- Frontmatter schema: title (required), description (required), product, version
- CHANGELOG.md, CONTRIBUTING.md, SECURITY.md at repo root
- package.json metadata: homepage, repository, keywords, bugs
- Cross-repo links in README and PLUGIN_GUIDE.md

## Acceptance Criteria

- [AC1] docs/ directory exists with 6 valid MDX files
- [AC2] Each MDX file has title and description frontmatter
- [AC3] CHANGELOG.md covers v0.1.0 and v0.2.0
- [AC4] CONTRIBUTING.md covers dev setup, testing, PR process, release
- [AC5] SECURITY.md covers threat model and responsible disclosure
- [AC6] npm view shows homepage and keywords
- [AC7] README links to gcp-assured-workloads and aegis-cli

## Traceability

- Deliverables: docs/, CHANGELOG.md, CONTRIBUTING.md, SECURITY.md
