/**
 * Unit tests for the landing page logic.
 * Every exported function is exercised — the coverage number the pipeline
 * reports has to mean something.
 */
const app = require('../src/js/app.js');

const {
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
} = app;

describe('pipeline data', () => {
  test('defines exactly the twenty masterclass stages', () => {
    expect(STAGES).toHaveLength(20);
  });

  test('starts at checkout and ends at the deployment summary', () => {
    expect(STAGES[0].name).toBe('Checkout Source');
    expect(STAGES[19].name).toBe('Deployment Summary');
  });

  test('defines the four pillars with unique ids', () => {
    expect(PILLARS).toHaveLength(4);
    const ids = PILLARS.map((pillar) => pillar.id);
    expect(new Set(ids).size).toBe(4);
  });

  test('every pillar carries a title, description and tools', () => {
    PILLARS.forEach((pillar) => {
      expect(pillar.title.length).toBeGreaterThan(0);
      expect(pillar.description.length).toBeGreaterThan(0);
      expect(pillar.tools.length).toBeGreaterThan(0);
    });
  });
});

describe('formatDuration', () => {
  test('formats minutes and seconds', () => {
    expect(formatDuration(271)).toBe('4m 31s');
  });

  test('formats sub-minute durations', () => {
    expect(formatDuration(45)).toBe('0m 45s');
  });

  test('floors fractional seconds', () => {
    expect(formatDuration(90.9)).toBe('1m 30s');
  });

  test('treats invalid or negative input as zero', () => {
    expect(formatDuration(-10)).toBe('0m 0s');
    expect(formatDuration(Number.NaN)).toBe('0m 0s');
    expect(formatDuration(undefined)).toBe('0m 0s');
  });
});

describe('countStagesByPhase', () => {
  test('counts the security gates', () => {
    expect(countStagesByPhase('Security')).toBe(3);
  });

  test('is case insensitive', () => {
    expect(countStagesByPhase('verify')).toBe(3);
  });

  test('counts the infrastructure stages', () => {
    expect(countStagesByPhase('Infrastructure')).toBe(4);
  });

  test('returns zero for unknown or empty phases', () => {
    expect(countStagesByPhase('Chaos')).toBe(0);
    expect(countStagesByPhase('')).toBe(0);
    expect(countStagesByPhase(null)).toBe(0);
  });

  test('accepts a custom stage list', () => {
    expect(countStagesByPhase('a', [{ phase: 'a' }, { phase: 'b' }, { phase: 'a' }])).toBe(2);
  });
});

describe('formatCoverage', () => {
  test('rounds a numeric percentage', () => {
    expect(formatCoverage(92.4)).toBe('92%');
  });

  test('parses a string percentage', () => {
    expect(formatCoverage('87.6')).toBe('88%');
  });

  test('clamps out-of-range values', () => {
    expect(formatCoverage(140)).toBe('100%');
    expect(formatCoverage(-5)).toBe('0%');
  });

  test('reports n/a for unparseable values', () => {
    expect(formatCoverage('not-a-number')).toBe('n/a');
    expect(formatCoverage(undefined)).toBe('n/a');
  });
});

describe('counterFrameValue', () => {
  test('starts at zero', () => {
    expect(counterFrameValue(20, 0)).toBe(0);
  });

  test('ends at the target', () => {
    expect(counterFrameValue(20, 1)).toBe(20);
  });

  test('eases toward the target', () => {
    const mid = counterFrameValue(100, 0.5);
    expect(mid).toBeGreaterThan(50);
    expect(mid).toBeLessThan(100);
  });

  test('clamps progress outside 0..1', () => {
    expect(counterFrameValue(20, -1)).toBe(0);
    expect(counterFrameValue(20, 5)).toBe(20);
  });

  test('handles invalid input safely', () => {
    expect(counterFrameValue(Number.NaN, 1)).toBe(0);
    expect(counterFrameValue(10, Number.NaN)).toBe(0);
  });
});

describe('DOM rendering', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="pillar-grid"></div>
      <ol id="pipeline-track"></ol>
      <dl id="stats"><dd><span class="counter" data-count-to="20">0</span></dd></dl>
      <section data-reveal></section>
      <section data-reveal></section>
    `;
  });

  test('createPillarCard builds a focusable card with tools', () => {
    const card = createPillarCard(document, PILLARS[0]);
    expect(card.className).toBe('pillar-card');
    expect(card.getAttribute('tabindex')).toBe('0');
    expect(card.querySelector('h3').textContent).toBe('Infrastructure as Code');
    expect(card.querySelectorAll('.pillar-tools li')).toHaveLength(PILLARS[0].tools.length);
  });

  test('createStageItem labels the phase and the stage name', () => {
    const item = createStageItem(document, STAGES[7]);
    expect(item.querySelector('.stage-phase').textContent).toBe('Build');
    expect(item.querySelector('.stage-name').textContent).toBe('Docker Build');
  });

  test('renderPillars fills the grid', () => {
    const grid = document.getElementById('pillar-grid');
    expect(renderPillars(document, grid)).toBe(4);
    expect(grid.querySelectorAll('.pillar-card')).toHaveLength(4);
  });

  test('renderPillars clears previous content before rendering', () => {
    const grid = document.getElementById('pillar-grid');
    renderPillars(document, grid);
    renderPillars(document, grid);
    expect(grid.querySelectorAll('.pillar-card')).toHaveLength(4);
  });

  test('renderStages fills the track with all twenty stages', () => {
    const track = document.getElementById('pipeline-track');
    expect(renderStages(document, track)).toBe(20);
    expect(track.querySelectorAll('.stage')).toHaveLength(20);
  });

  test('renderers tolerate a missing container', () => {
    expect(renderPillars(document, null)).toBe(0);
    expect(renderStages(document, null)).toBe(0);
  });
});

describe('animateCounters', () => {
  test('drives the counter to its target value', () => {
    jest.useFakeTimers();
    document.body.innerHTML = '<dl id="stats"><dd><span data-count-to="20">0</span></dd></dl>';
    const started = animateCounters(document.getElementById('stats'), 100);
    expect(started).toBe(1);
    jest.advanceTimersByTime(500);
    expect(document.querySelector('[data-count-to]').textContent).toBe('20');
    jest.useRealTimers();
  });

  test('returns zero when the root is missing or unsearchable', () => {
    expect(animateCounters(null)).toBe(0);
    expect(animateCounters({})).toBe(0);
  });

  test('handles a zero duration without looping forever', () => {
    document.body.innerHTML = '<dl id="stats"><dd><span data-count-to="7">0</span></dd></dl>';
    animateCounters(document.getElementById('stats'), 0);
    expect(document.querySelector('[data-count-to]').textContent).toBe('7');
  });
});

describe('setupReveal', () => {
  test('reveals everything immediately without IntersectionObserver', () => {
    document.body.innerHTML = '<div data-reveal></div><div data-reveal></div>';
    const win = { document, IntersectionObserver: undefined };
    expect(setupReveal(win, document)).toBe(2);
    document.querySelectorAll('[data-reveal]').forEach((element) => {
      expect(element.classList.contains('is-visible')).toBe(true);
    });
  });

  test('observes targets and reveals them when they intersect', () => {
    document.body.innerHTML = '<div data-reveal></div>';
    const observed = [];
    const unobserved = [];
    let callback = null;

    class FakeObserver {
      constructor(cb) {
        callback = cb;
      }

      observe(element) {
        observed.push(element);
      }

      unobserve(element) {
        unobserved.push(element);
      }
    }

    const win = { document, IntersectionObserver: FakeObserver };
    expect(setupReveal(win, document)).toBe(1);
    expect(observed).toHaveLength(1);

    callback([
      { isIntersecting: false, target: observed[0] },
      { isIntersecting: true, target: observed[0] },
    ]);

    expect(observed[0].classList.contains('is-visible')).toBe(true);
    expect(unobserved).toHaveLength(1);
  });
});

describe('init', () => {
  test('renders the full page and reports the counts', () => {
    document.body.innerHTML = `
      <div id="pillar-grid"></div>
      <ol id="pipeline-track"></ol>
      <dl id="stats"><dd><span data-count-to="20">0</span></dd></dl>
      <section data-reveal></section>
    `;
    const result = init(window);
    expect(result).toEqual({ pillars: 4, stages: 20, counters: 1, revealed: 1 });
  });

  test('does not throw when the expected containers are absent', () => {
    document.body.innerHTML = '<main></main>';
    expect(() => init(window)).not.toThrow();
  });
});
