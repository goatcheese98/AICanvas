import { describe, expect, it } from 'vitest';
import {
	DEFAULT_MARKDOWN_NOTE_SETTINGS,
	normalizeKanbanOverlay,
	normalizeMarkdownOverlay,
	normalizeMarkdownSettings,
	normalizeNewLexOverlay,
	normalizePrototypeOverlay,
	normalizeWebEmbedOverlay,
	summarizeKanbanOverlay,
} from './overlay';

describe('overlay schemas', () => {
	it('normalizes markdown note settings with defaults and bounds', () => {
		expect(normalizeMarkdownSettings()).toEqual(DEFAULT_MARKDOWN_NOTE_SETTINGS);
		expect(
			normalizeMarkdownSettings({
				font: 'Mono',
				fontSize: 0,
				background: '#fff',
				lineHeight: 0.5,
				inlineCodeColor: '#ff0000',
				showEmptyLines: false,
				autoHideToolbar: true,
			}),
		).toEqual({
			font: 'Mono',
			fontSize: 8,
			background: '#fff',
			lineHeight: 1.2,
			inlineCodeColor: '#ff0000',
			showEmptyLines: false,
			autoHideToolbar: true,
		});
		expect(
			normalizeMarkdownSettings({
				font: 'Mono',
				fontSize: 999,
				background: '#fff',
				lineHeight: 0.5,
				inlineCodeColor: '#ff0000',
				showEmptyLines: false,
				autoHideToolbar: true,
			}),
		).toEqual({
			font: 'Mono',
			fontSize: 28,
			background: '#fff',
			lineHeight: 1.2,
			inlineCodeColor: '#ff0000',
			showEmptyLines: false,
			autoHideToolbar: true,
		});
	});

	it('normalizes markdown overlay payloads', () => {
		expect(
			normalizeMarkdownOverlay({
				content: '# Title',
				images: { one: 'data:image/png;base64,abc' },
			}),
		).toEqual({
			type: 'markdown',
			title: 'Markdown',
			content: '# Title',
			images: { one: 'data:image/png;base64,abc' },
			settings: DEFAULT_MARKDOWN_NOTE_SETTINGS,
			editorMode: 'raw',
		});
	});

	it('normalizes markdown title length and markdown settings defaults together', () => {
		expect(
			normalizeMarkdownOverlay({
				title: '  Strategy  ',
				content: 'Hello',
				settings: {
					font: 'Nunito, sans-serif',
					fontSize: 16,
					background: '#fff',
					lineHeight: 1.5,
					inlineCodeColor: '#2563eb',
					showEmptyLines: false,
					autoHideToolbar: true,
				},
			}),
		).toMatchObject({
			type: 'markdown',
			title: 'Strategy',
			content: 'Hello',
			editorMode: 'raw',
			settings: {
				showEmptyLines: false,
				autoHideToolbar: true,
			},
		});
	});

	it('normalizes newlex overlay payloads', () => {
		expect(
			normalizeNewLexOverlay({
				lexicalState: '{"root":{}}',
			}),
		).toMatchObject({
			type: 'newlex',
			title: 'Rich Text',
			lexicalState: '{"root":{}}',
			comments: [],
			commentsPanelOpen: false,
			version: 1,
		});
	});

	it('normalizes kanban overlay payloads and fills defaults', () => {
		const normalized = normalizeKanbanOverlay({
			title: 'Roadmap',
			columns: [{ title: 'Todo', cards: [{ title: 'Ship it' }] }] as NonNullable<
				Parameters<typeof normalizeKanbanOverlay>[0]
			>['columns'],
		});

		expect(normalized).toMatchObject({
			type: 'kanban',
			title: 'Roadmap',
		});
		expect(normalized.columns[0]).toMatchObject({
			title: 'Todo',
		});
		expect(normalized.columns[0]?.cards[0]).toMatchObject({
			title: 'Ship it',
			priority: 'medium',
		});
	});

	it('provides a starter kanban template when no columns are supplied', () => {
		const normalized = normalizeKanbanOverlay({});
		expect(normalized.columns).toHaveLength(3);
		expect(normalized.columns.some((column) => column.cards.length > 0)).toBe(true);
	});

	it('summarizes kanban overlays into AI-friendly board stats', () => {
		const summary = summarizeKanbanOverlay({
			title: 'Launch board',
			columns: [
				{
					id: 'todo',
					title: 'To Do',
					cards: [
						{
							id: 'card-1',
							title: 'Ship docs',
							description: 'Draft release notes',
							priority: 'high',
							labels: ['docs', 'launch'],
							checklist: [
								{ text: 'Outline', done: true },
								{ text: 'Review', done: false },
							],
						},
					],
				},
				{
					id: 'done',
					title: 'Done',
					cards: [],
				},
			],
		});

		expect(summary).toMatchObject({
			title: 'Launch board',
			columnCount: 2,
			cardCount: 1,
			emptyColumnCount: 1,
			cardsWithDescriptions: 1,
			completedChecklistItemCount: 1,
			totalChecklistItemCount: 2,
			priorityCounts: {
				low: 0,
				medium: 0,
				high: 1,
			},
			labels: ['docs', 'launch'],
		});
		expect(summary.columns[0]?.cards[0]).toMatchObject({
			title: 'Ship docs',
			priority: 'high',
			hasDescription: true,
		});
	});

	it('normalizes web embed payloads', () => {
		expect(normalizeWebEmbedOverlay({ url: 'https://example.com' })).toEqual({
			type: 'web-embed',
			url: 'https://example.com',
		});
	});

	it('normalizes prototype payloads with default react files', () => {
		const normalized = normalizePrototypeOverlay({});

		expect(normalized).toMatchObject({
			type: 'prototype',
			title: 'Prototype',
			template: 'react',
			dependencies: {},
			preview: {
				eyebrow: 'PulseBoard',
				title: 'Prototype',
			},
			activeFile: '/App.jsx',
			showEditor: true,
			showPreview: true,
		});
		expect(normalized.files['/App.jsx']?.active).toBe(true);
		expect(normalized.files['/styles.css']).toBeDefined();
		expect(normalized.files['/styles.css']?.code).toContain('overflow-y: auto;');
		expect(normalized.files['/styles.css']?.code).toContain('min-height: calc(100vh - 24px);');
		expect(normalized.files['/index.jsx']?.code).toContain(
			"import { createRoot } from 'react-dom/client';",
		);
		expect(normalized.files['/index.jsx']?.code).toContain('const root = createRoot(container);');
		expect(normalized.files['/index.jsx']?.hidden).toBe(true);
		expect(normalized.files['/index.html']).toBeUndefined();
		expect(normalized.files['/package.json']).toBeUndefined();
		expect(normalized.files['/vite.config.js']).toBeUndefined();
		expect(normalized.files['/public/index.html']).toBeUndefined();
	});

	it('repairs the legacy react entry file used by early prototype studio sandboxes', () => {
		const normalized = normalizePrototypeOverlay({
			template: 'react',
			files: {
				'/index.js': {
					code: "import React, { StrictMode } from 'react';\nimport { createRoot } from 'react-dom/client';\nimport './styles.css';\n\nimport App from './App';\n\nconst root = createRoot(document.getElementById('root'));\nroot.render(\n  <StrictMode>\n    <App />\n  </StrictMode>\n);\n",
					hidden: true,
				},
				'/App.js': {
					code: 'export default function App() { return <div>Hello</div>; }',
					active: true,
				},
				'/styles.css': {
					code: 'body { margin: 0; }',
				},
			},
		});

		expect(normalized.files['/index.jsx']?.code).toContain(
			"import { createRoot } from 'react-dom/client';",
		);
		expect(normalized.files['/index.jsx']?.code).toContain('const root = createRoot(container);');
		expect(normalized.files['/index.html']).toBeUndefined();
		expect(normalized.files['/package.json']).toBeUndefined();
		expect(normalized.files['/vite.config.js']).toBeUndefined();
	});

	it('strips legacy CRA runtime files from the custom runtime schema', () => {
		const normalized = normalizePrototypeOverlay({
			template: 'react',
			files: {
				'/index.js': {
					code: "import React, { StrictMode } from 'react';\nimport { createRoot } from 'react-dom/client';\nimport './styles.css';\n\nimport App from './App';\n\nconst container = document.getElementById('root');\n\nif (container) {\n  const root = window.__prototypeStudioRoot ?? createRoot(container);\n  window.__prototypeStudioRoot = root;\n  root.render(\n    <StrictMode>\n      <App />\n    </StrictMode>\n  );\n}\n",
					hidden: true,
				},
				'/App.js': {
					code: 'export default function App() { return <div>Hello</div>; }',
					active: true,
				},
				'/styles.css': {
					code: 'body { margin: 0; }',
				},
				'/public/index.html': {
					code: '<div id="root"></div>',
					hidden: true,
				},
				'/package.json': {
					code: '{"dependencies":{"react":"^19.0.0","react-dom":"^19.0.0","react-scripts":"^5.0.0"},"main":"/index.js"}',
					hidden: true,
				},
			},
		});

		expect(normalized.files['/public/index.html']).toBeUndefined();
		expect(normalized.files['/App.js']).toBeUndefined();
		expect(normalized.files['/index.js']).toBeUndefined();
		expect(normalized.files['/App.jsx']?.code).toContain('Hello');
		expect(normalized.files['/index.jsx']?.code).toContain('const root = createRoot(container);');
		expect(normalized.files['/index.html']).toBeUndefined();
		expect(normalized.files['/package.json']).toBeUndefined();
		expect(normalized.files['/vite.config.js']).toBeUndefined();
	});

	it('migrates the legacy react starter to the compact preview-friendly starter', () => {
		const normalized = normalizePrototypeOverlay({
			template: 'react',
			files: {
				'/App.js': {
					code: "import './styles.css';\nimport { useState } from 'react';\n\nconst views = {\n  launch: {\n    accent: '#fb7185',\n    background: 'linear-gradient(145deg, #fff1f2, #ffe4e6 42%, #fef3c7)',\n    status: 'Launch review',\n    revenue: '$84k',\n    conversion: '6.8%',\n    tasks: [\n      'Refine onboarding walkthrough',\n      'Finalize hero animation timings',\n      'Publish launch checklist',\n    ],\n  },\n  pipeline: {\n    accent: '#2563eb',\n    background: 'linear-gradient(145deg, #eff6ff, #dbeafe 42%, #e0f2fe)',\n    status: 'Pipeline health',\n    revenue: '$128k',\n    conversion: '8.2%',\n    tasks: [\n      'Review AI lead scoring',\n      'Approve enterprise upsell deck',\n      'Tighten conversion funnel copy',\n    ],\n  },\n  ops: {\n    accent: '#0f766e',\n    background: 'linear-gradient(145deg, #ecfeff, #ccfbf1 42%, #dcfce7)',\n    status: 'Ops pulse',\n    revenue: '$63k',\n    conversion: '4.9%',\n    tasks: [\n      'Investigate support queue spike',\n      'Sync launch blockers with design',\n      'Close sprint QA sweep',\n    ],\n  },\n};\n\nconst tabs = Object.keys(views);\n\nexport default function App() {\n  const [activeTab, setActiveTab] = useState('pipeline');\n  const activeView = views[activeTab];\n\n  return (\n    <main className=\"prototype-shell\" style={{ background: activeView.background }}>\n      <section className=\"dashboard-frame\">\n        <aside className=\"sidebar\">\n          <div>\n            <div className=\"logo\">PB</div>\n            <div className=\"sidebar-label\">PulseBoard</div>\n          </div>\n          <div className=\"sidebar-stack\">\n            {tabs.map((tab) => (\n              <button\n                key={tab}\n                type=\"button\"\n                className={`nav-pill ${tab === activeTab ? 'is-active' : ''}`}\n                style={tab === activeTab ? { '--accent': activeView.accent } : undefined}\n                onClick={() => setActiveTab(tab)}\n              >\n                {tab}\n              </button>\n            ))}\n          </div>\n        </aside>\n\n        <div className=\"content-shell\">\n          <header className=\"hero-card\">\n            <div>\n              <span className=\"hero-kicker\">Product command center</span>\n              <h1>Ship a sharper launch narrative in one place.</h1>\n              <p>\n                Coordinate launch readiness, track conversion health, and keep the team aligned with\n                one decisive control room.\n              </p>\n            </div>\n            <div className=\"hero-actions\">\n              <button type=\"button\" style={{ backgroundColor: activeView.accent }}>\n                Review plan\n              </button>\n              <span className=\"hero-status\" style={{ color: activeView.accent, borderColor: activeView.accent }}>\n                {activeView.status}\n              </span>\n            </div>\n          </header>\n\n          <section className=\"metric-grid\">\n            <article className=\"metric-card\">\n              <span>Projected revenue</span>\n              <strong>{activeView.revenue}</strong>\n              <small>+12% vs last cycle</small>\n            </article>\n            <article className=\"metric-card\">\n              <span>Conversion lift</span>\n              <strong>{activeView.conversion}</strong>\n              <small>Most impact from onboarding</small>\n            </article>\n            <article className=\"metric-card metric-card--accent\" style={{ backgroundColor: activeView.accent }}>\n              <span>Critical blockers</span>\n              <strong>03</strong>\n              <small>Two design, one QA</small>\n            </article>\n          </section>\n\n          <section className=\"board-grid\">\n            <article className=\"panel\">\n              <div className=\"panel-title\">Priorities</div>\n              <div className=\"task-list\">\n                {activeView.tasks.map((task, index) => (\n                  <div key={task} className=\"task-row\">\n                    <span className=\"task-index\">0{index + 1}</span>\n                    <span>{task}</span>\n                  </div>\n                ))}\n              </div>\n            </article>\n            <article className=\"panel panel--spotlight\">\n              <div className=\"panel-title\">Executive summary</div>\n              <div className=\"summary-card\">\n                <div className=\"summary-ring\" style={{ '--accent': activeView.accent }}>\n                  <span>82</span>\n                </div>\n                <div>\n                  <h2>Launch confidence</h2>\n                  <p>Momentum is strong, but activation copy and sprint QA still need a final pass.</p>\n                </div>\n              </div>\n            </article>\n          </section>\n        </div>\n      </section>\n    </main>\n",
				},
				'/styles.css': {
					code: "* {\n  box-sizing: border-box;\n}\n\n:root {\n  font-family: 'Inter', ui-sans-serif, system-ui, sans-serif;\n  color: #0f172a;\n}\n\nbody {\n  margin: 0;\n}\n\nbutton {\n  border: 0;\n  border-radius: 999px;\n  padding: 12px 18px;\n  color: #fff;\n  font-weight: 700;\n  cursor: pointer;\n}\n\n.prototype-shell {\n  min-height: 100vh;\n  display: grid;\n  place-items: center;\n  padding: 28px;\n}\n\n.dashboard-frame {\n  width: min(100%, 1040px);\n  min-height: 680px;\n  display: grid;\n  grid-template-columns: 220px 1fr;\n  background: rgba(255, 255, 255, 0.82);\n  border: 1px solid rgba(15, 23, 42, 0.08);\n  border-radius: 32px;\n  overflow: hidden;\n  box-shadow: 0 36px 120px rgba(15, 23, 42, 0.16);\n  backdrop-filter: blur(16px);\n}\n\n.sidebar {\n  display: flex;\n  flex-direction: column;\n  justify-content: space-between;\n  padding: 24px;\n  background: rgba(248, 250, 252, 0.82);\n  border-right: 1px solid rgba(148, 163, 184, 0.14);\n}\n\n.logo {\n  width: 48px;\n  height: 48px;\n  display: grid;\n  place-items: center;\n  border-radius: 16px;\n  background: #0f172a;\n  color: white;\n  font-weight: 800;\n  letter-spacing: 0.08em;\n}\n\n.sidebar-label {\n  margin-top: 14px;\n  font-size: 13px;\n  font-weight: 700;\n  letter-spacing: 0.16em;\n  text-transform: uppercase;\n  color: #64748b;\n}\n\n.sidebar-stack {\n  display: flex;\n  flex-direction: column;\n  gap: 10px;\n}\n\n.nav-pill {\n  width: 100%;\n  padding: 12px 14px;\n  border-radius: 16px;\n  background: white;\n  color: #334155;\n  text-transform: capitalize;\n  border: 1px solid rgba(148, 163, 184, 0.18);\n}\n\n.nav-pill.is-active {\n  background: color-mix(in srgb, var(--accent) 15%, white);\n  color: var(--accent);\n}\n\n.content-shell {\n  padding: 26px;\n}\n\n.hero-card {\n  display: flex;\n  align-items: flex-end;\n  justify-content: space-between;\n  gap: 24px;\n  border-radius: 28px;\n  padding: 28px;\n  background: linear-gradient(160deg, rgba(255,255,255,0.94), rgba(255,255,255,0.66));\n  border: 1px solid rgba(148, 163, 184, 0.14);\n}\n\n.hero-kicker {\n  display: inline-flex;\n  margin-bottom: 14px;\n  border-radius: 999px;\n  padding: 6px 10px;\n  background: rgba(15, 23, 42, 0.08);\n  font-size: 11px;\n  font-weight: 700;\n  letter-spacing: 0.16em;\n  text-transform: uppercase;\n}\n\nh1 {\n  margin: 0;\n  max-width: 14ch;\n  font-size: 44px;\n  line-height: 0.96;\n}\n\np {\n  margin: 14px 0 0;\n  max-width: 54ch;\n  color: #475569;\n  line-height: 1.6;\n}\n\n.hero-actions {\n  display: flex;\n  flex-direction: column;\n  align-items: flex-end;\n  gap: 12px;\n}\n\n.hero-status {\n  display: inline-flex;\n  border: 1px solid currentColor;\n  border-radius: 999px;\n  padding: 8px 12px;\n  font-size: 12px;\n  font-weight: 700;\n  letter-spacing: 0.08em;\n  text-transform: uppercase;\n  background: rgba(255, 255, 255, 0.74);\n}\n\n.metric-grid {\n  display: grid;\n  grid-template-columns: repeat(3, minmax(0, 1fr));\n  gap: 16px;\n  margin-top: 18px;\n}\n\n.metric-card {\n  display: flex;\n  flex-direction: column;\n  gap: 10px;\n  min-height: 150px;\n  padding: 22px;\n  border-radius: 24px;\n  background: rgba(255, 255, 255, 0.88);\n  border: 1px solid rgba(148, 163, 184, 0.14);\n}\n\n.metric-card span,\n.panel-title,\n.metric-card small {\n  color: #64748b;\n}\n\n.metric-card strong {\n  font-size: 34px;\n  line-height: 1;\n}\n\n.metric-card--accent {\n  color: white;\n}\n\n.metric-card--accent span,\n.metric-card--accent small {\n  color: rgba(255, 255, 255, 0.84);\n}\n\n.board-grid {\n  display: grid;\n  grid-template-columns: 1.15fr 0.85fr;\n  gap: 16px;\n  margin-top: 18px;\n}\n\n.panel {\n  min-height: 280px;\n  padding: 22px;\n  border-radius: 24px;\n  background: rgba(255, 255, 255, 0.88);\n  border: 1px solid rgba(148, 163, 184, 0.14);\n}\n\n.task-list {\n  display: grid;\n  gap: 12px;\n  margin-top: 20px;\n}\n\n.task-row {\n  display: flex;\n  align-items: center;\n  gap: 12px;\n  border-radius: 18px;\n  padding: 14px 16px;\n  background: #f8fafc;\n}\n\n.task-index {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: 34px;\n  height: 34px;\n  border-radius: 999px;\n  background: white;\n  font-size: 12px;\n  font-weight: 800;\n  color: #64748b;\n}\n\n.summary-card {\n  display: grid;\n  grid-template-columns: 120px 1fr;\n  align-items: center;\n  gap: 20px;\n  margin-top: 26px;\n}\n\n.summary-ring {\n  --accent: #2563eb;\n  width: 120px;\n  height: 120px;\n  display: grid;\n  place-items: center;\n  border-radius: 999px;\n  background: radial-gradient(circle at center, white 54%, transparent 55%),\n    conic-gradient(var(--accent) 0 295deg, rgba(226, 232, 240, 0.9) 295deg 360deg);\n}\n\n.summary-ring span {\n  font-size: 28px;\n  font-weight: 800;\n}\n\nh2 {\n  margin: 0 0 8px;\n  font-size: 24px;\n}\n",
				},
			},
		});

		expect(normalized.files['/App.jsx']?.code).toContain('compact-frame');
		expect(normalized.files['/styles.css']?.code).toContain('.compact-frame');
		expect(normalized.files['/App.jsx']?.code).not.toContain('dashboard-frame');
		expect(normalized.files['/styles.css']?.code).not.toContain('.dashboard-frame');
	});
});
