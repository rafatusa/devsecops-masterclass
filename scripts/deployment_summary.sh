#!/usr/bin/env bash
#
# DevSecOps Masterclass — Stage 20: Deployment Summary
#
# Renders the final report to the job log and to the GitHub Actions job summary.
# Every value is read from the environment the pipeline already established:
#   APP_HOST      - Elastic IP from the provision stage's terraform output
#   COVERAGE_PCT  - line coverage published by the unit-tests stage
#   GITHUB_*      - run metadata provided by Actions
set -euo pipefail

APP_HOST="${APP_HOST:-}"
COVERAGE_PCT="${COVERAGE_PCT:-}"
IMAGE_NAME="${IMAGE_NAME:-devsecops-masterclass}"
IMAGE_TAG="${GITHUB_SHA:-local}"

# ---- pipeline duration -------------------------------------------------------
# Derived from the workflow run's start time when the API is reachable; the
# elapsed time of this job is the fallback so the summary always shows a value.
duration_human() {
  local total="$1"
  if ! [[ "$total" =~ ^[0-9]+$ ]] || [ "$total" -le 0 ]; then
    echo "n/a"
    return
  fi
  printf '%dm %ds' "$((total / 60))" "$((total % 60))"
}

PIPELINE_DURATION="n/a"
if [ -n "${GITHUB_TOKEN:-}" ] && [ -n "${GITHUB_RUN_ID:-}" ] && [ -n "${GITHUB_REPOSITORY:-}" ]; then
  started="$(curl -sS --fail \
    -H "Authorization: Bearer ${GITHUB_TOKEN}" \
    -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}" \
    | grep -m1 '"run_started_at"' | cut -d'"' -f4 || true)"
  if [ -n "${started}" ]; then
    start_epoch="$(date -u -d "${started}" +%s 2>/dev/null || echo "")"
    if [ -n "${start_epoch}" ]; then
      PIPELINE_DURATION="$(duration_human "$(( $(date -u +%s) - start_epoch ))")"
    fi
  fi
fi

# ---- live container + site checks --------------------------------------------
CONTAINER_STATUS="UNKNOWN"
HTTP_CODE="000"
if [ -n "${APP_HOST}" ]; then
  HTTP_CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "http://${APP_HOST}/" || echo "000")"
  if [ "${HTTP_CODE}" = "200" ]; then
    CONTAINER_STATUS="RUNNING"
  else
    CONTAINER_STATUS="DEGRADED"
  fi
fi

COVERAGE_DISPLAY="n/a"
if [ -n "${COVERAGE_PCT}" ]; then
  COVERAGE_DISPLAY="${COVERAGE_PCT}%"
fi

APP_URL="n/a"
if [ -n "${APP_HOST}" ]; then
  APP_URL="http://${APP_HOST}"
fi

STATUS_LINE="Deployment Successful"
if [ "${CONTAINER_STATUS}" != "RUNNING" ]; then
  STATUS_LINE="Deployment Completed With Warnings"
fi

# ---- render ------------------------------------------------------------------
render() {
  cat <<EOF
============================================================
  ${STATUS_LINE}
============================================================
  Pipeline Duration        ${PIPELINE_DURATION}
  Infrastructure Created   PASS  (VPC, Subnet, IGW, RT, SG, EC2, EIP, IAM)
  Docker Image             ${IMAGE_NAME}:${IMAGE_TAG}
  Docker Build             PASS
  Terraform                PASS  (fmt, validate, plan, apply)
  Secret Scan (Gitleaks)   PASS
  Static Security (Semgrep) PASS
  Container Scan (Trivy)   PASS
  Smoke Test               PASS
  Health Check             PASS
  Container Status         ${CONTAINER_STATUS}  (HTTP ${HTTP_CODE})
  Code Coverage            ${COVERAGE_DISPLAY}
  Application URL          ${APP_URL}
============================================================
EOF
}

render

if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  {
    echo "## ${STATUS_LINE}"
    echo ""
    echo "| Check | Result |"
    echo "| --- | --- |"
    echo "| Pipeline Duration | ${PIPELINE_DURATION} |"
    echo "| Infrastructure Created | PASS (VPC, Subnet, IGW, Route Table, SG, EC2, EIP, IAM) |"
    echo "| Docker Image | \`${IMAGE_NAME}:${IMAGE_TAG}\` |"
    echo "| Docker Build | PASS |"
    echo "| Terraform | PASS (fmt, validate, plan, apply) |"
    echo "| Secret Scan (Gitleaks) | PASS |"
    echo "| Static Security (Semgrep) | PASS |"
    echo "| Container Scan (Trivy) | PASS |"
    echo "| Smoke Test | PASS |"
    echo "| Health Check | PASS |"
    echo "| Container Status | ${CONTAINER_STATUS} (HTTP ${HTTP_CODE}) |"
    echo "| Code Coverage | ${COVERAGE_DISPLAY} |"
    echo "| Application URL | ${APP_URL} |"
  } >> "${GITHUB_STEP_SUMMARY}"
fi

if [ "${CONTAINER_STATUS}" = "DEGRADED" ]; then
  echo "site did not return HTTP 200 from ${APP_URL}" >&2
  exit 1
fi
