import { normalizePrototypeOverlay } from '@ai-canvas/shared/schemas';
import type { PrototypeOverlayCustomData } from '@ai-canvas/shared/types';
import type { AssistantServiceInput } from '../types';
import { inferPrototypeTemplate } from '../generation-mode';
import {
	extractPrototypeSubject,
	expectsFunctionalPrototype,
	extractPromptKeywords,
	toTitleWords,
	truncateTitle,
} from './text-utils';

export {
	extractPrototypeSubject,
	expectsFunctionalPrototype,
	extractPromptKeywords,
	toTitleWords,
	truncateTitle,
} from './text-utils';

export function pickPrototypePalette(seed: string) {
	const palettes = [
		{ accent: '#0f766e', background: 'linear-gradient(145deg, #ecfeff, #ccfbf1 42%, #dcfce7)' },
		{ accent: '#2563eb', background: 'linear-gradient(145deg, #eff6ff, #dbeafe 42%, #e0f2fe)' },
		{ accent: '#c2410c', background: 'linear-gradient(145deg, #fff7ed, #ffedd5 42%, #fef3c7)' },
		{ accent: '#be185d', background: 'linear-gradient(145deg, #fdf2f8, #fce7f3 42%, #fae8ff)' },
	];
	const code = Array.from(seed).reduce((sum, character) => sum + character.charCodeAt(0), 0);
	return palettes[code % palettes.length]!;
}

export function createPrototypeFile(
	code: string,
	options?: Partial<PrototypeOverlayCustomData['files'][string]>,
) {
	return {
		code,
		...(options ?? {}),
	};
}

export function buildCalculatorPrototype(
	subjectTitle: string,
	palette: { accent: string; background: string },
	template: PrototypeOverlayCustomData['template'],
): PrototypeOverlayCustomData {
	const title = `${subjectTitle} App`;
	if (template === 'vanilla') {
		const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <link rel="stylesheet" href="./styles.css" />
  </head>
  <body>
    <main class="prototype-shell">
      <section class="calculator-card">
        <header class="calculator-header">
          <div>
            <div class="eyebrow">Interactive prototype</div>
            <h1>${title}</h1>
            <p>Use the live keypad, test operations, and validate the behavior directly on the canvas.</p>
          </div>
          <div class="status-pill">Ready</div>
        </header>
        <section class="calculator-grid">
          <div class="display-panel">
            <div class="display-label">Expression</div>
            <div id="display" class="display-value">12+8</div>
          </div>
          <div id="keypad" class="keypad-panel"></div>
          <aside class="history-panel">
            <div class="panel-title">Recent calculations</div>
            <div id="history" class="app-list"></div>
          </aside>
        </section>
      </section>
    </main>
    <script type="module" src="./index.js"></script>
  </body>
</html>`;
		const js = `const rows = [
  [
    { label: 'C', kind: 'ghost', action: 'clear' },
    { label: '⌫', kind: 'ghost', action: 'backspace' },
    { label: '%', kind: 'ghost', action: 'append' },
    { label: '÷', kind: 'accent', action: 'append', value: '/' },
  ],
  [
    { label: '7', action: 'append' },
    { label: '8', action: 'append' },
    { label: '9', action: 'append' },
    { label: '×', kind: 'accent', action: 'append', value: '*' },
  ],
  [
    { label: '4', action: 'append' },
    { label: '5', action: 'append' },
    { label: '6', action: 'append' },
    { label: '-', kind: 'accent', action: 'append' },
  ],
  [
    { label: '1', action: 'append' },
    { label: '2', action: 'append' },
    { label: '3', action: 'append' },
    { label: '+', kind: 'accent', action: 'append' },
  ],
  [
    { label: '0', action: 'append', kind: 'wide' },
    { label: '.', action: 'append' },
    { label: '=', kind: 'accent', action: 'evaluate' },
  ],
];

const display = document.getElementById('display');
const keypad = document.getElementById('keypad');
const history = document.getElementById('history');

let expression = '12+8';
let historyItems = ['12 + 8 = 20', '9 × 7 = 63'];

function evaluateExpression(value) {
  const sanitized = value.replace(/[^0-9+\\-*/.()]/g, '');
  if (!sanitized.trim()) return '0';

  try {
    const result = Function(\`"use strict"; return (\${sanitized})\`)();
    if (typeof result !== 'number' || Number.isNaN(result) || !Number.isFinite(result)) {
      return 'Error';
    }
    return String(Number(result.toFixed(6)));
  } catch {
    return 'Error';
  }
}

function renderHistory() {
  history.innerHTML = '';
  historyItems.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'history-row';
    row.textContent = item;
    history.appendChild(row);
  });
}

function renderDisplay() {
  display.textContent = expression;
}

function handleKey(key) {
  if (key.action === 'append') {
    const nextValue = key.value ?? key.label;
    expression = expression === '0' || expression === 'Error' ? nextValue : \`\${expression}\${nextValue}\`;
  } else if (key.action === 'clear') {
    expression = '0';
  } else if (key.action === 'backspace') {
    expression = expression === 'Error' ? '0' : expression.slice(0, -1) || '0';
  } else if (key.action === 'evaluate') {
    const result = evaluateExpression(expression);
    if (result !== 'Error') {
      historyItems = [\`\${expression.replace(/\\*/g, '×').replace(/\\//g, '÷')} = \${result}\`, ...historyItems].slice(0, 6);
      renderHistory();
    }
    expression = result;
  }

  renderDisplay();
}

rows.forEach((row) => {
  const rowEl = document.createElement('div');
  rowEl.className = 'keypad-row';
  row.forEach((key) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = key.label;
    button.className = ['calc-button', key.kind ? \`calc-button--\${key.kind}\` : ''].filter(Boolean).join(' ');
    button.addEventListener('click', () => handleKey(key));
    rowEl.appendChild(button);
  });
  keypad.appendChild(rowEl);
});

renderDisplay();
renderHistory();
`;
		const css = `* {
  box-sizing: border-box;
}

:root {
  font-family: 'Inter', ui-sans-serif, system-ui, sans-serif;
  color: #0f172a;
}

html, body {
  min-height: 100%;
}

body {
  margin: 0;
  background: ${palette.background};
}

button {
  border: 0;
  cursor: pointer;
}

.prototype-shell {
  min-height: 100vh;
  padding: 16px;
  display: grid;
  place-items: center;
}

.calculator-card {
  width: min(100%, 920px);
  border-radius: 28px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(255, 255, 255, 0.92);
  padding: 22px;
  box-shadow: 0 28px 84px rgba(15, 23, 42, 0.14);
}

.calculator-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
}

.eyebrow, .display-label, .panel-title {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #64748b;
}

h1 {
  margin: 10px 0 0;
  font-size: 40px;
  line-height: 0.96;
}

p {
  margin: 12px 0 0;
  max-width: 54ch;
  color: #475569;
  line-height: 1.55;
}

.status-pill {
  border-radius: 999px;
  background: color-mix(in srgb, ${palette.accent} 14%, white);
  color: ${palette.accent};
  padding: 10px 14px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.calculator-grid {
  display: grid;
  grid-template-columns: 1.15fr 0.85fr;
  gap: 16px;
  margin-top: 22px;
}

.display-panel, .keypad-panel, .history-panel {
  border-radius: 24px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  background: rgba(255, 255, 255, 0.96);
}

.display-panel {
  grid-column: 1 / 2;
  padding: 18px;
  background: #0f172a;
}

.display-label {
  color: rgba(255, 255, 255, 0.56);
}

.display-value {
  margin-top: 12px;
  color: white;
  font-size: clamp(28px, 6vw, 54px);
  font-weight: 800;
  text-align: right;
  min-height: 64px;
  word-break: break-all;
}

.keypad-panel {
  grid-column: 1 / 2;
  padding: 16px;
  display: grid;
  gap: 12px;
}

.keypad-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.calc-button {
  min-height: 64px;
  border-radius: 18px;
  background: #f8fafc;
  color: #0f172a;
  font-size: 22px;
  font-weight: 700;
}

.calc-button--accent {
  background: ${palette.accent};
  color: white;
}

.calc-button--ghost {
  background: #e2e8f0;
  color: #334155;
}

.calc-button--wide {
  grid-column: span 2;
}

.history-panel {
  padding: 18px;
}

.history-row {
  margin-top: 12px;
  border-radius: 16px;
  background: #f8fafc;
  padding: 12px 14px;
  color: #334155;
}

@media (max-width: 860px) {
  .calculator-grid {
    grid-template-columns: 1fr;
  }
}`;
		return normalizePrototypeOverlay({
			title,
			template: 'vanilla',
			activeFile: '/index.js',
			files: {
				'/index.html': createPrototypeFile(html, { hidden: true }),
				'/index.js': createPrototypeFile(js),
				'/styles.css': createPrototypeFile(css),
			},
			preview: {
				eyebrow: 'Interactive prototype',
				title,
				description:
					'A functional calculator with live arithmetic controls and calculation history.',
				accent: palette.accent,
				background: palette.background,
				badges: ['Calculator', 'Interactive', 'Vanilla'],
				metrics: [
					{ label: 'Mode', value: 'Live' },
					{ label: 'Keys', value: '19' },
					{ label: 'History', value: '6' },
				],
			},
		});
	}
	const buttonComponent = `export function CalculatorButton({ label, variant = 'default', onClick }) {
  return (
    <button type="button" className={\`calc-button calc-button--\${variant}\`} onClick={onClick}>
      {label}
    </button>
  );
}
`;
	const calculatorLogic = `export function evaluateExpression(expression) {
  const sanitized = expression.replace(/[^0-9+\\-*/.()]/g, '');

  if (!sanitized.trim()) {
    return '0';
  }

  try {
    const result = Function(\`"use strict"; return (\${sanitized})\`)();
    if (typeof result !== 'number' || Number.isNaN(result) || !Number.isFinite(result)) {
      return 'Error';
    }
    return String(Number(result.toFixed(6)));
  } catch {
    return 'Error';
  }
}
`;
	const appCode = `import { useState } from 'react';
import './styles.css';
import { CalculatorButton } from './components/CalculatorButton';
import { evaluateExpression } from './lib/calc';

const rows = [
  [
    { label: 'C', variant: 'ghost', action: 'clear' },
    { label: '⌫', variant: 'ghost', action: 'backspace' },
    { label: '%', variant: 'ghost', action: 'append' },
    { label: '÷', variant: 'accent', action: 'append', value: '/' },
  ],
  [
    { label: '7', action: 'append' },
    { label: '8', action: 'append' },
    { label: '9', action: 'append' },
    { label: '×', variant: 'accent', action: 'append', value: '*' },
  ],
  [
    { label: '4', action: 'append' },
    { label: '5', action: 'append' },
    { label: '6', action: 'append' },
    { label: '-', variant: 'accent', action: 'append' },
  ],
  [
    { label: '1', action: 'append' },
    { label: '2', action: 'append' },
    { label: '3', action: 'append' },
    { label: '+', variant: 'accent', action: 'append' },
  ],
  [
    { label: '0', action: 'append', variant: 'wide' },
    { label: '.', action: 'append' },
    { label: '=', variant: 'accent', action: 'evaluate' },
  ],
];

export default function App() {
  const [expression, setExpression] = useState('12+8');
  const [history, setHistory] = useState(['12 + 8 = 20', '9 × 7 = 63']);

  const appendValue = (value) => {
    setExpression((current) => (current === '0' || current === 'Error' ? value : \`\${current}\${value}\`));
  };

  const handleAction = (key) => {
    if (key.action === 'append') {
      appendValue(key.value ?? key.label);
      return;
    }

    if (key.action === 'clear') {
      setExpression('0');
      return;
    }

    if (key.action === 'backspace') {
      setExpression((current) => {
        const next = current === 'Error' ? '0' : current.slice(0, -1);
        return next.length > 0 ? next : '0';
      });
      return;
    }

    if (key.action === 'evaluate') {
      const result = evaluateExpression(expression);
      if (result !== 'Error') {
        setHistory((current) => [\`\${expression.replace(/\\*/g, '×').replace(/\\//g, '÷')} = \${result}\`, ...current].slice(0, 6));
      }
      setExpression(result);
    }
  };

  return (
    <main className="prototype-shell" style={{ '--accent': '${palette.accent}', '--page-bg': '${palette.background}' }}>
      <section className="calculator-frame">
        <div className="calculator-card">
          <header className="calculator-header">
            <div>
              <span className="eyebrow">Interactive prototype</span>
              <h1>${title}</h1>
              <p>Use the live keypad, test operations, and validate the functional behavior directly on the canvas.</p>
            </div>
            <div className="status-pill">Ready</div>
          </header>

          <section className="calculator-grid">
            <div className="display-panel">
              <div className="display-label">Expression</div>
              <div className="display-value">{expression}</div>
            </div>

            <div className="keypad-panel">
              {rows.map((row, rowIndex) => (
                <div key={rowIndex} className="keypad-row">
                  {row.map((key) => (
                    <CalculatorButton
                      key={key.label}
                      label={key.label}
                      variant={key.variant}
                      onClick={() => handleAction(key)}
                    />
                  ))}
                </div>
              ))}
            </div>

            <aside className="history-panel">
              <div className="panel-title">Recent calculations</div>
              {history.map((item) => (
                <div key={item} className="history-row">{item}</div>
              ))}
            </aside>
          </section>
        </div>
      </section>
    </main>
  );
}
`;
	const css = `* {
  box-sizing: border-box;
}

:root {
  font-family: 'Inter', ui-sans-serif, system-ui, sans-serif;
  color: #0f172a;
}

html,
body,
#root {
  min-height: 100%;
}

body {
  margin: 0;
  overflow: hidden;
  background: #f8fafc;
}

button {
  border: 0;
  cursor: pointer;
}

.prototype-shell {
  min-height: 100%;
  padding: 16px;
  background: var(--page-bg);
}

.calculator-frame {
  min-height: calc(100vh - 32px);
  display: grid;
  place-items: center;
}

.calculator-card {
  width: min(100%, 980px);
  border-radius: 28px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(255, 255, 255, 0.9);
  padding: 22px;
  box-shadow: 0 28px 84px rgba(15, 23, 42, 0.14);
}

.calculator-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
}

.eyebrow,
.display-label,
.panel-title {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #64748b;
}

h1 {
  margin: 10px 0 0;
  font-size: 40px;
  line-height: 0.96;
}

p {
  margin: 12px 0 0;
  max-width: 54ch;
  color: #475569;
  line-height: 1.55;
}

.status-pill {
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 14%, white);
  color: var(--accent);
  padding: 10px 14px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.calculator-grid {
  display: grid;
  grid-template-columns: 1.15fr 0.85fr;
  gap: 16px;
  margin-top: 22px;
}

.display-panel,
.keypad-panel,
.history-panel {
  border-radius: 24px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  background: rgba(255, 255, 255, 0.96);
}

.display-panel {
  grid-column: 1 / 2;
  padding: 18px;
  background: #0f172a;
}

.display-label {
  color: rgba(255, 255, 255, 0.56);
}

.display-value {
  margin-top: 12px;
  color: white;
  font-size: clamp(28px, 6vw, 54px);
  font-weight: 800;
  text-align: right;
  min-height: 64px;
  word-break: break-all;
}

.keypad-panel {
  grid-column: 1 / 2;
  padding: 16px;
  display: grid;
  gap: 12px;
}

.keypad-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.calc-button {
  min-height: 64px;
  border-radius: 18px;
  background: #f8fafc;
  color: #0f172a;
  font-size: 22px;
  font-weight: 700;
  transition: transform 140ms ease, box-shadow 140ms ease, background-color 140ms ease;
}

.calc-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 14px 24px rgba(15, 23, 42, 0.1);
}

.calc-button--accent {
  background: var(--accent);
  color: white;
}

.calc-button--ghost {
  background: #e2e8f0;
  color: #334155;
}

.calc-button--wide {
  grid-column: span 2;
}

.history-panel {
  padding: 18px;
}

.history-row {
  margin-top: 12px;
  border-radius: 16px;
  background: #f8fafc;
  padding: 12px 14px;
  color: #334155;
}

@media (max-width: 860px) {
  body {
    overflow: auto;
  }

  .calculator-grid {
    grid-template-columns: 1fr;
  }
}
`;
	const base = normalizePrototypeOverlay({
		title,
		template: 'react',
	});

	return normalizePrototypeOverlay({
		...base,
		title,
		activeFile: '/App.jsx',
		files: {
			...base.files,
			'/App.jsx': createPrototypeFile(appCode),
			'/index.jsx': createPrototypeFile(base.files['/index.jsx']?.code ?? '', { hidden: true }),
			'/styles.css': createPrototypeFile(css),
			'/components/CalculatorButton.jsx': createPrototypeFile(buttonComponent),
			'/lib/calc.js': createPrototypeFile(calculatorLogic),
		},
		preview: {
			eyebrow: 'Interactive prototype',
			title,
			description: 'A functional calculator with live arithmetic controls and calculation history.',
			accent: palette.accent,
			background: palette.background,
			badges: ['Calculator', 'Interactive', 'React'],
			metrics: [
				{ label: 'Mode', value: 'Live' },
				{ label: 'Keys', value: '19' },
				{ label: 'History', value: '6' },
			],
		},
	});
}

export function buildPromptDrivenPrototype(input: AssistantServiceInput): PrototypeOverlayCustomData {
	const subject = extractPrototypeSubject(input.message);
	const subjectTitle = toTitleWords(subject).slice(0, 36);
	const brand = subjectTitle.split(/\s+/).slice(0, 2).join(' ') || 'Canvas Forge';
	const keywords = extractPromptKeywords(subject);
	const palette = pickPrototypePalette(subject);
	const template = inferPrototypeTemplate(input);
	const variant = /calculator/i.test(input.message)
		? 'calculator'
		: /dashboard|admin|analytics|workspace|portal|command center/i.test(input.message)
			? 'dashboard'
			: expectsFunctionalPrototype(input.message)
				? 'app'
				: 'landing';

	if (variant === 'calculator') {
		return buildCalculatorPrototype(subjectTitle, palette, template);
	}
	const headline =
		variant === 'dashboard'
			? `Operate ${subjectTitle.toLowerCase()} from one live workspace.`
			: variant === 'app'
				? `Use ${subjectTitle.toLowerCase()} through a live working interface.`
				: `Launch ${subjectTitle.toLowerCase()} with a sharper story and faster conversion.`;
	const summary =
		variant === 'dashboard'
			? `Track the main signals for ${subject.toLowerCase()}, coordinate teams, and move from insight to action in one interface.`
			: variant === 'app'
				? `Work with ${subject.toLowerCase()} directly in the prototype, validate behavior, and refine the interaction model without leaving the canvas.`
				: `Present the value of ${subject.toLowerCase()} with clear positioning, focused benefits, and a decisive call to action.`;
	const badges =
		keywords.length > 0 ? keywords.slice(0, 4).map(toTitleWords) : ['Strategy', 'Design', 'Launch'];
	const features = (
		keywords.length > 0 ? keywords : ['workflow', 'conversion', 'automation']
	).slice(0, 3);
	const metrics =
		variant === 'dashboard'
			? [
					{ label: 'Active', value: '142' },
					{ label: 'At Risk', value: '09' },
					{ label: 'Win Rate', value: '38%' },
				]
			: [
					{ label: 'Visitors', value: '24k' },
					{ label: 'Conversion', value: '7.4%' },
					{ label: 'Pipeline', value: '$186k' },
				];
	const jsx =
		variant === 'dashboard'
			? `import './styles.css';

const metrics = ${JSON.stringify(metrics, null, 2)};
const priorities = ${JSON.stringify(
					features.map((feature, index) => `${toTitleWords(feature)} stream ${index + 1}`),
					null,
					2,
				)};
const updates = ${JSON.stringify(
					[
						`${brand} approvals waiting on design review`,
						`Critical ${features[0] ?? 'workflow'} automation needs refinement`,
						`Leadership update scheduled for tomorrow morning`,
					],
					null,
					2,
				)};

export default function App() {
  return (
    <main className="prototype-shell" style={{ '--accent': '${palette.accent}', '--page-bg': '${palette.background}' }}>
      <section className="app-frame dashboard-frame">
        <aside className="sidebar">
          <div className="brand-lockup">
            <div className="brand-mark">${brand
					.split(/\s+/)
					.map((word) => word[0])
					.join('')
					.slice(0, 2)}</div>
            <div>
              <div className="eyebrow">Live operations</div>
              <div className="brand-name">${brand}</div>
            </div>
          </div>
          <div className="sidebar-copy">${badges.join(' · ')}</div>
          <div className="sidebar-panel">
            <span>Focus areas</span>
            {priorities.map((item) => (
              <div key={item} className="sidebar-chip">{item}</div>
            ))}
          </div>
        </aside>

        <section className="content">
          <header className="hero-card">
            <div>
              <span className="eyebrow">${subjectTitle}</span>
              <h1>${headline}</h1>
              <p>${summary}</p>
            </div>
            <div className="hero-badge">Control Room</div>
          </header>

          <section className="metric-grid">
            {metrics.map((metric) => (
              <article key={metric.label} className="metric-card">
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
              </article>
            ))}
          </section>

          <section className="panel-grid">
            <article className="panel">
              <div className="panel-title">Priority queue</div>
              <div className="stack-list">
                {priorities.map((item, index) => (
                  <div key={item} className="stack-row">
                    <span className="stack-index">0{index + 1}</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </article>
            <article className="panel panel-accent">
              <div className="panel-title panel-title-inverse">Executive updates</div>
              <div className="update-list">
                {updates.map((item) => (
                  <div key={item} className="update-row">{item}</div>
                ))}
              </div>
            </article>
          </section>
        </section>
      </section>
    </main>
  );
}`
			: variant === 'app'
				? `import { useState } from 'react';
import './styles.css';

const starterItems = ${JSON.stringify(
					features.map((feature, index) => ({
						id: `item-\${index + 1}`,
						label: `${toTitleWords(feature)} task`,
					})),
					null,
					2,
				)};

export default function App() {
  const [items, setItems] = useState(starterItems);
  const [draft, setDraft] = useState('');

  const addItem = () => {
    if (!draft.trim()) return;
    setItems((current) => [...current, { id: crypto.randomUUID(), label: draft.trim() }]);
    setDraft('');
  };

  return (
    <main className="prototype-shell" style={{ '--accent': '${palette.accent}', '--page-bg': '${palette.background}' }}>
      <section className="app-frame landing-frame">
        <header className="nav-bar">
          <div className="brand-lockup">
            <div className="brand-mark">${brand
						.split(/\s+/)
						.map((word) => word[0])
						.join('')
						.slice(0, 2)}</div>
            <div>
              <div className="eyebrow">Interactive app</div>
              <div className="brand-name">${brand}</div>
            </div>
          </div>
          <div className="hero-badge">Prototype</div>
        </header>

        <section className="hero-card hero-card--landing">
          <div>
            <span className="eyebrow">${subjectTitle}</span>
            <h1>${headline}</h1>
            <p>${summary}</p>
          </div>
          <div className="hero-panel">
            <div className="hero-panel-title">Live editor</div>
            <div className="app-editor">
              <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Add an item" />
              <button type="button" className="primary-button" onClick={addItem}>Add</button>
            </div>
            <div className="app-list">
              {items.map((item) => (
                <div key={item.id} className="proof-row">{item.label}</div>
              ))}
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}`
				: `import './styles.css';

const features = ${JSON.stringify(
						features.map((feature) => ({
							title: toTitleWords(feature),
							copy: `Built to improve ${feature} outcomes with faster execution and cleaner collaboration.`,
						})),
						null,
						2,
					)};
const proofPoints = ${JSON.stringify(
						[
							`Teams adopt ${brand} in under 14 days`,
							`${brand} shortens planning cycles by 32%`,
							`Customers use ${subject.toLowerCase()} workflows daily`,
						],
						null,
						2,
					)};

export default function App() {
  return (
    <main className="prototype-shell" style={{ '--accent': '${palette.accent}', '--page-bg': '${palette.background}' }}>
      <section className="app-frame landing-frame">
        <header className="nav-bar">
          <div className="brand-lockup">
            <div className="brand-mark">${brand
							.split(/\s+/)
							.map((word) => word[0])
							.join('')
							.slice(0, 2)}</div>
            <div>
              <div className="eyebrow">${subjectTitle}</div>
              <div className="brand-name">${brand}</div>
            </div>
          </div>
          <button type="button" className="primary-button">Book Demo</button>
        </header>

        <section className="hero-card hero-card--landing">
          <div>
            <span className="eyebrow">Conversion-ready website</span>
            <h1>${headline}</h1>
            <p>${summary}</p>
            <div className="hero-actions">
              <button type="button" className="primary-button">Start Free</button>
              <button type="button" className="secondary-button">See the tour</button>
            </div>
          </div>
          <div className="hero-panel">
            <div className="hero-panel-title">Why teams choose ${brand}</div>
            {proofPoints.map((item) => (
              <div key={item} className="proof-row">{item}</div>
            ))}
          </div>
        </section>

        <section className="feature-grid">
          {features.map((feature) => (
            <article key={feature.title} className="feature-card">
              <span className="feature-kicker">${subjectTitle}</span>
              <h2>{feature.title}</h2>
              <p>{feature.copy}</p>
            </article>
          ))}
        </section>

        <section className="cta-band">
          <div>
            <span className="eyebrow">Ready to launch</span>
            <h2>Turn ${subject.toLowerCase()} into a clearer growth story.</h2>
          </div>
          <button type="button" className="primary-button">Create Your Site</button>
        </section>
      </section>
    </main>
  );
}`;
	const css = `* {
  box-sizing: border-box;
}

:root {
  font-family: 'Inter', ui-sans-serif, system-ui, sans-serif;
  color: #0f172a;
}

html,
body,
#root {
  min-height: 100%;
}

body {
  margin: 0;
  overflow: hidden;
  background: #f8fafc;
}

button {
  border: 0;
  cursor: pointer;
}

.prototype-shell {
  min-height: 100%;
  padding: 14px;
  background: var(--page-bg);
}

.app-frame {
  width: 100%;
  min-height: calc(100vh - 28px);
  border-radius: 28px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(255, 255, 255, 0.88);
  box-shadow: 0 28px 80px rgba(15, 23, 42, 0.12);
  overflow: hidden;
}

.landing-frame {
  display: grid;
  grid-template-rows: auto auto auto auto;
  gap: 18px;
  padding: 18px;
}

.dashboard-frame {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
}

.nav-bar,
.hero-card,
.metric-grid,
.panel-grid,
.feature-grid,
.cta-band {
  position: relative;
}

.nav-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.brand-lockup {
  display: flex;
  align-items: center;
  gap: 12px;
}

.brand-mark {
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  border-radius: 16px;
  background: #0f172a;
  color: white;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.eyebrow,
.feature-kicker,
.panel-title {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #64748b;
}

.brand-name {
  margin-top: 4px;
  font-size: 15px;
  font-weight: 700;
}

.primary-button,
.secondary-button,
.hero-badge,
.sidebar-chip {
  border-radius: 999px;
  padding: 12px 16px;
  font-weight: 700;
}

.primary-button {
  background: var(--accent);
  color: white;
}

.secondary-button {
  background: white;
  color: #0f172a;
  border: 1px solid rgba(15, 23, 42, 0.12);
}

.hero-card {
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  gap: 18px;
  border-radius: 24px;
  border: 1px solid rgba(148, 163, 184, 0.14);
  background: linear-gradient(160deg, rgba(255,255,255,0.94), rgba(255,255,255,0.72));
  padding: 22px;
}

.hero-card--landing {
  align-items: stretch;
}

h1,
h2 {
  margin: 10px 0 0;
  line-height: 0.98;
}

h1 {
  max-width: 12ch;
  font-size: 42px;
}

h2 {
  font-size: 24px;
}

p {
  margin: 12px 0 0;
  color: #475569;
  line-height: 1.55;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 20px;
}

.hero-panel,
.feature-card,
.metric-card,
.panel,
.cta-band,
.sidebar-panel {
  border-radius: 22px;
  border: 1px solid rgba(148, 163, 184, 0.14);
  background: rgba(255, 255, 255, 0.9);
  padding: 18px;
}

.hero-panel-title {
  font-size: 13px;
  font-weight: 700;
  margin-bottom: 12px;
}

.proof-row,
.stack-row,
.update-row {
  padding: 12px 14px;
  border-radius: 16px;
  background: #f8fafc;
}

.proof-row + .proof-row,
.update-row + .update-row {
  margin-top: 10px;
}

.app-editor {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
}

.app-editor input {
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: 14px;
  padding: 12px 14px;
  font: inherit;
}

.app-list {
  display: grid;
  gap: 10px;
  margin-top: 14px;
}

.feature-grid,
.metric-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.cta-band {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  background: color-mix(in srgb, var(--accent) 12%, white);
}

.sidebar {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 18px;
  background: rgba(248, 250, 252, 0.84);
  border-right: 1px solid rgba(148, 163, 184, 0.14);
}

.sidebar-copy {
  font-size: 13px;
  line-height: 1.5;
  color: #475569;
}

.sidebar-panel {
  display: grid;
  gap: 10px;
}

.sidebar-panel span {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #64748b;
}

.sidebar-chip {
  background: color-mix(in srgb, var(--accent) 12%, white);
  color: var(--accent);
  text-align: left;
}

.content {
  display: grid;
  grid-template-rows: auto auto 1fr;
  gap: 16px;
  padding: 18px;
}

.hero-badge {
  display: inline-flex;
  align-items: center;
  height: fit-content;
  background: color-mix(in srgb, var(--accent) 14%, white);
  color: var(--accent);
}

.metric-card span,
.panel-title {
  color: #64748b;
}

.metric-card strong {
  display: block;
  margin-top: 10px;
  font-size: 28px;
}

.panel-grid {
  display: grid;
  grid-template-columns: 1.05fr 0.95fr;
  gap: 14px;
}

.panel-accent {
  background: var(--accent);
  color: white;
}

.panel-title-inverse {
  color: rgba(255, 255, 255, 0.84);
}

.stack-list,
.update-list {
  display: grid;
  gap: 10px;
  margin-top: 14px;
}

.stack-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.stack-index {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: white;
  color: #64748b;
  font-size: 10px;
  font-weight: 800;
}

@media (max-width: 860px) {
  body {
    overflow: auto;
  }

  .dashboard-frame,
  .hero-card,
  .feature-grid,
  .metric-grid,
  .panel-grid,
  .cta-band {
    grid-template-columns: 1fr;
  }

  .dashboard-frame {
    display: block;
  }
}
`;
	const base = normalizePrototypeOverlay({
		title:
			variant === 'dashboard'
				? `${brand} Dashboard`
				: variant === 'app'
					? `${brand} App`
					: `${brand} Website`,
		template,
	});

	return normalizePrototypeOverlay({
		...base,
		title:
			variant === 'dashboard'
				? `${brand} Dashboard`
				: variant === 'app'
					? `${brand} App`
					: `${brand} Website`,
		dependencies: {},
		activeFile: '/App.jsx',
		files: {
			...base.files,
			'/App.jsx': createPrototypeFile(jsx),
			'/index.jsx': createPrototypeFile(base.files['/index.jsx']?.code ?? '', { hidden: true }),
			'/styles.css': createPrototypeFile(css),
		},
		preview: {
			eyebrow:
				variant === 'dashboard'
					? 'Live workspace'
					: variant === 'app'
						? 'Interactive app'
						: 'Prototype website',
			title:
				variant === 'dashboard'
					? `${brand} Dashboard`
					: variant === 'app'
						? `${brand} App`
						: `${brand} Website`,
			description: summary,
			accent: palette.accent,
			background: palette.background,
			badges,
			metrics,
		},
	});
}
