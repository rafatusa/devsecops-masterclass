# DevSecOps Masterclass

A complete, production-inspired DevSecOps delivery pipeline in a single repository.

The application is deliberately simple — a static landing page — so that attention stays
on the pipeline: infrastructure as code, containers, automated testing, code quality,
security scanning, deployment and release verification.

**Title:** Learn DevOps the Easy Way
**Pillars:** Infrastructure as Code · Containers · CI/CD · Automation

---

## What gets built

| Layer | Technology |
| --- | --- |
| Cloud | AWS (us-east-1) |
| Infrastructure | Terraform — VPC, public subnet, internet gateway, route table, security group, EC2 Ubuntu 22.04, Elastic IP, IAM role |
| Application | Static HTML / CSS / JavaScript |
| Web server | Nginx (in-container, plus a host reverse proxy on port 80) |
| Container | Docker (`nginx:1.27-alpine`, non-root) |
| Configuration | Ansible (`ansible.builtin` only) |
| CI/CD | GitHub Actions, 20 stages |

## Architecture

The source of truth is [`.udap/architecture.d2`](.udap/architecture.d2); a
presentation-ready version lives in [`docs/architecture.d2`](docs/architecture.d2).

```
Audience ──HTTP 80──> Elastic IP ──> EC2 (Ubuntu 22.04)
                                      ├── host nginx :80  ──proxy_pass──> :8080
                                      └── docker container nginx:1.27-alpine :8080

VPC 10.20.0.0/16
  └── Public Subnet 10.20.1.0/24 ── Route Table ── Internet Gateway
      └── Security Group (ingress 22, 80)

GitHub Actions ── terraform ──> AWS         IAM Role ──> EC2 (SSM access)
               ── ansible/ssh ─> EC2        S3 ──> terraform state
```

Render the diagrams locally with the [D2](https://d2lang.com) CLI:

```bash
d2 docs/architecture.d2 docs/architecture.svg
d2 docs/pipeline.d2     docs/pipeline.svg
```

## The 20-stage pipeline

Stage 1 is the checkout step that the platform injects into every job.

| # | Stage | Job | Tool |
| --- | --- | --- | --- |
| 1 | Checkout Source | every job | `actions/checkout` |
| 2 | Validate HTML / CSS / JavaScript | `validate-assets` | htmlhint, stylelint, `node --check` |
| 3 | Lint | `lint` | ESLint (flat config) |
| 4 | Unit Tests | `unit-tests` | Jest (jsdom) |
| 5 | Code Coverage Report | `unit-tests` | Jest coverage + `scripts/coverage_summary.js` |
| 6 | Secret Scanning | `secret-scan` | Gitleaks |
| 7 | Static Security Scan | `static-security` | Semgrep (`p/ci`, `p/security-audit`) |
| 8 | Docker Build | `docker-build` | Docker multi-stage build |
| 9 | Container Vulnerability Scan | `docker-build` | Trivy (HIGH, CRITICAL) |
| 10 | Terraform Validate | `terraform-checks` | `terraform validate` |
| 11 | Terraform Format Check | `terraform-checks` | `terraform fmt -check` |
| 12 | Terraform Plan | `terraform-checks` | `terraform plan` |
| 13 | Terraform Apply | `provision` | `terraform apply` |
| 14 | SSH into EC2 | `configure` | OpenSSH + `ssh-keyscan` |
| 15 | Install Docker | `configure` | Ansible (`apt`, official Docker repo) |
| 16 | Deploy Container | `configure` | `docker load` + `docker run` |
| 17 | Configure Nginx | `configure` | Ansible template + handler |
| 18 | Smoke Test | `verify` | `curl` + content assertion |
| 19 | Health Check | `verify` | `curl /healthz` |
| 20 | Deployment Summary | `verify` | `scripts/deployment_summary.sh` |

The pipeline is defined in [`.udap/pipeline.yaml`](.udap/pipeline.yaml). The workflow files
under `.github/workflows/` are **rendered** from that spec — edit the spec, not the
workflows. A visual version is in [`docs/pipeline.d2`](docs/pipeline.d2).

### Image transfer

The image is built once in CI, scanned by Trivy, exported with `docker save`, uploaded as a
workflow artifact, and loaded onto the instance with `docker load`. That keeps the demo free
of registry credentials. Pushing to GHCR or ECR instead is a natural follow-up exercise.

### Deployment summary

Stage 20 prints the release report to the job log and the GitHub job summary:

```
============================================================
  Deployment Successful
============================================================
  Pipeline Duration        4m 31s
  Infrastructure Created   PASS  (VPC, Subnet, IGW, RT, SG, EC2, EIP, IAM)
  Docker Image             devsecops-masterclass:<commit sha>
  Docker Build             PASS
  Terraform                PASS  (fmt, validate, plan, apply)
  Secret Scan (Gitleaks)   PASS
  Static Security (Semgrep) PASS
  Container Scan (Trivy)   PASS
  Smoke Test               PASS
  Health Check             PASS
  Container Status         RUNNING  (HTTP 200)
  Code Coverage            96%
  Application URL          http://<elastic-ip>
============================================================
```

The application URL and Elastic IP are known only after the first `terraform apply` — the
summary reads them from the terraform outputs at run time.

## Run it locally

```bash
npm ci                  # install the toolchain
npm run validate:html   # stage 2
npm run validate:css    # stage 2
npm run validate:js     # stage 2
npm run lint            # stage 3
npm test                # stage 4
npm run coverage:report # stage 5

docker build -t devsecops-masterclass:local .
docker run --rm -p 8080:8080 devsecops-masterclass:local
# then open http://localhost:8080  (health: http://localhost:8080/healthz)
```

## Configuration

All values arrive as CI secrets; none are stored in the repository.

| Name | Provided by | Used by |
| --- | --- | --- |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | platform | terraform stages |
| `TF_STATE_BUCKET` | platform | `terraform init` backend |
| `PROJECT_NAME` | platform | resource prefix, state key |
| `SSH_USER` | platform (from the AMI's OS) | configure stage |
| `SSH_PRIVATE_KEY` / `SSH_PUBLIC_KEY` | platform | SSH login, `aws_key_pair` |
| `GITHUB_TOKEN` | GitHub | pipeline duration lookup in stage 20 |

Terraform inputs (`infra/variables.tf`): `project_name` and `ssh_public_key` come from
secrets; `region`, `instance_type`, `vpc_cidr`, `public_subnet_cidr`, `ssh_ingress_cidr`
and `root_volume_size` have defaults.

## Operations

```bash
# container state on the host
docker ps
docker logs devsecops-site

# host reverse proxy
systemctl status nginx
nginx -t
journalctl -u nginx --since "10 minutes ago"

# infrastructure
cd infra && terraform output
```

Re-running the deploy workflow is the normal way to ship a change: it rebuilds, re-scans,
re-applies and re-verifies. The `destroy` workflow tears the infrastructure down using the
same terraform state.

## Repository layout

```
.github/workflows/   rendered CI workflows (deploy, destroy) — do not edit by hand
.udap/               architecture source of truth, pipeline spec, working notes
ansible/             site.yml + nginx vhost template (stages 15-17)
docs/                architecture + pipeline diagrams, deployment guide, teaching notes
infra/               Terraform: network, security group, IAM, EC2, Elastic IP
nginx/               container nginx configuration
scripts/             coverage summary, deployment summary
src/                 the static site (HTML, CSS, JS)
tests/               Jest unit tests
```

## Documentation

- [Deployment guide](docs/DEPLOYMENT.md) — prerequisites, deploy, verify, roll back, destroy
- [Masterclass notes](docs/MASTERCLASS.md) — what to say and show at each stage

## License

MIT
