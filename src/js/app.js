/**
 * DevSecOps Masterclass landing page behaviour.
 *
 * Everything meaningful lives in small pure functions so the unit-test stage
 * measures real logic instead of DOM glue.
 */

/** The four pillars rendered as cards. */
const PILLARS = [
  {
    id: 'iac',
    icon: '\u{1F4D0}',
    title: 'Infrastructure as Code',
    description: 'Every network, instance and permission is declared, reviewed and versioned.',
    tools: ['Terraform', 'AWS VPC', 'EC2'],
  },
  {
    id: 'containers',
    icon: '\u{1F4E6}',
    title: 'Containers',
    description: 'One immutable image built once, scanned, then shipped to every environment.',
    tools: ['Docker', 'Nginx', 'Trivy'],
  },
  {
    id: 'cicd',
    icon: '\u{1F501}',
    title: 'CI/CD',
    description: 'Twenty gates between a commit and production, each one automated.',
    tools: ['GitHub Actions', 'Jest', 'ESLint'],
  },
  {
    id: 'automation',
    icon: '\u{2699}',
    title: 'Automation',
    description: 'Configuration, deployment and verification run without a human at the keyboard.',
    tools: ['Ansible', 'Gitleaks', 'Semgrep'],
  },
];

/** The pipeline stages, in execution order, grouped by phase. */
const STAGES = [
  { phase: 'Source', name: 'Checkout Source' },
  { phase: 'Validate', name: 'Validate HTML, CSS, JavaScript' },
  { phase: 'Quality', name: 'Lint' },
  { phase: 'Quality', name: 'Unit Tests' },
  { phase: 'Quality', name: 'Code Coverage Report' },
  { phase: 'Security', name: 'Secret Scanning' },
  { phase: 'Security', name: 'Static Security Scan' },
  { phase: 'Build', name: 'Docker Build' },
  { phase: 'Security', name: 'Container Vulnerability Scan' },
  { phase: 'Infrastructure', name: 'Terraform Validate' },
  { phase: 'Infrastructure', name: 'Terraform Format Check' },
  { phase: 'Infrastructure', name: 'Terraform Plan' },
  { phase: 'Infrastructure', name: 'Terraform Apply' },
  { phase: 'Deploy', name: 'SSH into EC2' },
  { phase: 'Deploy', name: 'Install Docker' },
  { phase: 'Deploy', name: 'Deploy Container' },
  { phase: 'Deploy', name: 'Configure Nginx' },
  { phase: 'Verify', name: 'Smoke Test' },
  { phase: 'Verify', name: 'Health Check' },
  { phase: 'Verify', name: 'Deployment Summary' },
];

/**
 * Format a duration in seconds the way the deployment summary reports it.
 *
 * @param {number} totalSeconds elapsed seconds
 * @returns {string} e.g. "4m 31s"
 */
function formatDuration(totalSeconds) {
  const safe = Number.isFinite(totalSeconds) && totalSeconds > 0 ? Math.floor(totalSeconds) : 0;
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}m ${seconds}s`;
}

/**
 * Count the stages belonging to a phase.
 *
 * @param {string} phase phase label
 * @param {Array<{phase: string}>} [stages] stage list (defaults to the pipeline)
 * @returns {number} number of matching stages
 */
function countStagesByPhase(phase, stages = STAGES) {
  if (typeof phase !== 'string' || phase.length === 0) {
    return 0;
  }
  const wanted = phase.toLowerCase();
  return stages.filter((stage) => stage.phase.toLowerCase() === wanted).length;
}

/**
 * Clamp a raw coverage number into a displayable percentage string.
 *
 * @param {number|string} value coverage percentage
 * @returns {string} e.g. "92%"
 */
function formatCoverage(value) {
  const numeric = typeof value === 'string' ? Number.parseFloat(value) : value;
  if (!Number.isFinite(numeric)) {
    return 'n/a';
  }
  const bounded = Math.min(100, Math.max(0, numeric));
  return `${Math.round(bounded)}%`;
}

/**
 * Build one pillar card element.
 *
 * @param {Document} doc owning document
 * @param {{icon: string, title: string, description: string, tools: string[]}} pillar pillar data
 * @returns {HTMLElement} the card element
 */
function createPillarCard(doc, pillar) {
  const card = doc.createElement('article');
  card.className = 'pillar-card';
  card.setAttribute('tabindex', '0');

  const icon = doc.createElement('div');
  icon.className = 'pillar-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = pillar.icon;

  const heading = doc.createElement('h3');
  heading.textContent = pillar.title;

  const body = doc.createElement('p');
  body.textContent = pillar.description;

  const tools = doc.createElement('ul');
  tools.className = 'pillar-tools';
  pillar.tools.forEach((tool) => {
    const item = doc.createElement('li');
    item.textContent = tool;
    tools.appendChild(item);
  });

  card.append(icon, heading, body, tools);
  return card;
}

/**
 * Build one pipeline stage element.
 *
 * @param {Document} doc owning document
 * @param {{phase: string, name: string}} stage stage data
 * @returns {HTMLElement} the stage element
 */
function createStageItem(doc, stage) {
  const item = doc.createElement('li');
  item.className = 'stage';

  const phase = doc.createElement('span');
  phase.className = 'stage-phase';
  phase.textContent = stage.phase;

  const name = doc.createElement('span');
  name.className = 'stage-name';
  name.textContent = stage.name;

  item.append(phase, name);
  return item;
}

/**
 * Render the pillar cards into a container.
 *
 * @param {Document} doc owning document
 * @param {HTMLElement|null} container target element
 * @param {Array} [pillars] pillar list
 * @returns {number} number of cards rendered
 */
function renderPillars(doc, container, pillars = PILLARS) {
  if (!container) {
    return 0;
  }
  container.textContent = '';
  pillars.forEach((pillar) => container.appendChild(createPillarCard(doc, pillar)));
  return pillars.length;
}

/**
 * Render the pipeline stages into a container.
 *
 * @param {Document} doc owning document
 * @param {HTMLElement|null} container target element
 * @param {Array} [stages] stage list
 * @returns {number} number of stages rendered
 */
function renderStages(doc, container, stages = STAGES) {
  if (!container) {
    return 0;
  }
  container.textContent = '';
  stages.forEach((stage) => container.appendChild(createStageItem(doc, stage)));
  return stages.length;
}

/**
 * Compute one frame of the counter animation.
 *
 * @param {number} target final value
 * @param {number} progress progress between 0 and 1
 * @returns {number} the value to display for this frame
 */
function counterFrameValue(target, progress) {
  const safeTarget = Number.isFinite(target) ? target : 0;
  const bounded = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0));
  const eased = 1 - (1 - bounded) ** 3;
  return Math.round(safeTarget * eased);
}

/**
 * Animate every [data-count-to] element inside a root.
 *
 * @param {HTMLElement|Document} root search root
 * @param {number} [durationMs] animation duration
 * @returns {number} number of counters started
 */
function animateCounters(root, durationMs = 1200) {
  if (!root || typeof root.querySelectorAll !== 'function') {
    return 0;
  }
  const counters = Array.from(root.querySelectorAll('[data-count-to]'));
  counters.forEach((element) => {
    const target = Number.parseInt(element.getAttribute('data-count-to'), 10);
    const started = Date.now();
    const tick = () => {
      const progress = durationMs > 0 ? (Date.now() - started) / durationMs : 1;
      element.textContent = String(counterFrameValue(target, progress));
      if (progress < 1) {
        setTimeout(tick, 32);
      }
    };
    tick();
  });
  return counters.length;
}

/**
 * Reveal elements on scroll, or immediately when IntersectionObserver is absent.
 *
 * @param {Window} win owning window
 * @param {Document} doc owning document
 * @returns {number} number of observed elements
 */
function setupReveal(win, doc) {
  const targets = Array.from(doc.querySelectorAll('[data-reveal]'));
  if (typeof win.IntersectionObserver !== 'function') {
    targets.forEach((element) => element.classList.add('is-visible'));
    return targets.length;
  }
  const observer = new win.IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 },
  );
  targets.forEach((element) => observer.observe(element));
  return targets.length;
}

/**
 * Wire the whole page up.
 *
 * @param {Window} win owning window
 * @returns {{pillars: number, stages: number, counters: number, revealed: number}} render counts
 */
function init(win) {
  const doc = win.document;
  const pillars = renderPillars(doc, doc.getElementById('pillar-grid'));
  const stages = renderStages(doc, doc.getElementById('pipeline-track'));
  const counters = animateCounters(doc.getElementById('stats'));
  const revealed = setupReveal(win, doc);
  return { pillars, stages, counters, revealed };
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => init(window));
  } else {
    init(window);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    PILLARS,
    STAGES,
    animateCounters,
    countStagesByPhase,
    counterFrameValue,
    createPillarCard,
    createStageItem,
    formatCoverage,
    formatDuration,
    init,
    renderPillars,
    renderStages,
    setupReveal,
  };
}
