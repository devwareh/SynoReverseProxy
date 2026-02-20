# Changelog Automation Design

**Date:** 2026-02-21
**Status:** Approved
**Scope:** Automate structured GitHub Release notes generation using `git-cliff` on every version tag push.

---

## Problem

The current `docker-publish.yml` workflow creates GitHub Releases with `generate_release_notes: true`, which produces a flat, uncategorized list of commits. There is no structure distinguishing features from bug fixes, refactors, or internal churn. Users have no clear signal of what changed in a given release.

---

## Goals

- Produce structured, categorized GitHub Release notes automatically on every `v*.*.*` tag push.
- Exclude version-bump noise commits (`chore: bump version to ...`) from user-facing notes.
- Surface breaking changes prominently.
- Require zero changes to the local release workflow (`bump-version.sh` is untouched).

---

## Out of Scope

- `CHANGELOG.md` committed to the repo (not needed at this time).
- In-app "What's New" UI notifications.
- Fully automated version bumping driven by commit types (release-please / semantic-release).
- Commit message linting / enforcement.

---

## Architecture

### Tool: `git-cliff`

`git-cliff` is a Rust-based changelog generator that parses conventional commit messages directly from git history. It is configured via `cliff.toml` at the repo root and is invoked via the official `orhun/git-cliff-action@v4` GitHub Action.

### Commit Convention (existing, no enforcement added)

The project already uses informal conventional commits:

| Prefix | Meaning |
|--------|---------|
| `feat:` | New user-facing feature |
| `fix:` | Bug fix |
| `refactor:` | Code improvement, no behavior change |
| `docs:` | Documentation only |
| `ci:` | CI/CD pipeline changes |
| `test:` | Test additions or changes |
| `chore:` | Maintenance (version bumps excluded from notes) |

---

## Components

### 1. `cliff.toml` (new file, repo root)

Controls how `git-cliff` reads and formats commit history into release notes markdown.

**Responsibilities:**
- Map conventional commit prefixes to named release sections.
- Exclude `chore: bump version to` commits.
- Surface `BREAKING CHANGE:` footer as a top-level section.
- Output GitHub-flavored markdown with version header and dated release.

**Category mapping:**

| Commit type | Release section |
|-------------|----------------|
| `feat` | New Features |
| `fix` | Bug Fixes |
| `refactor` | Improvements |
| `docs` | Documentation |
| `ci` | CI/CD |
| `test` | Tests |
| `chore` (non-bump) | Other Changes |
| `chore: bump version to` | **excluded** |

### 2. `docker-publish.yml` — `generate-changelog` job (new)

Runs in parallel with `build-and-push-backend` and `build-and-push-frontend`. Outputs the structured markdown as a job output variable consumed by `create-release`.

**Key requirements:**
- `actions/checkout@v4` with `fetch-depth: 0` (full git history required by `git-cliff`).
- `orhun/git-cliff-action@v4` with `args: --latest --strip header`.
- Job output: `content` — the rendered markdown string.
- Only runs when `startsWith(github.ref, 'refs/tags/v')`.

### 3. `docker-publish.yml` — `create-release` job (modified)

**Changes from current state:**
- Adds `generate-changelog` to `needs` list.
- Replaces `generate_release_notes: true` with `generate_release_notes: false`.
- Replaces static `body:` with a composed body: cliff output + horizontal rule + existing Docker instructions.

---

## Data Flow

```
git push --tags  (v1.5.3)
       │
       ▼
docker-publish.yml triggers
       │
       ├─── build-and-push-backend ──┐
       ├─── build-and-push-frontend ─┤
       └─── generate-changelog ──────┤
                    │                │
            git-cliff --latest       │
            reads commits between    │
            v1.5.2..v1.5.3           │
            outputs structured MD    │
                    │                │
                    ▼                ▼
              create-release (needs all three)
                    │
            softprops/action-gh-release
            body = cliff_output + docker_instructions
                    │
                    ▼
            GitHub Release published
```

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| No previous tag (first release) | `git-cliff --latest` falls back to full history. Notes are verbose but correct. |
| No new commits since last tag | Unlikely (always at least the bump commit), but cliff outputs an empty section list. Docker instructions still render. |
| `generate-changelog` job fails | `create-release` is blocked (it depends on this job). Release is not published. Operator must fix `cliff.toml` or action version. |
| Shallow clone | Only `generate-changelog` uses `fetch-depth: 0`. Docker build jobs retain shallow clone for speed. |

---

## File Change Summary

| File | Action |
|------|--------|
| `cliff.toml` | **Create** — changelog configuration |
| `.github/workflows/docker-publish.yml` | **Modify** — add `generate-changelog` job, update `create-release` job |

No changes to: `bump-version.sh`, `ci.yml`, `codeql.yml`, frontend, backend, or any other file.

---

## Example Output

```markdown
## v1.5.3 — 2026-02-21

### ⚠ Breaking Changes
- rename session API endpoint from /api/session to /api/auth/session

### New Features
- move SynologyAuthError to core/auth and raise it from get_new_session

### Bug Fixes
- catch SynologyAuthError in get_mgr to return 401 instead of 500
- harden auth probe, security, and credential hygiene

### Improvements
- consolidate get_new_session_with_otp into get_new_session in core
- promote _SYNO_ERRORS to module constant and fix None error code in message

---
## Docker Images

Pull the latest images:
...
```
