# Repository Guidelines

## Project Structure & Module Organization
This repository is a `pnpm` monorepo. `packages/server` contains the NestJS API, with domain code in `src/modules/*`, shared guards/filters in `src/common`, and Drizzle schema files in `src/database/schema`. `packages/web` is the Vue 3 + Vite frontend; keep pages in `src/pages`, API clients in `src/api`, stores in `src/stores`, and reusable logic in `src/composables`. `packages/shared` holds cross-package types, constants, and Zod validators. `packages/terminal` is currently a placeholder Electron package. Structural references now live in `ARCHITECTURE.md` and package-level `src/INDEX.md` files. Project docs also live in `docs/`, local infra in `docker/docker-compose.yml`, and the root `test-e2e.mjs` covers end-to-end API flows.

## Build, Test, and Development Commands
Use Node.js 22+ and `pnpm@10`.

- `pnpm install`: install workspace dependencies.
- `pnpm dev`: start `@nature/server` and `@nature/web` together.
- `pnpm dev:server` / `pnpm dev:web`: run one app only.
- `pnpm build`: build server first, then web.
- `pnpm build:server` / `pnpm build:web`: build a single package.
- `pnpm typecheck`: run workspace type checks; currently the web package exposes the explicit script.
- `pnpm docker:up` / `pnpm docker:down`: start or stop local PostgreSQL, Redis, and MinIO dependencies.

## Coding Style & Naming Conventions
TypeScript runs in `strict` mode via `tsconfig.base.json`. Preserve existing package-local style instead of reformatting unrelated files: server files use semicolons and PascalCase NestJS classes, while the Vue app uses PascalCase SFCs such as `CustomerList.vue` and camelCase helpers such as `usePermission.ts`. Keep DTOs under `dto/`, group backend features by module, and expose shared contracts from `packages/shared/src`.

## Testing Guidelines
There is no workspace-wide unit test runner or coverage gate yet. For backend behavior changes, extend `test-e2e.mjs` and run it against a local server at `http://localhost:3010/api`. For frontend work, run `pnpm dev:web` and `pnpm typecheck`, then record manual verification steps for key flows.

## Commit & Pull Request Guidelines
Git history is not available in this checkout, so follow Conventional Commits by default: `feat(server): add archive endpoint`, `fix(web): guard report route`. Keep PRs focused, describe affected packages, link the related task, and include screenshots for UI changes. Call out schema, Docker, or `.env` updates explicitly so reviewers can reproduce locally.

## Security & Configuration Tips
Copy `.env.example` to `.env` and never commit secrets. Local defaults expect PostgreSQL on `localhost:5442`, Redis on `6389`, MinIO on `9010`, and web CORS from `http://localhost:5183`. Treat JWT, DingTalk, and storage credentials as environment-specific values.
