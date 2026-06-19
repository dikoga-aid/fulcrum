# [Developer] CR-1 Resolution Summary — VOL-4

**Date:** 2026-06-19
**Branch:** feature/VOL-4-fulcrum-qa-blueprint
**Change request:** CR-1 from Líbero code review (`deploy/code-review-vol4.md`)

---

## What changed

### 1. `render.yaml` — one line added

Added `postgresMajorVersion: 16` to the `fulcrum-qa-db` database block per Tech Spec §4.1:

```yaml
databases:
  - name: fulcrum-qa-db
    databaseName: fulcrum_qa
    plan: starter
    postgresMajorVersion: 16    # <-- CR-1 addition
    ipAllowList: []
```

Nothing else in `render.yaml` was touched.

### 2. `deploy/validate-render-yaml.mjs` — new assertion block

Added `# Database configuration` section between the resource-names and pre-deploy-command sections. The new block:

- Finds the top-level `databases:` key by line pattern `^databases:\s*$`
- Locates `fulcrum-qa-db` within that section (anchored after `databases:` to avoid false match on the `fromDatabase.name` reference in `envVars`)
- Collects the database block lines and asserts `postgresMajorVersion:\s+16` is present

All 44 pre-existing assertions were left untouched.

---

## Validator result

```
Result: 46 passed, 0 failed

render.yaml is valid: QA-only resources, no hardcoded secrets.
```

**46/46 assertions PASS, exit 0.** Baseline before CR-1 was 44/44; two new assertions were added (block found + postgresMajorVersion value).

---

## PR status — BLOCKED (unchanged from prior development stage)

The enterprise repository `Anthropic-Identity/fulcrum` is still empty — the org-to-org transfer (jbonifield-anthropic-id/Fulcrum → Anthropic-Identity/fulcrum) has not yet been executed by Koga. There is no `develop` branch on the remote, so a PR cannot be opened. The branch was pushed to `origin` (the current remote); no PR created.

**Human prerequisite:** Koga must execute the GitHub repository transfer before a PR targeting `develop` can be opened.

---

## Commit

**Commit hash:** `b0040f7`

**Message:** `VOL-4: CR-1 add postgresMajorVersion:16 to fulcrum-qa-db + validator assertion`

**Files committed:**
- `render.yaml`
- `deploy/validate-render-yaml.mjs`
- `deploy/CHANGE-LOG.md`
- `deploy/dev-cr1-vol4.md` (this file)

---

## Reversibility

- Remove `postgresMajorVersion: 16` from `render.yaml` databases block
- Remove the `# Database configuration` assertion section from `deploy/validate-render-yaml.mjs`
- No live infrastructure was provisioned or modified
