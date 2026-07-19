# Repository Guidelines

## Project Structure & Module Organization
- `pages/`: Nuxt route files; keep filenames kebab-case to match route paths. Page-level SEO and layout config lives here.
- `components/`: Reusable Vue components; prefer PascalCase filenames and props defined with TypeScript interfaces.
- `composables/`: Shared logic hooks for data fetching and state. Co-locate any utility types in `types/`.
- `utils/`: Small helpers (formatting, parsing) that should stay framework-agnostic.
- `articles/`, `menus/`, `public/`: Content and static assets served directly; avoid importing from build-only directories.
- Generated/build artifacts: `.nuxt/`, `.output/`, and `dist/` (symlinked) are build outputs—do not edit manually.

## Build, Test, and Development Commands
- `corepack enable` then `pnpm i`: install with the repo’s pinned `pnpm@8.15.0`.
- `pnpm dev`: local development with `.env.development`.
- `pnpm pro`: dev server against `.env.production` for parity checks.
- `pnpm buildDev` | `pnpm buildPro`: production build using the respective env file.
- `pnpm preview`: serve the last build for final verification.
- `pnpm publishDev` | `pnpm publishPro`: build then serve from `dist/` via `http-server` (requires global `http-server`).

## Coding Style & Naming Conventions
- Formatting is enforced via Prettier (`.prettierrc.json`): 2-space indentation, semicolons, double quotes, trailing commas, 100-char line width (JSON narrowed to 40), CRLF endings. Run Prettier before committing.
- Vue components: PascalCase filenames and component names; props/events in camelCase; emit names in `update:modelValue` style when applicable.
- Composables and utilities: camelCase functions; prefix Nuxt composables with `use`.
- Keep Tailwind v4 utility classes compact and prefer DaisyUI components for consistent styling.

## Testing Guidelines
- No automated test suite is configured yet; manually verify critical flows via `pnpm dev` or `pnpm preview`.
- When adding tests, align with Nuxt defaults (Vitest + Vue Test Utils) and place specs alongside components or in `tests/`; name files `*.spec.ts`.
- For UI changes, capture before/after screenshots and list manual checks in your PR description.

## Commit & Pull Request Guidelines
- Follow conventional commits as seen in history (`feat: ...`, `fix: ...`, `chore: ...`, `refactor: ...`); use imperative, present-tense subjects.
- PRs should include: summary of changes, related issue link, environments tested (dev/pro), screenshots or clips for UI updates, and any known follow-ups.
- Keep diffs focused; separate refactors from feature work when possible.
- Ensure builds pass locally (`pnpm buildDev` or `pnpm buildPro`) before requesting review.
