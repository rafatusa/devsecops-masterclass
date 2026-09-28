#!/usr/bin/env node
/**
 * Reads Jest's coverage summary and publishes the line-coverage percentage.
 *
 * Prints a human-readable table for the masterclass audience and, when running
 * inside GitHub Actions, writes `coverage_pct` to $GITHUB_OUTPUT so the
 * deployment summary stage can display it.
 */
const fs = require('fs');
const path = require('path');

const SUMMARY_PATH = path.join(process.cwd(), 'coverage', 'coverage-summary.json');

/**
 * Extract the rounded line-coverage percentage from a Jest summary object.
 *
 * @param {object} summary parsed coverage-summary.json
 * @returns {number} line coverage percentage, rounded to one decimal
 */
function linesPct(summary) {
  const pct = summary && summary.total && summary.total.lines ? summary.total.lines.pct : 0;
  const numeric = typeof pct === 'number' ? pct : Number.parseFloat(pct);
  return Number.isFinite(numeric) ? Math.round(numeric * 10) / 10 : 0;
}

/**
 * Append a key=value pair to the GitHub Actions output file when present.
 *
 * @param {string} key output name
 * @param {string} value output value
 * @returns {boolean} true when the value was written
 */
function publishOutput(key, value) {
  const target = process.env.GITHUB_OUTPUT;
  if (!target) {
    return false;
  }
  fs.appendFileSync(target, `${key}=${value}\n`);
  return true;
}

function main() {
  if (!fs.existsSync(SUMMARY_PATH)) {
    console.error(`coverage summary not found at ${SUMMARY_PATH}`);
    process.exit(1);
  }

  const summary = JSON.parse(fs.readFileSync(SUMMARY_PATH, 'utf8'));
  const pct = linesPct(summary);
  const totals = summary.total;

  console.log('=== Stage 5: Code Coverage Report ===');
  ['statements', 'branches', 'functions', 'lines'].forEach((metric) => {
    const entry = totals[metric];
    console.log(`  ${metric.padEnd(11)} ${String(entry.pct).padStart(6)}%  (${entry.covered}/${entry.total})`);
  });
  console.log(`  line coverage: ${pct}%`);

  publishOutput('coverage_pct', String(pct));
}

if (require.main === module) {
  main();
}

module.exports = { linesPct, publishOutput };
