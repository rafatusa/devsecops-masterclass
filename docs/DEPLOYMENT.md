# Deployment Guide

How to deploy, verify, roll back and destroy the DevSecOps Masterclass stack.

## 1. Prerequisites

| Requirement | Detail |
| --- | --- |
| AWS account | Permissions for EC2, VPC, EIP, IAM role creation, and S3 access for state |
| Region | `us-east-1` (change `region` in `infra/variables.tf` and the pipeline env together) |
| Quotas | 1 vCPU (t3.micro), 1 Elastic IP, 1 VPC |
| GitHub repository | Actions enabled |
| Secrets | Set by the platform at deploy time (see the README configuration table) |

Estimated cost: roughly **$8–10 / month** while running — `t3.micro` on-demand is the bulk of
it; the VPC, internet gateway, route table and security group are free, and the Elastic IP is
free while it stays associated with a running instance. Destroy the stack after the session to
return to zero.

## 2. Deploy

The deploy workflow is dispatch-only — it never fires on a plain push, so a demo run is always
deliberate.

1. Trigger the deploy (platform **Deploy** action, or **Actions → deploy → Run workflow**).
2. Watch the jobs in order: `validate-assets` → `lint` → `unit-tests` → `secret-scan` →
   `static-security` → `docker-build` → `terraform-checks` → `provision` → `configure` → `verify`.
3. Read the Elastic IP from the `provision` job (`Export instance IP`) or from the stage-20
   summary in the `verify` job.

First runs take roughly 6–9 minutes; most of it is `terraform apply` creating the VPC and
instance, and the Docker install on a cold host.

## 3. Verify

Automated (stages 18–20, inside the `verify` job):

- Smoke test: `GET /` returns 200 and contains "Learn DevOps the Easy Way".
- Health check: `GET /healthz` returns 200 `ok`.
- Deployment summary: the release report, including the live application URL.

Manual:

```bash
APP_IP=$(cd infra && terraform output -raw public_ip)
curl -I "http://${APP_IP}/"
curl    "http://${APP_IP}/healthz"
open    "http://${APP_IP}/"
```

On the instance:

```bash
ssh -i <deploy-key> ubuntu@"${APP_IP}"
docker ps                        # devsecops-site should be Up
curl -s localhost:8080/healthz   # container answers directly
systemctl status nginx           # host reverse proxy
```

## 4. Common failures

| Symptom | Cause | Action |
| --- | --- | --- |
| `terraform fmt -check` fails (stage 11) | A `.tf` file is not canonically formatted | Run `terraform fmt -recursive infra/` and commit |
| Trivy fails (stage 9) | A new HIGH/CRITICAL CVE in the nginx base image | Bump the pinned base image tag in the `Dockerfile` and re-run |
| Semgrep fails (stage 7) | A real finding in the app or scripts | Fix the finding; do not weaken the ruleset |
| `Permission denied (publickey)` (stage 14) | Key pair / login user mismatch | Confirm the AMI is Ubuntu and `SSH_USER` is `ubuntu`; re-run the platform deploy so the key material is refreshed |
| Configure stage times out waiting for sshd | Instance still booting, or security group blocks 22 | The stage retries for ~5 minutes; check the security group ingress rule |
| Smoke test 502 | Container not running behind the host proxy | `docker ps`, `docker logs devsecops-site`, then `nginx -t` |

## 5. Roll back

Terraform state is keyed per project, so re-applying an earlier commit is a true rollback of
both the application and the infrastructure:

1. Revert the commit on `main`.
2. Re-run the deploy workflow.

The container is replaced on every configure run, so rolling the code back rolls the running
container back with it.

## 6. Destroy

Use the platform **Destroy** action, or dispatch **Actions → destroy → Run workflow**. It runs
`terraform destroy` against the same state and backend as the deploy, removing the Elastic IP,
instance, IAM role and instance profile, security group, route table, subnet, internet gateway
and VPC.

Confirm afterwards:

```bash
aws ec2 describe-instances \
  --filters "Name=tag:Project,Values=<project-name>" "Name=instance-state-name,Values=running" \
  --region us-east-1
aws ec2 describe-addresses --region us-east-1
```

Both should return no resources belonging to the project. The repository and its pipeline
configuration survive a destroy — redeploying later is just another deploy run.
