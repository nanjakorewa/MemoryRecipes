# Repository Guidelines

## Project Structure & Module Organization
Keep the Hugo root clean and group features by purpose. Core config sits in `config/_default/`, while localization glue lives in `i18n/` (one `.toml` file per language). Place recipes under `content/<lang>/<meal>/<slug>/index.md` so Japanese and English entries stay parallel. Layout overrides for the Hugo Book theme go in `layouts/` (use `_default/` for shared templates and `partials/` for reusable blocks). Media belongs in `static/images/recipes` to keep fingerprinted asset URLs stable.

## Build, Test, and Development Commands
- `hugo server -D --disableFastRender`: local preview with drafts and multilingual switcher enabled.
- `hugo --gc --minify`: production build with asset cleanup.
- `hugo --i18n-warnings`: surfaces untranslated keys before merging.
Pin the Book theme as a Hugo Module in `config/_default/module.toml` and run `hugo mod get -u` whenever upstream changes are needed.

## Coding Style & Naming Conventions
Front matter uses TOML with 2-space indentation; lists inside Markdown stay at 2 spaces for readability in Book theme TOCs. Name recipes with lowercase kebab slugs (`matcha-pancakes`) that match the folder name. Shortcodes, partials, and SCSS variables follow `camelCase` to mirror Hugo Book defaults. Run `markdownlint` (VS Code extension or `npx markdownlint-cli2 "content/**/*.md"`) before committing to keep heading hierarchy and code fences tidy.

## Testing Guidelines
Every PR must include `hugo --i18n-warnings` and `hugo --gc --minify` output pasted in the PR conversation or CI log. Add screenshots or GIFs of both light and dark modes for new visual components. When adding a recipe, include at least one locale in full; placeholder translations should be marked with `translationPending = true` in front matter so reviewers can filter them.

## Commit & Pull Request Guidelines
Follow Conventional Commits (`feat: add en/ja curry recipe`, `fix: correct hero shortcode`). Keep commits scoped to one logical change so multilingual reviewers can cherry-pick translations. PR descriptions must summarize intent, list testing commands executed, reference any related issue (e.g., `Closes #12`), and attach screenshots for UI changes. Request at least one reviewer per language touched plus one maintainer familiar with Hugo modules.

## Internationalization Tips
Favor shared shortcodes over duplicated Markdown when adding decorative elements. Define translation strings in `i18n/*.toml` instead of hardcoding copy in layouts, and include context comments for translators. When introducing new sections, supply fallback English text so partially translated builds stay navigable.
