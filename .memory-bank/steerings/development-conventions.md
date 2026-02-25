# Development Conventions

## Git Flow

- **Main branch**: `main` - production-ready code
- **Feature branches**: `feature/<short-description>` (e.g. `feature/testimonials-section`, `feature/voice-onboarding`)
- Always create a feature branch before starting work
- PR to `main` when the feature is complete

## Commit Messages

- Concise, imperative mood, focus on "why" not "what"
- One or two sentences max
- Do NOT add `Co-Authored-By` lines
- Commit frequently — small, logical chunks
- Don't bundle unrelated changes

## Code Style

- ES modules (`"type": "module"` in package.json)
- No linter/formatter configured at project level
- Node.js runtime with Express 4

## Pull Request Rules

1. Keep PRs focused on a single feature or fix
2. PR to `main` when feature is complete
3. Small, logical commits within each PR

## Authentication

- Basic auth enabled in production
- Auth skipped when `NODE_ENV=development`
