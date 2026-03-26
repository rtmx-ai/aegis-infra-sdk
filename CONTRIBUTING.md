# Contributing to @aegis-cli/infra-sdk

## Development Setup

```bash
# Clone and install
git clone https://github.com/rtmx-ai/aegis-infra-sdk.git
cd aegis-infra-sdk
nvm use
npm install

# Build
npm run build

# Run all tests
npm test
```

## Testing Tiers

| Tier | Command | Scope |
|------|---------|-------|
| 1 | `npm run test:unit` | Unit tests in `src/` -- fast, no I/O |
| 2 | `npm test` | All tests including integration tests in `tests/` |

Run a single test file:

```bash
npx vitest run src/cli/__tests__/args.test.ts
```

Run tests matching a pattern:

```bash
npx vitest run -t "parseSubcommand"
```

## Code Quality

Pre-commit hooks run automatically via the `precommit` script:

```bash
npm run format     # Prettier check
npm run lint       # ESLint
npm run build      # TypeScript compilation
npm run test:unit  # Tier 1 tests
```

To fix formatting and lint issues:

```bash
npm run format:fix
npm run lint:fix
```

## Pull Request Process

1. Create a feature branch from `main`
2. Make your changes with tests
3. Ensure `npm run precommit` passes locally
4. Open a PR against `main`
5. CI must be green before merge

## Release Process

Releases are published to npm via GitHub Actions:

1. Update version in `package.json`
2. Update `CHANGELOG.md` with release notes
3. Commit and push to `main`
4. Create a GitHub release with a `v*` tag
5. The release workflow publishes to npm using Trusted Publishing (OIDC)

## Architecture Notes

The SDK follows hexagonal architecture. When adding features:

- Domain types go in `src/domain/` (zero I/O)
- Port interfaces go in `src/domain/ports.ts`
- Protocol wire format in `src/protocol/`
- CLI parsing in `src/cli/`
- Lifecycle orchestration in `src/lifecycle/`
- Security features in `src/security/`

All external dependencies are injected via port interfaces, making every component testable with mocks at Tier 1.
