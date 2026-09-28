# Masterclass Teaching Notes

A stage-by-stage script for presenting this repository live. Each entry says what to show,
and the point worth making while it runs.

## Framing (2 minutes)

Open `http://<elastic-ip>` and then `.github/workflows/deploy.yml`. The application is one HTML
file, some CSS and one JavaScript module — about 400 lines. The delivery system around it is
considerably larger. That ratio is the lesson: in DevSecOps, the pipeline is the product.

Then show `.udap/pipeline.yaml` and point out that the workflow YAML is *rendered* from it.
Pipelines-as-data, with the workflow as a build artifact.

---

## Phase 1 — Source (stage 1)

**Checkout Source.** Every job starts from a clean runner and checks the code out again. Nothing
survives between jobs: no tools, no files, no login. Ask the audience what that implies for
passing a database endpoint between two jobs — the answer shapes phases 6 and 7.

## Phase 2 — Validate (stage 2)

**HTML, CSS, JavaScript validation** — htmlhint, stylelint, `node --check`.

The cheapest gates run first. These take seconds and catch malformed markup, invalid CSS and
syntax errors before anything expensive starts. Break a tag in `src/index.html` beforehand and
run it once red to show the fail-fast ordering.

## Phase 3 — Quality (stages 3–5)

**Lint** (ESLint), **Unit Tests** (Jest), **Code Coverage**.

`src/js/app.js` is written as small pure functions precisely so they are testable — 
`formatDuration`, `countStagesByPhase`, `counterFrameValue`. Point out that the coverage
threshold is in `package.json` under `coverageThreshold`, and that lowering it to make a build
pass is the single most common way teams quietly delete their safety net.

Stage 5 publishes `coverage_pct` as a job output; stage 20 displays it. That is the first
example of data flowing between jobs.

## Phase 4 — Security (stages 6–7)

**Secret Scanning** (Gitleaks), **Static Security Scan** (Semgrep).

Show `.gitleaks.toml`: it extends the default ruleset and allowlists only generated paths.
Explain the difference between the two tools — Gitleaks looks for *credentials*, Semgrep looks
for *dangerous code patterns*. Both run before the image is built, because there is no reason to
spend build minutes on a commit containing a leaked key.

Live demo: commit a fake AWS key, watch stage 6 fail, remove it.

## Phase 5 — Build (stages 8–9)

**Docker Build**, **Container Vulnerability Scan** (Trivy).

Walk the `Dockerfile`: multi-stage, pinned `nginx:1.27-alpine`, `USER nginx`, a `HEALTHCHECK`,
and `nginx -t` run at build time so a broken config fails the build rather than the deploy.

Trivy gates on HIGH and CRITICAL with `--ignore-unfixed`. Make the trade-off explicit: failing on
vulnerabilities with no available fix blocks delivery without improving security, so it is
excluded deliberately, not accidentally.

## Phase 6 — Infrastructure checks (stages 10–12)

**Terraform Validate**, **Format Check**, **Plan**.

`validate` proves the configuration is internally coherent; `fmt -check` keeps diffs reviewable;
`plan` is the change preview. Show the plan output and count the resources: VPC, subnet, IGW,
route table, three security group rules, IAM role, policy attachment, instance profile, key pair,
instance, Elastic IP.

Show the empty `backend "s3" {}` block in `infra/versions.tf` and explain partial backend
configuration: bucket, key and region arrive as `-backend-config` flags at init, so the same code
serves every environment while state stays separated per project.

## Phase 7 — Provision (stage 13)

**Terraform Apply.**

The state key is deterministic, which is what makes a retry safe: the second attempt finds the
first attempt's state and reconciles instead of duplicating. This is the moment to say that
"duplicate resource" errors are almost always a *backend configuration* bug, never something to
fix with import scripts.

The job exports the Elastic IP as an output. Note that it exports the *IP*, not a URL containing
the project name — GitHub silently drops job outputs that contain secret substrings, and the
project name is a secret.

## Phase 8 — Deploy (stages 14–17)

**SSH into EC2**, **Install Docker**, **Deploy Container**, **Configure Nginx.**

Open `ansible/site.yml`. Two things to highlight:

1. Every module is `ansible.builtin`. `ansible-core` ships no third-party collections, so
   `community.docker.docker_container` would fail at parse time — before any task runs. Container
   operations use the Docker CLI with explicit `changed_when` guards instead.
2. There is no `cache_valid_time` on the apt refresh. Cloud images ship a prebuilt apt index that
   looks fresh and names superseded package versions; skipping the refresh produces a wall of 404s.

Then the two-layer nginx story: the container serves on 8080 bound to localhost only, and the host
nginx owns port 80 and proxies to it. Ask why — the answer is that the public port and the
application port should be independently changeable, and the proxy is where TLS, headers and rate
limiting will live.

## Phase 9 — Verify (stages 18–20)

**Smoke Test**, **Health Check**, **Deployment Summary.**

The smoke test asserts on page *content*, not just a 200 — a default nginx welcome page also
returns 200. `curl --retry` with backoff matters because the container needs boot time after the
configure stage finishes.

Finish on the stage-20 summary in the job summary panel: duration, infrastructure, image,
container status, every security gate, coverage, and the live URL. Open that URL last.

---

## Discussion prompts

- Which of these twenty stages would you run on a pull request, and which only on deploy?
- The image moves as a workflow artifact. What changes if it goes to GHCR or ECR instead?
- Coverage is 90%+ on a ~250-line module. What is that number worth on a 200,000-line codebase?
- This is a single instance with an Elastic IP. What is the smallest change that removes it as a
  single point of failure, and what does that cost?
- Stage 9 ignores unfixed vulnerabilities. Defend the opposite policy.

## Reset between sessions

```bash
# tear down
# platform Destroy action, or: Actions -> destroy -> Run workflow

# redeploy
# platform Deploy action, or: Actions -> deploy -> Run workflow
```

The repository and pipeline configuration survive a destroy, so a fresh run rebuilds the whole
stack from an empty account in a single dispatch.
