---
name: conventional-commits
description: Write commit messages in the Conventional Commits format from the staged changes. Use when the user asks for a commit message or runs /conventional-commits.
---

# Conventional Commits

Produce a single commit message for what is staged.

1. Run `git diff --staged --stat` and `git diff --staged` (trim to the relevant hunks).
2. Pick the type: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
3. Pick the scope from the folder or module most touched (omit when it spans everything).
4. Subject: imperative, lower case, no trailing period, ≤ 72 characters.
5. Body (optional): what changed and why, wrapped at 72. Footer for `BREAKING CHANGE:` or issue refs.

Answer with only the message in a code block. If nothing is staged, say so and suggest `git add`.
