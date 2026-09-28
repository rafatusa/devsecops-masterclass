# devsecops-masterclass — working notes

## Purpose
Live DevSecOps Masterclass demo repo. Intentionally simple app (static HTML/CSS/JS),
deliberately rich 20-stage pipeline. AWS us-east-1, ec2-docker target.

## Approved decisions
- Meta: devsecops-masterclass / aws / us-east-1 / ec2-docker / github / main / nginx LB.
- Dedicated VPC 10.20.0.0/16 (NOT the default VPC) — user explicitly listed VPC, subnet,
  IGW, route table, SG, EC2 Ubuntu, EIP, IAM role as infra to provision.
- Image transfer: CI `docker save` -> artifact -> `docker load` on host via Ansible.
  Rationale: no registry credentials needed for a masterclass demo. GHCR = optional enhancement.
- Container binds 127.0.0.1:8080; HOST nginx reverse-proxies :80 -> :8080.
  Two nginx layers is deliberate and teaches the proxy pattern.
- Default deploy + destroy workflows (rendered from .udap/pipeline.yaml), rollback: rerun.

## Stage map (user's 20 stages -> pipeline jobs)
1 checkout (auto-injected) | 2 validate-assets | 3 lint | 4-5 unit-tests
6 secret-scan | 7 static-security | 8-9 docker-build | 10-12 terraform-checks
13 provision | 14-17 configure | 18-20 verify

## Defects found by the rehearsal and FIXED (do not regress these)
1. stylelint `color-hex-length`: `#ffffff` in .hero-title gradient -> `#fff`.
2. nginx add_header REDEFINITION (real security bug, found by Semgrep):
   a `location` block that declares add_header DISCARDS server-level headers.
   Every location in nginx/default.conf now restates the 3 security headers.
   If you add a location, restate them there too.
3. Trivy install: the `trivy_<v>_Linux-64bit.tar.gz` asset name is DEAD (404) and
   contrib/install.sh also fails for v0.58.1. Now installed from the official Trivy
   APT repo (works on ubuntu-latest). Do not "fix" this back to a GitHub release URL.
4. `python -m semgrep` is deprecated since 1.38 and exits 2 -> call `semgrep` directly.
5. pipx is not guaranteed; use `python -m pip install` after actions/setup-python.

## Gotchas respected
- ansible-core ships no third-party collections -> ansible.builtin ONLY.
  Docker ops via CLI + changed_when guards, never community.docker.
- No cache_valid_time on apt update (stale cloud-image index -> 404s).
- verify needs unit-tests in `needs` or COVERAGE_PCT resolves empty.
- Never export the app URL as a job output (PROJECT_NAME is a secret and GitHub drops
  outputs containing secret substrings); verify uses provision's raw public_ip.
- image_tarball MUST be absolute: ansible.builtin.copy resolves relative src against
  the ansible/ dir. Playbook asserts this up front.
- terraform fmt -check runs in CI: keep every .tf canonically formatted.
- .semgrepignore excludes .github/workflows + .udap/pipeline.yaml (renderer injects
  actions/checkout@v4, which we cannot SHA-pin) and .venv/node_modules (third-party).
  NO code/infra/container rule is disabled.

## Status
- [x] meta approved, architecture rev 1, pipeline rev 8, design approved, plan approved
- [x] generation complete (36 files)
- [x] validate_project PASS, test_project PASSED (docker/trivy = sandbox gaps only)
- [ ] push / deploy
