# CHANGE-LOG — VOL-4: Migrate Fulcrum Spike

**Format:** each entry records what was done, what artifact was changed, rollback path, and provenance (who + when + source commit/run).

---

## Design stage (2026-06-19)

**No live changes made in this stage.**

This CHANGE-LOG was created by the Solutions Architect (Líbero) as the design-stage artifact. All work in this stage is read-only (code reads, GitHub API queries, document writing). No repo transfers, no Render services, no database operations.

### Artifacts produced

| Artifact | Path | Author | Date |
|---|---|---|---|
| Tech Spec (Draft) | `deploy/tech-spec-vol4.md` | Solutions Architect (Líbero) | 2026-06-19 |
| Pipeline Spec (Draft) | `deploy/pipeline-spec-vol4.md` | Solutions Architect (Líbero) | 2026-06-19 |
| CHANGE-LOG (this file) | `deploy/CHANGE-LOG.md` | Solutions Architect (Líbero) | 2026-06-19 |

All three documents were written to the `main` branch of `dikoga-aid/fulcrum` workspace (local, not yet committed to the repo).

---

## Pre-migration production baseline (to be filled before Phase 1)

**Preparador fills this section before any migration action.** This section is the rollback reference.

| Property | Pre-migration value | Post-Phase-1 verified |
|---|---|---|
| Production Render service name | (capture) | (verify matches) |
| Production Render service ID | (capture) | (verify matches) |
| Production Render URL | (capture) | (verify HTTP 200) |
| Production deploy source | GitHub integration OR deploy hook (capture) | (verify unchanged or as planned) |
| Production GitHub repo connection | `jbonifield-anthropic-id/Fulcrum` | (verify not re-pointed to dikoga-aid) |
| Production HTTP status | (capture: `curl -o /dev/null -s -w "%{http_code}" https://[prod-url]/`) | (verify 200) |

---

## Phase 1 — Repository migration (to be filled by Preparador)

**Status:** Not started.

| Step | Action | Date | Operator | Outcome | Rollback |
|---|---|---|---|---|---|
| 1 | Capture production baseline | | Preparador | | N/A |
| 2 | Disconnect production GitHub integration (if applicable) | | Preparador | | Reconnect to jbonifield-anthropic-id/Fulcrum |
| 3 | GitHub repo transfer: jbonifield-anthropic-id/Fulcrum → dikoga-aid/fulcrum | | Koga (human gate) | | GitHub transfer is reversible by transferring back |
| 4 | Verify redirect from old URL | | Preparador | | N/A |
| 5 | Verify production Render URL still 200 | | Preparador | | If broken: reconnect production Render to original source or use deploy hook |
| 6 | Apply branch protection rules | | Preparador | | Delete rules if they cause issues |
| 7 | CI verification push to main | | Preparador | | Revert commit if it causes issues |

**Rollback for Phase 1:** GitHub repository transfer can be reversed by transferring the repository back to `jbonifield-anthropic-id`. All metadata (issues, PRs, history) is preserved in a reverse transfer. The GitHub redirect from the old URL would also reverse.

---

## Phase 2 — QA environment standup (to be filled by Preparador)

**Status:** Not started.

| Step | Action | Date | Operator | Outcome | Rollback |
|---|---|---|---|---|---|
| 1 | Create Render PostgreSQL `fulcrum-qa-db` | | Preparador | | Delete the PostgreSQL instance |
| 2 | Create Render Web Service `fulcrum-qa` | | Preparador | | Delete the web service |
| 3 | Set env vars on `fulcrum-qa` | | Preparador | | Remove or update env vars |
| 4 | First deploy — pre-deploy command (`db:push` + `migrate`) | | Render (auto) | | Redeploy with corrected pre-deploy command |
| 5 | Seed admin user | | Preparador | | Delete user from DB or re-run seed (idempotent) |
| 6 | Verify QA URL 200 and login | | Preparador | | Debug deploy logs |

**Rollback for Phase 2:** fully additive. Delete `fulcrum-qa` web service and `fulcrum-qa-db` PostgreSQL instance from Render dashboard. No impact on production.

---

## Development stage (2026-06-19) — Developer (Atacante)

### Artifacts produced

| Artifact | Path | Author | Date |
|---|---|---|---|
| Render Blueprint (QA-only) | `render.yaml` | Developer (Atacante) | 2026-06-19 |
| Blueprint validation script | `deploy/validate-render-yaml.mjs` | Developer (Atacante) | 2026-06-19 |

### Actions taken

- Created `render.yaml` at repo root declaring QA-only Render resources: `fulcrum-qa` web service (Node 22, starter plan) + `fulcrum-qa-db` PostgreSQL 16.
- No secrets hardcoded: `DATABASE_URL` uses `fromDatabase`, `SESSION_SECRET` uses `generateValue: true`, all nine integration credentials use `sync: false`.
- `preDeployCommand` set to `npm run db:push -- --force && npm run migrate` (mirrors production init pattern per Tech Spec §4.3).
- Created `deploy/validate-render-yaml.mjs` using Node.js built-ins only (no external deps). Validates: QA-only names, correct `preDeployCommand`, no literal secret values, `DATABASE_URL` fromDatabase, `SESSION_SECRET` generateValue, no disk/domains entries.
- Validation result: **44/44 assertions PASS, exit 0**.
- Feature branch `feature/VOL-4-fulcrum-qa-blueprint` committed locally.

### BLOCKED -- PR cannot be opened (human prerequisite required)

**Blocker:** The enterprise repository `dikoga-aid/fulcrum` is currently empty. Phase 1 (GitHub org-to-org transfer of `jbonifield-anthropic-id/Fulcrum` → `dikoga-aid/fulcrum`) has not yet been executed. There is no `develop` branch on the remote; the push and PR cannot be opened.

**Human prerequisite:** Koga must execute the GitHub repository transfer (jbonifield-anthropic-id/Fulcrum → Settings → General → Transfer ownership → dikoga-aid). Per Tech Spec §3.2, Preparador must disconnect any production GitHub integration from Render before the transfer is initiated.

**What remains after the prerequisite is met:**
1. Push branch `feature/VOL-4-fulcrum-qa-blueprint` to `dikoga-aid/fulcrum`.
2. Open PR targeting `develop` (Preparador creates `develop` from `main` post-transfer).
3. Líbero performs code review.

**Rollback:** No live systems were touched. The local branch and these files are the only artifacts. Delete the local branch and revert this CHANGE-LOG entry if the approach changes.

---

## Code Review stage (2026-06-19) — Solutions Architect (Líbero)

### Artifacts produced

| Artifact | Path | Author | Date |
|---|---|---|---|
| Code Review | `deploy/code-review-vol4.md` | Solutions Architect (Líbero) | 2026-06-19 |

### Actions taken

- Read `deploy/tech-spec-vol4.md`, `deploy/pipeline-spec-vol4.md`, `deploy/prd-vol4.md`, and this CHANGE-LOG as primary context.
- Read `render.yaml` directly from branch `feature/VOL-4-fulcrum-qa-blueprint` (`git show feature/VOL-4-fulcrum-qa-blueprint:render.yaml`).
- Ran `node deploy/validate-render-yaml.mjs` independently — confirmed 44/44 PASS, exit 0.
- Walked all 17 acceptance criteria against the Blueprint.
- Produced `deploy/code-review-vol4.md` with per-AC verdicts and one change request (CR-1).

### Verdict

**REQUEST CHANGES — one item (CR-1):** `render.yaml` must add `postgresMajorVersion: 16` to the `fulcrum-qa-db` database block (spec §4.1 requires PostgreSQL 16 explicitly). `deploy/validate-render-yaml.mjs` must add a corresponding assertion. All other aspects of the Blueprint are correct and clean. Artifact is approvable once CR-1 is resolved.

**No live systems touched. No production environment at risk. Review is design/IaC only.**

---

## CR-1 resolution (2026-06-19) — Developer (Atacante)

### Change request addressed

**Source:** Líbero code review `deploy/code-review-vol4.md`, change request CR-1 (blocking).
**Criterion:** Tech Spec §4.1 — QA database must run PostgreSQL 16 explicitly.

### What changed

| File | Change | Reversible? |
|---|---|---|
| `render.yaml` | Added `postgresMajorVersion: 16` to `fulcrum-qa-db` database block | Yes — remove that one line |
| `deploy/validate-render-yaml.mjs` | Added `# Database configuration` assertion block: finds `databases:` section, locates `fulcrum-qa-db` within it, asserts `postgresMajorVersion: 16` is present | Yes — remove the new assertion block (lines between `# Database configuration` and `# Pre-deploy command`) |

### Validator result

**46/46 assertions PASS, exit 0.** (Previous baseline: 44/44. New assertions: 2 — block found + postgresMajorVersion value.)

### Rollback

Remove `postgresMajorVersion: 16` from `render.yaml` (databases block) and remove the corresponding `# Database configuration` section from `deploy/validate-render-yaml.mjs`. No live infra was touched; this is IaC/config only.

---

## Volante routing log (orchestration, not a live change)
| Date | Operator | Action | Reversible? |
|---|---|---|---|
| 2026-06-19 | Volante | Verified Líbero Architecture artifact complete (tech-spec-vol4.md, pipeline-spec-vol4.md). Bridged Tech Spec to Notion page 38481a33-7504-81a8-b1da-d883849afd89, set card Tech Spec property, advanced Stage Architecture→Development (autonomous gate). | Yes — revert card Stage to Architecture |
| 2026-06-19 | Volante | Dispatched Atacante (Developer) repo-side (pid 7858, log /tmp/volante-VOL-4-dev.log) to author render.yaml QA-only Blueprint + validate-render-yaml.mjs on branch feature/VOL-4-fulcrum-qa-blueprint. No live infra provisioned, production untouched. | Yes — discard branch; no live resources created |
