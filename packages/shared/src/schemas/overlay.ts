import * as z from 'zod';
import { OVERLAY_TYPES } from '../constants';
import type { OverlayCustomData } from '../types';

export const MARKDOWN_SYSTEM_FONT_STACK =
	'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

export const DEFAULT_MARKDOWN_NOTE_SETTINGS = {
	font: 'Nunito, "Segoe UI Emoji", sans-serif',
	fontSize: 15,
	background: '#ffffff',
	lineHeight: 1.65,
	inlineCodeColor: '#334155',
	showEmptyLines: true,
	autoHideToolbar: false,
} as const;

export const markdownEditorModeSchema = z.enum(['raw', 'hybrid']);

export const markdownNoteSettingsSchema = z.object({
	font: z.string().trim().min(1).max(160).default(DEFAULT_MARKDOWN_NOTE_SETTINGS.font),
	fontSize: z
		.coerce
		.number()
		.transform((value) => Math.min(28, Math.max(12, value)))
		.default(DEFAULT_MARKDOWN_NOTE_SETTINGS.fontSize),
	background: z
		.string()
		.trim()
		.min(1)
		.max(32)
		.default(DEFAULT_MARKDOWN_NOTE_SETTINGS.background),
	lineHeight: z
		.coerce
		.number()
		.transform((value) => Math.min(2.2, Math.max(1.2, value)))
		.default(DEFAULT_MARKDOWN_NOTE_SETTINGS.lineHeight),
	inlineCodeColor: z
		.string()
		.trim()
		.regex(/^#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/)
		.default(DEFAULT_MARKDOWN_NOTE_SETTINGS.inlineCodeColor),
	showEmptyLines: z.coerce.boolean().default(DEFAULT_MARKDOWN_NOTE_SETTINGS.showEmptyLines),
	autoHideToolbar: z.coerce.boolean().default(DEFAULT_MARKDOWN_NOTE_SETTINGS.autoHideToolbar),
});

export const markdownOverlaySchema = z.object({
	type: z.literal('markdown'),
	title: z.string().trim().min(1).max(8).default('Markdown'),
	content: z.string().default(''),
	images: z.record(z.string(), z.string()).optional(),
	settings: markdownNoteSettingsSchema.optional(),
	editorMode: markdownEditorModeSchema.optional(),
});

export const newLexCommentReplySchema = z.object({
	id: z.string().trim().min(1).default(() => crypto.randomUUID()),
	author: z.string().trim().min(1).default('You'),
	message: z.string().default(''),
	createdAt: z.coerce.number().default(() => Date.now()),
	deleted: z.boolean().optional(),
});

export const newLexCommentThreadSchema = z.object({
	id: z.string().trim().min(1).default(() => crypto.randomUUID()),
	author: z.string().trim().min(1).default('You'),
	comment: z.string().default(''),
	commentDeleted: z.boolean().optional(),
	anchorText: z.string().default(''),
	createdAt: z.coerce.number().default(() => Date.now()),
	resolved: z.boolean().default(false),
	collapsed: z.boolean().default(false),
	replies: z.array(newLexCommentReplySchema).default([]),
});

export const newLexOverlaySchema = z.object({
	type: z.literal('newlex'),
	title: z.string().trim().min(1).max(32).default('Rich Text'),
	lexicalState: z.string().default(''),
	comments: z.array(newLexCommentThreadSchema).optional(),
	commentsPanelOpen: z.boolean().optional(),
	version: z.coerce.number().default(1),
});

export const kanbanChecklistItemSchema = z.object({
	text: z.string().default(''),
	done: z.boolean().default(false),
});

export const kanbanCardSchema = z.object({
	id: z.string().trim().min(1).default(() => crypto.randomUUID()),
	title: z.string().trim().min(1).default('Untitled card'),
	description: z.string().default(''),
	priority: z.enum(['low', 'medium', 'high']).default('medium'),
	labels: z.array(z.string()).default([]),
	dueDate: z.string().optional(),
	checklist: z.array(kanbanChecklistItemSchema).default([]),
});

export const kanbanColumnSchema = z.object({
	id: z.string().trim().min(1).default(() => crypto.randomUUID()),
	title: z.string().trim().min(1).default('Column'),
	color: z.string().optional(),
	wipLimit: z.coerce.number().optional(),
	cards: z.array(kanbanCardSchema).default([]),
});

export const kanbanOverlaySchema = z.object({
	type: z.literal('kanban'),
	title: z.string().trim().min(1).default('Kanban Board'),
	columns: z.array(kanbanColumnSchema).default([]),
	theme: z.enum(['sketch', 'clean']).optional(),
	bgTheme: z.string().optional(),
	fontId: z.string().optional(),
	fontSize: z
		.coerce
		.number()
		.transform((value) => Math.min(18, Math.max(12, value)))
		.optional(),
});

const KANBAN_PRIORITY_VALUES = ['low', 'medium', 'high'] as const;

function isKanbanDueDateOverdue(dueDate?: string): boolean {
	if (!dueDate) {
		return false;
	}

	const parsed = new Date(`${dueDate}T23:59:59`);
	if (Number.isNaN(parsed.getTime())) {
		return false;
	}

	return parsed.getTime() < Date.now();
}

export function createStarterKanbanColumns(): z.infer<typeof kanbanOverlaySchema>['columns'] {
	return [
		{
			id: crypto.randomUUID(),
			title: 'To Do',
			color: '#6965db',
			cards: [
				{
					id: crypto.randomUUID(),
					title: 'Capture the goal',
					description: 'Write down what this board is helping you ship before you add more cards.',
					priority: 'medium',
					labels: ['setup'],
					checklist: [
						{ text: 'Name the outcome', done: false },
						{ text: 'Note the deadline', done: false },
					],
				},
				{
					id: crypto.randomUUID(),
					title: 'List the next actions',
					description: 'Break the work into concrete cards so the first move is obvious.',
					priority: 'low',
					labels: ['planning'],
					checklist: [],
				},
			],
		},
		{
			id: crypto.randomUUID(),
			title: 'In Progress',
			color: '#c28a42',
			cards: [
				{
					id: crypto.randomUUID(),
					title: 'Shape the first pass',
					description: 'Use this lane for the card you are actively moving right now.',
					priority: 'high',
					labels: ['focus'],
					checklist: [
						{ text: 'Finish the rough draft', done: true },
						{ text: 'Review the flow', done: false },
					],
				},
			],
		},
		{
			id: crypto.randomUUID(),
			title: 'Done',
			color: '#557768',
			cards: [
				{
					id: crypto.randomUUID(),
					title: 'Board ready',
					description: 'Keep a finished card here so new boards do not feel empty.',
					priority: 'low',
					labels: ['starter'],
					checklist: [{ text: 'Starter template loaded', done: true }],
				},
			],
		},
	];
}

export const webEmbedOverlaySchema = z.object({
	type: z.literal('web-embed'),
	url: z.string().default(''),
});

export const prototypeTemplateSchema = z.enum(['react', 'vanilla']);

export const prototypeOverlayFileSchema = z.object({
	code: z.string().default(''),
	active: z.boolean().optional(),
	hidden: z.boolean().optional(),
	readOnly: z.boolean().optional(),
});

export const prototypeCardMetricSchema = z.object({
	label: z.string().trim().min(1).max(24).default('Metric'),
	value: z.string().trim().min(1).max(24).default('0'),
});

export const prototypeCardPreviewSchema = z.object({
	eyebrow: z.string().trim().min(1).max(24).default('Prototype'),
	title: z.string().trim().min(1).max(48).default('Launch cockpit'),
	description: z.string().trim().min(1).max(140).default('A polished interactive concept.'),
	accent: z.string().trim().min(1).max(32).default('#3b82f6'),
	background: z.string().trim().min(1).max(160).default('linear-gradient(135deg, #eff6ff, #eef2ff)'),
	badges: z.array(z.string().trim().min(1).max(24)).max(5).default([]),
	metrics: z.array(prototypeCardMetricSchema).max(4).default([]),
});

export const prototypeOverlaySchema = z.object({
	type: z.literal('prototype'),
	title: z.string().trim().min(1).max(32).default('Prototype'),
	template: prototypeTemplateSchema.default('react'),
	files: z.record(z.string(), prototypeOverlayFileSchema).default({}),
	dependencies: z.record(z.string(), z.string()).optional(),
	preview: prototypeCardPreviewSchema.optional(),
	activeFile: z.string().trim().min(1).optional(),
	showEditor: z.boolean().optional(),
	showPreview: z.boolean().optional(),
});

export const overlayCustomDataSchema = z.discriminatedUnion('type', [
	markdownOverlaySchema,
	newLexOverlaySchema,
	kanbanOverlaySchema,
	webEmbedOverlaySchema,
	prototypeOverlaySchema,
]);

const LEGACY_REACT_PROTOTYPE_APP_CODE =
	"import './styles.css';\nimport { useState } from 'react';\n\nconst views = {\n  launch: {\n    accent: '#fb7185',\n    background: 'linear-gradient(145deg, #fff1f2, #ffe4e6 42%, #fef3c7)',\n    status: 'Launch review',\n    revenue: '$84k',\n    conversion: '6.8%',\n    tasks: [\n      'Refine onboarding walkthrough',\n      'Finalize hero animation timings',\n      'Publish launch checklist',\n    ],\n  },\n  pipeline: {\n    accent: '#2563eb',\n    background: 'linear-gradient(145deg, #eff6ff, #dbeafe 42%, #e0f2fe)',\n    status: 'Pipeline health',\n    revenue: '$128k',\n    conversion: '8.2%',\n    tasks: [\n      'Review AI lead scoring',\n      'Approve enterprise upsell deck',\n      'Tighten conversion funnel copy',\n    ],\n  },\n  ops: {\n    accent: '#0f766e',\n    background: 'linear-gradient(145deg, #ecfeff, #ccfbf1 42%, #dcfce7)',\n    status: 'Ops pulse',\n    revenue: '$63k',\n    conversion: '4.9%',\n    tasks: [\n      'Investigate support queue spike',\n      'Sync launch blockers with design',\n      'Close sprint QA sweep',\n    ],\n  },\n};\n\nconst tabs = Object.keys(views);\n\nexport default function App() {\n  const [activeTab, setActiveTab] = useState('pipeline');\n  const activeView = views[activeTab];\n\n  return (\n    <main className=\"prototype-shell\" style={{ background: activeView.background }}>\n      <section className=\"dashboard-frame\">\n        <aside className=\"sidebar\">\n          <div>\n            <div className=\"logo\">PB</div>\n            <div className=\"sidebar-label\">PulseBoard</div>\n          </div>\n          <div className=\"sidebar-stack\">\n            {tabs.map((tab) => (\n              <button\n                key={tab}\n                type=\"button\"\n                className={`nav-pill ${tab === activeTab ? 'is-active' : ''}`}\n                style={tab === activeTab ? { '--accent': activeView.accent } : undefined}\n                onClick={() => setActiveTab(tab)}\n              >\n                {tab}\n              </button>\n            ))}\n          </div>\n        </aside>\n\n        <div className=\"content-shell\">\n          <header className=\"hero-card\">\n            <div>\n              <span className=\"hero-kicker\">Product command center</span>\n              <h1>Ship a sharper launch narrative in one place.</h1>\n              <p>\n                Coordinate launch readiness, track conversion health, and keep the team aligned with\n                one decisive control room.\n              </p>\n            </div>\n            <div className=\"hero-actions\">\n              <button type=\"button\" style={{ backgroundColor: activeView.accent }}>\n                Review plan\n              </button>\n              <span className=\"hero-status\" style={{ color: activeView.accent, borderColor: activeView.accent }}>\n                {activeView.status}\n              </span>\n            </div>\n          </header>\n\n          <section className=\"metric-grid\">\n            <article className=\"metric-card\">\n              <span>Projected revenue</span>\n              <strong>{activeView.revenue}</strong>\n              <small>+12% vs last cycle</small>\n            </article>\n            <article className=\"metric-card\">\n              <span>Conversion lift</span>\n              <strong>{activeView.conversion}</strong>\n              <small>Most impact from onboarding</small>\n            </article>\n            <article className=\"metric-card metric-card--accent\" style={{ backgroundColor: activeView.accent }}>\n              <span>Critical blockers</span>\n              <strong>03</strong>\n              <small>Two design, one QA</small>\n            </article>\n          </section>\n\n          <section className=\"board-grid\">\n            <article className=\"panel\">\n              <div className=\"panel-title\">Priorities</div>\n              <div className=\"task-list\">\n                {activeView.tasks.map((task, index) => (\n                  <div key={task} className=\"task-row\">\n                    <span className=\"task-index\">0{index + 1}</span>\n                    <span>{task}</span>\n                  </div>\n                ))}\n              </div>\n            </article>\n            <article className=\"panel panel--spotlight\">\n              <div className=\"panel-title\">Executive summary</div>\n              <div className=\"summary-card\">\n                <div className=\"summary-ring\" style={{ '--accent': activeView.accent }}>\n                  <span>82</span>\n                </div>\n                <div>\n                  <h2>Launch confidence</h2>\n                  <p>Momentum is strong, but activation copy and sprint QA still need a final pass.</p>\n                </div>\n              </div>\n            </article>\n          </section>\n        </div>\n      </section>\n    </main>\n  );\n}\n";

const LEGACY_REACT_PROTOTYPE_STYLES_CODE =
	"* {\n  box-sizing: border-box;\n}\n\n:root {\n  font-family: 'Inter', ui-sans-serif, system-ui, sans-serif;\n  color: #0f172a;\n}\n\nbody {\n  margin: 0;\n}\n\nbutton {\n  border: 0;\n  border-radius: 999px;\n  padding: 12px 18px;\n  color: #fff;\n  font-weight: 700;\n  cursor: pointer;\n}\n\n.prototype-shell {\n  min-height: 100vh;\n  display: grid;\n  place-items: center;\n  padding: 28px;\n}\n\n.dashboard-frame {\n  width: min(100%, 1040px);\n  min-height: 680px;\n  display: grid;\n  grid-template-columns: 220px 1fr;\n  background: rgba(255, 255, 255, 0.82);\n  border: 1px solid rgba(15, 23, 42, 0.08);\n  border-radius: 32px;\n  overflow: hidden;\n  box-shadow: 0 36px 120px rgba(15, 23, 42, 0.16);\n  backdrop-filter: blur(16px);\n}\n\n.sidebar {\n  display: flex;\n  flex-direction: column;\n  justify-content: space-between;\n  padding: 24px;\n  background: rgba(248, 250, 252, 0.82);\n  border-right: 1px solid rgba(148, 163, 184, 0.14);\n}\n\n.logo {\n  width: 48px;\n  height: 48px;\n  display: grid;\n  place-items: center;\n  border-radius: 16px;\n  background: #0f172a;\n  color: white;\n  font-weight: 800;\n  letter-spacing: 0.08em;\n}\n\n.sidebar-label {\n  margin-top: 14px;\n  font-size: 13px;\n  font-weight: 700;\n  letter-spacing: 0.16em;\n  text-transform: uppercase;\n  color: #64748b;\n}\n\n.sidebar-stack {\n  display: flex;\n  flex-direction: column;\n  gap: 10px;\n}\n\n.nav-pill {\n  width: 100%;\n  padding: 12px 14px;\n  border-radius: 16px;\n  background: white;\n  color: #334155;\n  text-transform: capitalize;\n  border: 1px solid rgba(148, 163, 184, 0.18);\n}\n\n.nav-pill.is-active {\n  background: color-mix(in srgb, var(--accent) 15%, white);\n  color: var(--accent);\n}\n\n.content-shell {\n  padding: 26px;\n}\n\n.hero-card {\n  display: flex;\n  align-items: flex-end;\n  justify-content: space-between;\n  gap: 24px;\n  border-radius: 28px;\n  padding: 28px;\n  background: linear-gradient(160deg, rgba(255,255,255,0.94), rgba(255,255,255,0.66));\n  border: 1px solid rgba(148, 163, 184, 0.14);\n}\n\n.hero-kicker {\n  display: inline-flex;\n  margin-bottom: 14px;\n  border-radius: 999px;\n  padding: 6px 10px;\n  background: rgba(15, 23, 42, 0.08);\n  font-size: 11px;\n  font-weight: 700;\n  letter-spacing: 0.16em;\n  text-transform: uppercase;\n}\n\nh1 {\n  margin: 0;\n  max-width: 14ch;\n  font-size: 44px;\n  line-height: 0.96;\n}\n\np {\n  margin: 14px 0 0;\n  max-width: 54ch;\n  color: #475569;\n  line-height: 1.6;\n}\n\n.hero-actions {\n  display: flex;\n  flex-direction: column;\n  align-items: flex-end;\n  gap: 12px;\n}\n\n.hero-status {\n  display: inline-flex;\n  border: 1px solid currentColor;\n  border-radius: 999px;\n  padding: 8px 12px;\n  font-size: 12px;\n  font-weight: 700;\n  letter-spacing: 0.08em;\n  text-transform: uppercase;\n  background: rgba(255, 255, 255, 0.74);\n}\n\n.metric-grid {\n  display: grid;\n  grid-template-columns: repeat(3, minmax(0, 1fr));\n  gap: 16px;\n  margin-top: 18px;\n}\n\n.metric-card {\n  display: flex;\n  flex-direction: column;\n  gap: 10px;\n  min-height: 150px;\n  padding: 22px;\n  border-radius: 24px;\n  background: rgba(255, 255, 255, 0.88);\n  border: 1px solid rgba(148, 163, 184, 0.14);\n}\n\n.metric-card span,\n.panel-title,\n.metric-card small {\n  color: #64748b;\n}\n\n.metric-card strong {\n  font-size: 34px;\n  line-height: 1;\n}\n\n.metric-card--accent {\n  color: white;\n}\n\n.metric-card--accent span,\n.metric-card--accent small {\n  color: rgba(255, 255, 255, 0.84);\n}\n\n.board-grid {\n  display: grid;\n  grid-template-columns: 1.15fr 0.85fr;\n  gap: 16px;\n  margin-top: 18px;\n}\n\n.panel {\n  min-height: 280px;\n  padding: 22px;\n  border-radius: 24px;\n  background: rgba(255, 255, 255, 0.88);\n  border: 1px solid rgba(148, 163, 184, 0.14);\n}\n\n.task-list {\n  display: grid;\n  gap: 12px;\n  margin-top: 20px;\n}\n\n.task-row {\n  display: flex;\n  align-items: center;\n  gap: 12px;\n  border-radius: 18px;\n  padding: 14px 16px;\n  background: #f8fafc;\n}\n\n.task-index {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: 34px;\n  height: 34px;\n  border-radius: 999px;\n  background: white;\n  font-size: 12px;\n  font-weight: 800;\n  color: #64748b;\n}\n\n.summary-card {\n  display: grid;\n  grid-template-columns: 120px 1fr;\n  align-items: center;\n  gap: 20px;\n  margin-top: 26px;\n}\n\n.summary-ring {\n  --accent: #2563eb;\n  width: 120px;\n  height: 120px;\n  display: grid;\n  place-items: center;\n  border-radius: 999px;\n  background: radial-gradient(circle at center, white 54%, transparent 55%),\n    conic-gradient(var(--accent) 0 295deg, rgba(226, 232, 240, 0.9) 295deg 360deg);\n}\n\n.summary-ring span {\n  font-size: 28px;\n  font-weight: 800;\n}\n\nh2 {\n  margin: 0 0 8px;\n  font-size: 24px;\n}\n\n@media (max-width: 900px) {\n  .dashboard-frame {\n    grid-template-columns: 1fr;\n  }\n\n  .sidebar {\n    gap: 18px;\n    border-right: 0;\n    border-bottom: 1px solid rgba(148, 163, 184, 0.14);\n  }\n\n  .hero-card,\n  .summary-card,\n  .metric-grid,\n  .board-grid {\n    grid-template-columns: 1fr;\n  }\n\n  .hero-actions {\n    align-items: flex-start;\n  }\n}\n";

const DEFAULT_REACT_PROTOTYPE_APP_CODE =
	"import './styles.css';\nimport { useState } from 'react';\n\nconst workspaces = {\n  launch: {\n    accent: '#fb7185',\n    gradient: 'linear-gradient(145deg, #fff1f2, #ffe4e6 42%, #fef3c7)',\n    status: 'Launch review',\n    metrics: [\n      { label: 'Revenue', value: '$84k' },\n      { label: 'Conv.', value: '6.8%' },\n      { label: 'Blockers', value: '03' },\n    ],\n    tasks: ['Refine onboarding', 'Finalize hero motion', 'Publish checklist'],\n  },\n  pipeline: {\n    accent: '#2563eb',\n    gradient: 'linear-gradient(145deg, #eff6ff, #dbeafe 42%, #e0f2fe)',\n    status: 'Pipeline health',\n    metrics: [\n      { label: 'Revenue', value: '$128k' },\n      { label: 'Conv.', value: '8.2%' },\n      { label: 'Risk', value: 'Low' },\n    ],\n    tasks: ['Review AI scoring', 'Approve upsell deck', 'Tighten copy'],\n  },\n  ops: {\n    accent: '#0f766e',\n    gradient: 'linear-gradient(145deg, #ecfeff, #ccfbf1 42%, #dcfce7)',\n    status: 'Ops pulse',\n    metrics: [\n      { label: 'Revenue', value: '$63k' },\n      { label: 'Conv.', value: '4.9%' },\n      { label: 'Queue', value: '12' },\n    ],\n    tasks: ['Investigate support spike', 'Sync blockers', 'Close QA sweep'],\n  },\n};\n\nconst workspaceKeys = Object.keys(workspaces);\n\nexport default function App() {\n  const [activeKey, setActiveKey] = useState('pipeline');\n  const active = workspaces[activeKey];\n\n  return (\n    <main className=\"prototype-shell\" style={{ background: active.gradient }}>\n      <section className=\"compact-frame\">\n        <aside className=\"compact-sidebar\">\n          <div className=\"logo\">PB</div>\n          <div className=\"brand\">PulseBoard</div>\n          <div className=\"nav-stack\">\n            {workspaceKeys.map((key) => (\n              <button\n                key={key}\n                type=\"button\"\n                className={`nav-pill ${key === activeKey ? 'is-active' : ''}`}\n                style={key === activeKey ? { '--accent': active.accent } : undefined}\n                onClick={() => setActiveKey(key)}\n              >\n                {key}\n              </button>\n            ))}\n          </div>\n        </aside>\n\n        <section className=\"compact-content\">\n          <div className=\"hero-card\">\n            <div>\n              <span className=\"hero-kicker\">Product command center</span>\n              <h1>Ship a sharper launch story.</h1>\n              <p>Track metrics, spot blockers, and keep the whole launch motion aligned.</p>\n            </div>\n            <div className=\"hero-status\" style={{ color: active.accent, borderColor: active.accent }}>\n              {active.status}\n            </div>\n          </div>\n\n          <div className=\"metric-grid\">\n            {active.metrics.map((metric) => (\n              <article key={metric.label} className=\"metric-card\">\n                <span>{metric.label}</span>\n                <strong>{metric.value}</strong>\n              </article>\n            ))}\n          </div>\n\n          <div className=\"lower-grid\">\n            <article className=\"panel\">\n              <div className=\"panel-title\">Priority stack</div>\n              <div className=\"task-list\">\n                {active.tasks.map((task, index) => (\n                  <div key={task} className=\"task-row\">\n                    <span className=\"task-index\">0{index + 1}</span>\n                    <span>{task}</span>\n                  </div>\n                ))}\n              </div>\n            </article>\n            <article className=\"panel panel--accent\" style={{ backgroundColor: active.accent }}>\n              <div className=\"panel-title panel-title--inverse\">Launch confidence</div>\n              <div className=\"score\">82</div>\n              <p className=\"panel-copy panel-copy--inverse\">Momentum is strong, but activation copy and QA still need a final pass.</p>\n            </article>\n          </div>\n        </section>\n      </section>\n    </main>\n  );\n}\n";

const DEFAULT_REACT_PROTOTYPE_STYLES_CODE =
	"* {\n  box-sizing: border-box;\n}\n\n:root {\n  font-family: 'Inter', ui-sans-serif, system-ui, sans-serif;\n  color: #0f172a;\n}\n\nhtml,\nbody,\n#root {\n  min-height: 100%;\n}\n\nbody {\n  margin: 0;\n  overflow-y: auto;\n}\n\nbutton {\n  border: 0;\n  border-radius: 999px;\n  color: inherit;\n  cursor: pointer;\n}\n\n.prototype-shell {\n  min-height: 100%;\n  display: block;\n  padding: 12px;\n}\n\n.compact-frame {\n  width: 100%;\n  min-height: calc(100vh - 24px);\n  display: grid;\n  grid-template-columns: 156px minmax(0, 1fr);\n  align-items: start;\n  background: rgba(255, 255, 255, 0.82);\n  border: 1px solid rgba(15, 23, 42, 0.08);\n  border-radius: 24px;\n  overflow: hidden;\n  box-shadow: 0 22px 64px rgba(15, 23, 42, 0.12);\n  backdrop-filter: blur(14px);\n}\n\n.compact-sidebar {\n  display: flex;\n  flex-direction: column;\n  gap: 10px;\n  padding: 14px;\n  background: rgba(248, 250, 252, 0.82);\n  border-right: 1px solid rgba(148, 163, 184, 0.14);\n}\n\n.logo {\n  width: 40px;\n  height: 40px;\n  display: grid;\n  place-items: center;\n  border-radius: 14px;\n  background: #0f172a;\n  color: white;\n  font-weight: 800;\n  letter-spacing: 0.08em;\n}\n\n.brand {\n  font-size: 11px;\n  font-weight: 700;\n  letter-spacing: 0.18em;\n  text-transform: uppercase;\n  color: #64748b;\n}\n\n.nav-stack {\n  display: grid;\n  gap: 8px;\n  margin-top: 4px;\n}\n\n.nav-pill {\n  width: 100%;\n  padding: 9px 10px;\n  text-align: left;\n  background: rgba(255, 255, 255, 0.85);\n  color: #334155;\n  font-size: 12px;\n  font-weight: 600;\n  text-transform: capitalize;\n  border: 1px solid rgba(148, 163, 184, 0.18);\n}\n\n.nav-pill.is-active {\n  background: color-mix(in srgb, var(--accent) 12%, white);\n  color: var(--accent);\n}\n\n.compact-content {\n  display: grid;\n  grid-template-rows: auto auto auto;\n  gap: 10px;\n  padding: 14px;\n}\n\n.hero-card {\n  display: flex;\n  align-items: flex-start;\n  justify-content: space-between;\n  gap: 14px;\n  padding: 14px;\n  border-radius: 18px;\n  background: linear-gradient(160deg, rgba(255,255,255,0.94), rgba(255,255,255,0.72));\n  border: 1px solid rgba(148, 163, 184, 0.14);\n}\n\n.hero-kicker {\n  display: inline-flex;\n  margin-bottom: 8px;\n  padding: 5px 8px;\n  border-radius: 999px;\n  background: rgba(15, 23, 42, 0.08);\n  font-size: 9px;\n  font-weight: 700;\n  letter-spacing: 0.16em;\n  text-transform: uppercase;\n}\n\nh1 {\n  margin: 0;\n  max-width: 12ch;\n  font-size: 24px;\n  line-height: 0.94;\n}\n\np {\n  margin: 8px 0 0;\n  max-width: 34ch;\n  color: #475569;\n  line-height: 1.35;\n  font-size: 12px;\n}\n\n.hero-status {\n  padding: 6px 10px;\n  border: 1px solid currentColor;\n  border-radius: 999px;\n  background: rgba(255, 255, 255, 0.78);\n  font-size: 10px;\n  font-weight: 700;\n  letter-spacing: 0.1em;\n  text-transform: uppercase;\n}\n\n.metric-grid {\n  display: grid;\n  grid-template-columns: repeat(3, minmax(0, 1fr));\n  gap: 10px;\n}\n\n.metric-card {\n  padding: 12px;\n  border-radius: 16px;\n  background: rgba(255, 255, 255, 0.88);\n  border: 1px solid rgba(148, 163, 184, 0.14);\n}\n\n.metric-card span,\n.panel-title {\n  font-size: 10px;\n  font-weight: 700;\n  letter-spacing: 0.12em;\n  text-transform: uppercase;\n  color: #64748b;\n}\n\n.metric-card strong {\n  display: block;\n  margin-top: 8px;\n  font-size: 22px;\n  line-height: 1;\n}\n\n.lower-grid {\n  display: grid;\n  grid-template-columns: 1.2fr 0.8fr;\n  gap: 10px;\n}\n\n.panel {\n  padding: 14px;\n  border-radius: 18px;\n  background: rgba(255, 255, 255, 0.88);\n  border: 1px solid rgba(148, 163, 184, 0.14);\n}\n\n.task-list {\n  display: grid;\n  gap: 8px;\n  margin-top: 10px;\n}\n\n.task-row {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  padding: 9px 10px;\n  border-radius: 14px;\n  background: #f8fafc;\n  font-size: 12px;\n}\n\n.task-index {\n  width: 24px;\n  height: 24px;\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  border-radius: 999px;\n  background: white;\n  color: #64748b;\n  font-size: 10px;\n  font-weight: 800;\n}\n\n.panel--accent {\n  color: white;\n}\n\n.panel-title--inverse,\n.panel-copy--inverse {\n  color: rgba(255, 255, 255, 0.86);\n}\n\n.score {\n  margin-top: 12px;\n  font-size: 54px;\n  line-height: 0.9;\n  font-weight: 800;\n}\n\n.panel-copy {\n  max-width: 20ch;\n  font-size: 12px;\n  line-height: 1.35;\n}\n\n@media (max-width: 860px) {\n  .compact-frame {\n    min-height: auto;\n    grid-template-columns: 1fr;\n  }\n\n  .compact-sidebar {\n    border-right: 0;\n    border-bottom: 1px solid rgba(148, 163, 184, 0.14);\n  }\n\n  .metric-grid,\n  .lower-grid {\n    grid-template-columns: 1fr;\n  }\n}\n";

const LEGACY_COMPACT_REACT_PROTOTYPE_STYLES_CODE =
	"* {\n  box-sizing: border-box;\n}\n\n:root {\n  font-family: 'Inter', ui-sans-serif, system-ui, sans-serif;\n  color: #0f172a;\n}\n\nhtml,\nbody,\n#root {\n  height: 100%;\n}\n\nbody {\n  margin: 0;\n}\n\nbutton {\n  border: 0;\n  border-radius: 999px;\n  color: inherit;\n  cursor: pointer;\n}\n\n.prototype-shell {\n  height: 100%;\n  display: grid;\n  padding: 12px;\n  overflow: hidden;\n}\n\n.compact-frame {\n  width: 100%;\n  height: 100%;\n  min-height: 0;\n  display: grid;\n  grid-template-columns: 156px minmax(0, 1fr);\n  background: rgba(255, 255, 255, 0.82);\n  border: 1px solid rgba(15, 23, 42, 0.08);\n  border-radius: 24px;\n  overflow: hidden;\n  box-shadow: 0 22px 64px rgba(15, 23, 42, 0.12);\n  backdrop-filter: blur(14px);\n}\n\n.compact-sidebar {\n  display: flex;\n  flex-direction: column;\n  gap: 10px;\n  padding: 14px;\n  background: rgba(248, 250, 252, 0.82);\n  border-right: 1px solid rgba(148, 163, 184, 0.14);\n}\n\n.logo {\n  width: 40px;\n  height: 40px;\n  display: grid;\n  place-items: center;\n  border-radius: 14px;\n  background: #0f172a;\n  color: white;\n  font-weight: 800;\n  letter-spacing: 0.08em;\n}\n\n.brand {\n  font-size: 11px;\n  font-weight: 700;\n  letter-spacing: 0.18em;\n  text-transform: uppercase;\n  color: #64748b;\n}\n\n.nav-stack {\n  display: grid;\n  gap: 8px;\n  margin-top: 4px;\n}\n\n.nav-pill {\n  width: 100%;\n  padding: 9px 10px;\n  text-align: left;\n  background: rgba(255, 255, 255, 0.85);\n  color: #334155;\n  font-size: 12px;\n  font-weight: 600;\n  text-transform: capitalize;\n  border: 1px solid rgba(148, 163, 184, 0.18);\n}\n\n.nav-pill.is-active {\n  background: color-mix(in srgb, var(--accent) 12%, white);\n  color: var(--accent);\n}\n\n.compact-content {\n  min-height: 0;\n  display: grid;\n  grid-template-rows: auto auto minmax(0, 1fr);\n  gap: 10px;\n  padding: 14px;\n}\n\n.hero-card {\n  display: flex;\n  align-items: flex-start;\n  justify-content: space-between;\n  gap: 14px;\n  padding: 14px;\n  border-radius: 18px;\n  background: linear-gradient(160deg, rgba(255,255,255,0.94), rgba(255,255,255,0.72));\n  border: 1px solid rgba(148, 163, 184, 0.14);\n}\n\n.hero-kicker {\n  display: inline-flex;\n  margin-bottom: 8px;\n  padding: 5px 8px;\n  border-radius: 999px;\n  background: rgba(15, 23, 42, 0.08);\n  font-size: 9px;\n  font-weight: 700;\n  letter-spacing: 0.16em;\n  text-transform: uppercase;\n}\n\nh1 {\n  margin: 0;\n  max-width: 12ch;\n  font-size: 24px;\n  line-height: 0.94;\n}\n\np {\n  margin: 8px 0 0;\n  max-width: 34ch;\n  color: #475569;\n  line-height: 1.35;\n  font-size: 12px;\n}\n\n.hero-status {\n  padding: 6px 10px;\n  border: 1px solid currentColor;\n  border-radius: 999px;\n  background: rgba(255, 255, 255, 0.78);\n  font-size: 10px;\n  font-weight: 700;\n  letter-spacing: 0.1em;\n  text-transform: uppercase;\n}\n\n.metric-grid {\n  display: grid;\n  grid-template-columns: repeat(3, minmax(0, 1fr));\n  gap: 10px;\n}\n\n.metric-card {\n  padding: 12px;\n  border-radius: 16px;\n  background: rgba(255, 255, 255, 0.88);\n  border: 1px solid rgba(148, 163, 184, 0.14);\n}\n\n.metric-card span,\n.panel-title {\n  font-size: 10px;\n  font-weight: 700;\n  letter-spacing: 0.12em;\n  text-transform: uppercase;\n  color: #64748b;\n}\n\n.metric-card strong {\n  display: block;\n  margin-top: 8px;\n  font-size: 22px;\n  line-height: 1;\n}\n\n.lower-grid {\n  min-height: 0;\n  display: grid;\n  grid-template-columns: 1.2fr 0.8fr;\n  gap: 10px;\n}\n\n.panel {\n  min-height: 0;\n  padding: 14px;\n  border-radius: 18px;\n  background: rgba(255, 255, 255, 0.88);\n  border: 1px solid rgba(148, 163, 184, 0.14);\n}\n\n.task-list {\n  display: grid;\n  gap: 8px;\n  margin-top: 10px;\n}\n\n.task-row {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  padding: 9px 10px;\n  border-radius: 14px;\n  background: #f8fafc;\n  font-size: 12px;\n}\n\n.task-index {\n  width: 24px;\n  height: 24px;\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  border-radius: 999px;\n  background: white;\n  color: #64748b;\n  font-size: 10px;\n  font-weight: 800;\n}\n\n.panel--accent {\n  color: white;\n}\n\n.panel-title--inverse,\n.panel-copy--inverse {\n  color: rgba(255, 255, 255, 0.86);\n}\n\n.score {\n  margin-top: 12px;\n  font-size: 54px;\n  line-height: 0.9;\n  font-weight: 800;\n}\n\n.panel-copy {\n  max-width: 20ch;\n  font-size: 12px;\n  line-height: 1.35;\n}\n\n@media (max-width: 860px) {\n  .prototype-shell {\n    height: auto;\n    min-height: 100%;\n  }\n\n  .compact-frame {\n    grid-template-columns: 1fr;\n  }\n\n  .compact-sidebar {\n    border-right: 0;\n    border-bottom: 1px solid rgba(148, 163, 184, 0.14);\n  }\n\n  .metric-grid,\n  .lower-grid {\n    grid-template-columns: 1fr;\n  }\n}\n";

const LEGACY_REACT_PROTOTYPE_INDEX_CODE =
	"import React, { StrictMode } from 'react';\nimport { createRoot } from 'react-dom/client';\nimport './styles.css';\n\nimport App from './App';\n\nconst root = createRoot(document.getElementById('root'));\nroot.render(\n  <StrictMode>\n    <App />\n  </StrictMode>\n);\n";

const DEFAULT_REACT_PROTOTYPE_INDEX_CODE =
	"import { StrictMode } from 'react';\nimport { createRoot } from 'react-dom/client';\nimport './styles.css';\n\nimport App from './App';\n\nconst container = document.getElementById('root');\n\nif (container) {\n  const root = createRoot(container);\n  root.render(\n    <StrictMode>\n      <App />\n    </StrictMode>\n  );\n}\n";

const LEGACY_REACT_PROTOTYPE_RUNTIME_FILES = [
	'/public/index.html',
	'/index.html',
	'/package.json',
	'/vite.config.js',
] as const;

function normalizePrototypeSource(value?: string) {
	return (value ?? '').replace(/\r\n/g, '\n').trim();
}

function isLegacyReactPrototypeEntryFile(
	files: Record<string, z.infer<typeof prototypeOverlayFileSchema>>,
) {
	const indexCode = normalizePrototypeSource(
		files['/index.jsx']?.code ?? files['/index.js']?.code,
	);
	return (
		indexCode === normalizePrototypeSource(LEGACY_REACT_PROTOTYPE_INDEX_CODE) ||
		indexCode.includes('window.__prototypeStudioRoot')
	);
}

function repairReactPrototypeSourceFileExtensions(
	files: Record<string, z.infer<typeof prototypeOverlayFileSchema>>,
) {
	const nextFiles = { ...files };

	if (nextFiles['/App.js']) {
		nextFiles['/App.jsx'] = {
			...(nextFiles['/App.jsx'] ?? {}),
			...nextFiles['/App.js'],
		};
		delete nextFiles['/App.js'];
	}

	if (nextFiles['/index.js']) {
		nextFiles['/index.jsx'] = {
			...(nextFiles['/index.jsx'] ?? {}),
			...nextFiles['/index.js'],
			hidden: true,
		};
		delete nextFiles['/index.js'];
	}

	return nextFiles;
}

function stripLegacyReactPrototypeRuntimeFiles(
	files: Record<string, z.infer<typeof prototypeOverlayFileSchema>>,
) {
	const nextFiles = { ...files };

	for (const path of LEGACY_REACT_PROTOTYPE_RUNTIME_FILES) {
		delete nextFiles[path];
	}

	return nextFiles;
}

function isLegacyReactPrototypeStarter(
	files: Record<string, z.infer<typeof prototypeOverlayFileSchema>>,
) {
	const appCode = normalizePrototypeSource(
		files['/App.jsx']?.code ?? files['/App.js']?.code,
	);
	const stylesCode = normalizePrototypeSource(files['/styles.css']?.code);

	if (appCode === LEGACY_REACT_PROTOTYPE_APP_CODE && stylesCode === LEGACY_REACT_PROTOTYPE_STYLES_CODE) {
		return true;
	}

	return (
		appCode.includes("const views = {") &&
		appCode.includes('dashboard-frame') &&
		appCode.includes('sidebar-stack') &&
		appCode.includes('summary-ring') &&
		appCode.includes('PulseBoard') &&
		!appCode.includes('compact-frame') &&
		stylesCode.includes('.dashboard-frame') &&
		stylesCode.includes('.sidebar-stack') &&
		stylesCode.includes('.summary-ring') &&
		!stylesCode.includes('.compact-frame')
	);
}

function needsReactPrototypeScrollRepair(
	files: Record<string, z.infer<typeof prototypeOverlayFileSchema>>,
) {
	const appCode = normalizePrototypeSource(
		files['/App.jsx']?.code ?? files['/App.js']?.code,
	);
	const stylesCode = normalizePrototypeSource(files['/styles.css']?.code);

	return (
		appCode.includes('compact-frame') &&
		stylesCode.includes('.prototype-shell') &&
		stylesCode.includes('height: 100%;') &&
		stylesCode.includes('overflow: hidden;') &&
		stylesCode.includes('grid-template-rows: auto auto minmax(0, 1fr);')
	);
}

function createDefaultPrototypeFiles(
	template: z.infer<typeof prototypeTemplateSchema>,
): Record<string, z.infer<typeof prototypeOverlayFileSchema>> {
	if (template === 'vanilla') {
		return {
			'/index.js': {
				code:
					"import './styles.css';\n\nconst app = document.getElementById('app');\n\nif (app) {\n  app.innerHTML = `\n    <main class=\"prototype-shell\">\n      <section class=\"card\">\n        <span class=\"eyebrow\">Prototype</span>\n        <h1>Interactive canvas concept</h1>\n        <p>Edit this project with AI or directly in the canvas.</p>\n        <button id=\"cta\" type=\"button\">Cycle theme</button>\n      </section>\n    </main>\n  `;\n\n  const themes = ['theme-peach', 'theme-mint', 'theme-sky'];\n  let index = 0;\n  const shell = app.querySelector('.prototype-shell');\n  const button = document.getElementById('cta');\n\n  button?.addEventListener('click', () => {\n    index = (index + 1) % themes.length;\n    shell?.setAttribute('data-theme', themes[index]);\n  });\n}\n",
				active: true,
			},
			'/styles.css': {
				code:
					":root {\n  font-family: Inter, ui-sans-serif, system-ui, sans-serif;\n  color: #0f172a;\n  background: linear-gradient(135deg, #fff7ed, #fffbeb 45%, #ecfeff);\n}\n\n* {\n  box-sizing: border-box;\n}\n\nbody {\n  margin: 0;\n}\n\n.prototype-shell {\n  min-height: 100vh;\n  display: grid;\n  place-items: center;\n  padding: 24px;\n}\n\n.card {\n  width: min(100%, 420px);\n  border-radius: 24px;\n  padding: 24px;\n  background: rgba(255, 255, 255, 0.82);\n  border: 1px solid rgba(15, 23, 42, 0.08);\n  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.12);\n}\n\n.eyebrow {\n  display: inline-flex;\n  margin-bottom: 12px;\n  border-radius: 999px;\n  padding: 6px 10px;\n  background: rgba(15, 23, 42, 0.08);\n  font-size: 11px;\n  font-weight: 700;\n  letter-spacing: 0.16em;\n  text-transform: uppercase;\n}\n\nh1 {\n  margin: 0 0 12px;\n  font-size: 32px;\n  line-height: 1.05;\n}\n\np {\n  margin: 0 0 18px;\n  color: #475569;\n  line-height: 1.5;\n}\n\nbutton {\n  border: 0;\n  border-radius: 999px;\n  padding: 12px 18px;\n  background: #0f172a;\n  color: white;\n  font-weight: 700;\n  cursor: pointer;\n}\n\n.prototype-shell[data-theme='theme-mint'] {\n  background: linear-gradient(135deg, #ecfdf5, #f0fdf4 42%, #ecfeff);\n}\n\n.prototype-shell[data-theme='theme-sky'] {\n  background: linear-gradient(135deg, #eff6ff, #eef2ff 42%, #fdf2f8);\n}\n",
			},
		};
	}

	return {
		'/index.jsx': {
			code: DEFAULT_REACT_PROTOTYPE_INDEX_CODE,
			hidden: true,
		},
		'/App.jsx': {
			code: DEFAULT_REACT_PROTOTYPE_APP_CODE,
			active: true,
		},
		'/styles.css': {
			code: DEFAULT_REACT_PROTOTYPE_STYLES_CODE,
		},
	};
}

function createDefaultPrototypePreview(
	title: string,
	template: z.infer<typeof prototypeTemplateSchema>,
): z.infer<typeof prototypeCardPreviewSchema> {
	if (template === 'vanilla') {
		return {
			eyebrow: 'Interaction Study',
			title,
			description: 'A quick single-page prototype with theme states and a clean CTA flow.',
			accent: '#0f766e',
			background: 'linear-gradient(135deg, #ecfeff, #ccfbf1 42%, #f0fdfa)',
			badges: ['Vanilla JS', 'Fast', 'Theme toggle'],
			metrics: [
				{ label: 'States', value: '03' },
				{ label: 'Surface', value: '1 page' },
				{ label: 'Speed', value: 'Instant' },
			],
		};
	}

	return {
		eyebrow: 'PulseBoard',
		title,
		description: 'A product command center with launch metrics, priorities, and executive status.',
		accent: '#2563eb',
		background: 'linear-gradient(135deg, #eff6ff, #dbeafe 38%, #fef3c7)',
		badges: ['React', 'Dashboard', 'Launch ops'],
		metrics: [
			{ label: 'Revenue', value: '$128k' },
			{ label: 'Conv.', value: '8.2%' },
			{ label: 'Blockers', value: '03' },
		],
	};
}

export function normalizeMarkdownSettings(
	settings?: Partial<z.input<typeof markdownNoteSettingsSchema>> | null,
) {
	const parsed = markdownNoteSettingsSchema.parse(settings ?? {});
	return {
		...parsed,
		font: parsed.font === 'inherit' ? MARKDOWN_SYSTEM_FONT_STACK : parsed.font,
	};
}

export function normalizeMarkdownOverlay(
	input?: Partial<z.input<typeof markdownOverlaySchema>> | null,
) {
	const parsed = markdownOverlaySchema.parse({
		type: 'markdown',
		...(input ?? {}),
	});

	return {
		...parsed,
		settings: normalizeMarkdownSettings(parsed.settings),
		editorMode: parsed.editorMode ?? 'raw',
	};
}

export function normalizeNewLexOverlay(
	input?: Partial<z.input<typeof newLexOverlaySchema>> | null,
) {
	const parsed = newLexOverlaySchema.parse({
		type: 'newlex',
		...(input ?? {}),
	});

	return {
		...parsed,
		comments: parsed.comments ?? [],
		commentsPanelOpen: parsed.commentsPanelOpen ?? false,
	};
}

export function normalizeKanbanOverlay(
	input?: Partial<z.input<typeof kanbanOverlaySchema>> | null,
): z.infer<typeof kanbanOverlaySchema> {
	const parsed = kanbanOverlaySchema.parse({
		type: 'kanban',
		...(input ?? {}),
	});

	return {
		...parsed,
		columns: parsed.columns.length > 0 ? parsed.columns : createStarterKanbanColumns(),
	};
}

export function summarizeKanbanOverlay(
	input?: Partial<z.input<typeof kanbanOverlaySchema>> | null,
) {
	const board = normalizeKanbanOverlay(input);
	const priorityCounts: Record<(typeof KANBAN_PRIORITY_VALUES)[number], number> = {
		low: 0,
		medium: 0,
		high: 0,
	};
	const labelSet = new Set<string>();
	let cardCount = 0;
	let cardsWithDescriptions = 0;
	let overdueCardCount = 0;
	let completedChecklistItemCount = 0;
	let totalChecklistItemCount = 0;
	let emptyColumnCount = 0;

	const columns = board.columns.map((column) => {
		if (column.cards.length === 0) {
			emptyColumnCount += 1;
		}

		const cards = column.cards.map((card) => {
			cardCount += 1;

			const priority = card.priority ?? 'medium';
			priorityCounts[priority] += 1;

			const hasDescription = typeof card.description === 'string' && card.description.trim().length > 0;
			if (hasDescription) {
				cardsWithDescriptions += 1;
			}

			const checklist = Array.isArray(card.checklist) ? card.checklist : [];
			const completedForCard = checklist.filter((item) => item.done).length;
			completedChecklistItemCount += completedForCard;
			totalChecklistItemCount += checklist.length;

			const labels = Array.isArray(card.labels)
				? card.labels.filter((label): label is string => typeof label === 'string' && label.trim().length > 0)
				: [];
			for (const label of labels) {
				labelSet.add(label);
			}

			const isOverdue = isKanbanDueDateOverdue(card.dueDate);
			if (isOverdue) {
				overdueCardCount += 1;
			}

			return {
				id: card.id,
				title: card.title,
				priority,
				labels,
				hasDescription,
				dueDate: card.dueDate,
				isOverdue,
				completedChecklistItemCount: completedForCard,
				totalChecklistItemCount: checklist.length,
			};
		});

		return {
			id: column.id,
			title: column.title,
			cardCount: cards.length,
			cards,
		};
	});

	return {
		title: board.title,
		columnCount: board.columns.length,
		cardCount,
		emptyColumnCount,
		cardsWithDescriptions,
		overdueCardCount,
		completedChecklistItemCount,
		totalChecklistItemCount,
		priorityCounts,
		labels: [...labelSet].sort((left, right) => left.localeCompare(right)),
		columns,
	};
}

export function normalizeWebEmbedOverlay(
	input?: Partial<z.input<typeof webEmbedOverlaySchema>> | null,
) {
	return webEmbedOverlaySchema.parse({
		type: 'web-embed',
		...(input ?? {}),
	});
}

export function normalizePrototypeOverlay(
	input?: Partial<z.input<typeof prototypeOverlaySchema>> | null,
) {
	const parsed = prototypeOverlaySchema.parse({
		type: 'prototype',
		...(input ?? {}),
	});
	const defaultFiles = createDefaultPrototypeFiles(parsed.template);
	const nextFiles =
		Object.keys(parsed.files).length > 0
			? {
					...defaultFiles,
					...parsed.files,
				}
			: defaultFiles;
	const extensionRepairedFiles =
		parsed.template === 'react'
			? repairReactPrototypeSourceFileExtensions(nextFiles)
			: nextFiles;
	const migratedFiles =
		parsed.template === 'react' && isLegacyReactPrototypeStarter(extensionRepairedFiles)
			? {
					...extensionRepairedFiles,
					'/App.jsx': {
						...extensionRepairedFiles['/App.jsx'],
						code: DEFAULT_REACT_PROTOTYPE_APP_CODE,
					},
					'/styles.css': {
						...extensionRepairedFiles['/styles.css'],
						code: DEFAULT_REACT_PROTOTYPE_STYLES_CODE,
					},
				}
			: extensionRepairedFiles;
	const repairedFiles =
		parsed.template === 'react' && isLegacyReactPrototypeEntryFile(migratedFiles)
			? {
					...migratedFiles,
					'/index.jsx': {
						...(migratedFiles['/index.jsx'] ?? {}),
						code: DEFAULT_REACT_PROTOTYPE_INDEX_CODE,
						hidden: true,
					},
				}
			: migratedFiles;
	const scrollRepairedFiles =
		parsed.template === 'react' && needsReactPrototypeScrollRepair(repairedFiles)
			? {
					...repairedFiles,
					'/styles.css': {
						...repairedFiles['/styles.css'],
						code: DEFAULT_REACT_PROTOTYPE_STYLES_CODE,
					},
				}
			: repairedFiles;
	const runtimeReadyFiles =
		parsed.template === 'react'
			? stripLegacyReactPrototypeRuntimeFiles(scrollRepairedFiles)
			: scrollRepairedFiles;
	const normalizedActiveFile =
		parsed.activeFile === '/App.js'
			? '/App.jsx'
			: parsed.activeFile === '/index.js'
				? '/index.jsx'
				: parsed.activeFile;
	const activeFile =
		normalizedActiveFile && runtimeReadyFiles[normalizedActiveFile]
			? normalizedActiveFile
			: Object.entries(runtimeReadyFiles).find(([, file]) => file.active)?.[0] ?? Object.keys(runtimeReadyFiles)[0] ?? '/App.jsx';

	return {
		...parsed,
		files: Object.fromEntries(
			Object.entries(runtimeReadyFiles).map(([path, file]) => [
				path,
				{
					...file,
					active: path === activeFile,
				},
			]),
		),
		dependencies: parsed.dependencies ?? {},
		preview: {
			...createDefaultPrototypePreview(parsed.title, parsed.template),
			...(parsed.preview ?? {}),
			title: parsed.preview?.title ?? parsed.title,
		},
		activeFile,
		showEditor: parsed.showEditor ?? true,
		showPreview: parsed.showPreview ?? true,
	};
}

export function normalizeOverlayCustomData(
	input?: Partial<OverlayCustomData> | Record<string, unknown> | null,
): OverlayCustomData {
	const type = input?.type;
	if (type === 'markdown') return normalizeMarkdownOverlay(input);
	if (type === 'newlex') return normalizeNewLexOverlay(input);
	if (type === 'kanban') return normalizeKanbanOverlay(input);
	if (type === 'web-embed') return normalizeWebEmbedOverlay(input);
	if (type === 'prototype') return normalizePrototypeOverlay(input);
	return normalizeMarkdownOverlay();
}

export function isOverlayCustomData(value: unknown): value is OverlayCustomData {
	if (!value || typeof value !== 'object') return false;
	const type = (value as { type?: unknown }).type;
	return typeof type === 'string' && (OVERLAY_TYPES as readonly string[]).includes(type);
}

export const overlaySchemas = {
	markdown: markdownOverlaySchema,
	markdownSettings: markdownNoteSettingsSchema,
	markdownEditorMode: markdownEditorModeSchema,
	newLex: newLexOverlaySchema,
	kanban: kanbanOverlaySchema,
	webEmbed: webEmbedOverlaySchema,
	prototype: prototypeOverlaySchema,
	customData: overlayCustomDataSchema,
} as const;

export type MarkdownNoteSettingsInput = z.input<typeof markdownNoteSettingsSchema>;
export type MarkdownOverlayInput = z.input<typeof markdownOverlaySchema>;
