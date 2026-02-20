# Changelog Automation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Automatically generate structured, categorized GitHub Release notes from conventional commit history using `git-cliff` whenever a `v*.*.*` tag is pushed.

**Architecture:** A new `generate-changelog` CI job installs `git-cliff` via `orhun/git-cliff-action@v4`, reads commits between the previous and new tag using `--latest`, and outputs structured markdown. The existing `create-release` job consumes this output as the GitHub Release body, replacing the current `generate_release_notes: true` auto-notes. The `cliff.toml` config at the repo root defines the category mapping and filtering rules.

**Tech Stack:** `git-cliff` (via `orhun/git-cliff-action@v4`), GitHub Actions (`softprops/action-gh-release@v1`), TOML config.

---

## Task 1: Create `cliff.toml`

**Files:**
- Create: `cliff.toml`

**Step 1: Create the file**

Create `cliff.toml` at the repo root with the following exact content:

```toml
[changelog]
header = ""
body = """
{% if version %}\
    ## {{ version }} — {{ timestamp | date(format="%Y-%m-%d") }}
{% else %}\
    ## Unreleased
{% endif %}\
{% for group, commits in commits | group_by(attribute="group") %}
    ### {{ group | upper_first }}
    {% for commit in commits %}
        - {{ commit.message | upper_first }}\
    {% endfor %}
{% endfor %}
"""
trim = true
footer = ""

[git]
conventional_commits = true
filter_unconventional = true
split_commits = false
commit_preprocessors = []
commit_parsers = [
  { message = "^feat", group = "New Features" },
  { message = "^fix", group = "Bug Fixes" },
  { message = "^refactor", group = "Improvements" },
  { message = "^docs", group = "Documentation" },
  { message = "^ci", group = "CI/CD" },
  { message = "^test", group = "Tests" },
  { message = "^chore\\(release\\)", skip = true },
  { message = "^chore: bump version to", skip = true },
  { message = "^chore", group = "Other Changes" },
]
protect_breaking_commits = false
filter_commits = false
tag_pattern = "v[0-9].*"
skip_tags = ""
ignore_tags = ""
topo_order = false
sort_commits = "oldest"
```

**Step 2: Validate locally (if `git-cliff` is installed)**

If you have `git-cliff` installed (`brew install git-cliff`):

```bash
cd /Users/legend/Work/python/SynoReverseProxy
git-cliff --config cliff.toml --latest
```

Expected: Structured markdown output grouped by `New Features`, `Bug Fixes`, etc. No `chore: bump version to` entries should appear.

If `git-cliff` is not installed, skip this step — it will be validated when the CI workflow runs.

**Step 3: Commit**

```bash
git add cliff.toml
git commit -m "chore: add git-cliff changelog configuration"
```

---

## Task 2: Update `docker-publish.yml`

**Files:**
- Modify: `.github/workflows/docker-publish.yml`

The workflow currently has three jobs: `build-and-push-backend`, `build-and-push-frontend`, and `create-release`. We are adding one job and modifying one job.

**Step 1: Add the `generate-changelog` job**

Insert the following job block into `.github/workflows/docker-publish.yml`, after the `build-and-push-frontend` job and before the `create-release` job:

```yaml
  generate-changelog:
    name: Generate Changelog
    runs-on: ubuntu-latest
    if: startsWith(github.ref, 'refs/tags/v')
    outputs:
      content: ${{ steps.cliff.outputs.content }}
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Generate changelog with git-cliff
        uses: orhun/git-cliff-action@v4
        id: cliff
        with:
          config: cliff.toml
          args: --latest --strip header
```

> **Critical:** `fetch-depth: 0` is mandatory. Without full git history, `git-cliff` cannot find the previous tag and will produce empty or incorrect output.

**Step 2: Update the `create-release` job**

Find the existing `create-release` job and apply these three changes:

**Change A — add `generate-changelog` to `needs`:**

Before:
```yaml
    needs: [build-and-push-backend, build-and-push-frontend]
```

After:
```yaml
    needs: [build-and-push-backend, build-and-push-frontend, generate-changelog]
```

**Change B — replace `generate_release_notes: true` with `false`:**

Before:
```yaml
          generate_release_notes: true
```

After:
```yaml
          generate_release_notes: false
```

**Change C — replace the static `body:` with the cliff output + existing Docker instructions:**

Before:
```yaml
          body: |
            ## Docker Images

            Pull the latest images:
            ...
```

After:
```yaml
          body: |
            ${{ needs.generate-changelog.outputs.content }}

            ---
            ## Docker Images

            Pull the latest images:
            ```bash
            docker pull ${{ env.REGISTRY }}/${{ env.BACKEND_IMAGE_NAME }}:${{ github.ref_name }}
            docker pull ${{ env.REGISTRY }}/${{ env.FRONTEND_IMAGE_NAME }}:${{ github.ref_name }}
            ```

            ## Quick Start

            ```bash
            # Set environment variables
            export SYNOLOGY_NAS_URL=http://YOUR_NAS_IP:5000
            export SYNOLOGY_USERNAME=your_username
            export SYNOLOGY_PASSWORD=your_password

            # Start the application
            docker-compose up -d
            ```
```

**Step 3: Validate YAML syntax**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/docker-publish.yml'))" && echo "YAML valid"
```

Expected output: `YAML valid`

**Step 4: Commit**

```bash
git add .github/workflows/docker-publish.yml
git commit -m "ci: integrate git-cliff for structured GitHub Release notes"
```

---

## Task 3: End-to-End Validation

This task has no code changes — it is a verification step only.

**Step 1: Review the full final workflow file**

Open `.github/workflows/docker-publish.yml` and confirm:
- `generate-changelog` job exists with `fetch-depth: 0`
- `create-release` job has `needs: [build-and-push-backend, build-and-push-frontend, generate-changelog]`
- `generate_release_notes: false` (not `true`)
- `body:` starts with `${{ needs.generate-changelog.outputs.content }}`

**Step 2: Local cliff dry-run for the current pending release**

If `git-cliff` is installed locally:

```bash
git-cliff --config cliff.toml --latest
```

This simulates what the CI job will produce when the next tag is pushed. Review the output and confirm version bump commits are absent and features/fixes are categorized correctly.

**Step 3: Push and observe (next release only)**

When the next release is triggered via `./bump-version.sh patch` (or minor/major) and tags are pushed:

1. Open [GitHub Actions](https://github.com/devwareh/SynoReverseProxy/actions) and watch the `Docker Publish` workflow.
2. The `generate-changelog` job should complete before `create-release`.
3. Open the resulting GitHub Release and confirm the body shows structured sections rather than a flat commit list.

---

## Summary of Files Changed

| File | Action |
|------|--------|
| `cliff.toml` | Created — changelog configuration |
| `.github/workflows/docker-publish.yml` | Modified — new job + updated create-release |
