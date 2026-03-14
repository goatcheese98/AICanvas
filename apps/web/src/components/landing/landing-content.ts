export interface LandingStoryChapter {
	id: string;
	eyebrow: string;
	label: string;
	title: string;
	description: string;
	detail: string;
	metricLabel: string;
	metricValue: string;
	bullets: string[];
	camera: {
		x: number;
		y: number;
		scale: number;
	};
}

export const landingContent = {
	brand: {
		name: 'RoopStudio',
	},
	scene: {
		label: 'Start anywhere',
		title: 'One canvas for rough ideas, research, plans, and polished work.',
		description:
			'Keep early fragments, source material, planning systems, and polished outputs in one board that evolves with the work.',
		primaryLabel: 'Join waitlist',
		primaryHref: '#waitlist',
		secondaryLabel: 'Sign in',
		secondaryHref: '/login',
	},
	proof: [
		{
			value: '1 board',
			label: 'from spark to ship',
		},
		{
			value: '5 views',
			label: 'you can scroll through',
		},
		{
			value: '0 handoff',
			label: 'between thinking modes',
		},
	],
	waitlist: {
		title: 'Join the waitlist for the first RoopStudio release',
		description:
			'We are opening access in waves for people who want one surface for messy thinking and polished execution.',
		helper: 'Use your work email so we can prioritize serious design, research, and product teams.',
		submitLabel: 'Request access',
	},
} as const;

export const landingStoryChapters: LandingStoryChapter[] = [
	{
		id: 'capture',
		eyebrow: 'Chapter 01',
		label: 'Rough ideas',
		title: 'Capture fragments before they disappear',
		description:
			'Clip screenshots, paste links, drop quick notes, and leave loose stickies exactly where the thought first shows up.',
		detail:
			'The board stays forgiving early on, so you can collect without deciding the final structure too soon.',
		metricLabel: 'Initial capture',
		metricValue: 'Loose inputs, zero friction',
		bullets: [
			'Pin notes, screenshots, and references beside each other.',
			'Leave rough labels and sketches without breaking the flow.',
			'Keep the first draft spatial, not buried in a folder tree.',
		],
		camera: {
			x: 60,
			y: 30,
			scale: 0.8,
		},
	},
	{
		id: 'research',
		eyebrow: 'Chapter 02',
		label: 'Research lanes',
		title: 'Build context next to the idea, not in another tool',
		description:
			'Turn scattered source material into a living research wall with clips, summaries, comparisons, and open questions.',
		detail:
			'Everything stays visible on the same surface, so insight gathering feels connected to the work it supports.',
		metricLabel: 'Research surface',
		metricValue: 'Evidence stays in frame',
		bullets: [
			'Create source cards with highlights and confidence levels.',
			'Group reference material by theme, user need, or opportunity.',
			'Promote raw notes into structured summaries when patterns emerge.',
		],
		camera: {
			x: -640,
			y: -10,
			scale: 0.76,
		},
	},
	{
		id: 'plan',
		eyebrow: 'Chapter 03',
		label: 'Plans in motion',
		title: 'Shape momentum with boards, timelines, and next steps',
		description:
			'Once the signal is clear, convert clusters into a plan with priorities, owners, and milestones that still live on the same canvas.',
		detail:
			'You can move from discovery to execution without losing the thinking that informed the plan.',
		metricLabel: 'Planning mode',
		metricValue: 'Decisions stay connected',
		bullets: [
			'Arrange work into columns, checkpoints, and launch criteria.',
			'Map dependencies visually before turning them into tasks.',
			'Keep strategy notes visible beside the execution layer.',
		],
		camera: {
			x: -1330,
			y: -70,
			scale: 0.75,
		},
	},
	{
		id: 'polish',
		eyebrow: 'Chapter 04',
		label: 'Polished outputs',
		title: 'Turn the same board into briefs, prototypes, and shareable work',
		description:
			'When the direction is ready, draft cleaner artifacts on the same surface so outputs inherit the context instead of starting from scratch.',
		detail:
			'The polished layer feels deliberate, but it still traces back to the messy work that made it better.',
		metricLabel: 'Output layer',
		metricValue: 'From concept to delivery',
		bullets: [
			'Open structured docs and interface panels directly on the canvas.',
			'Reference research and decisions while writing the final brief.',
			'Keep prototypes, specs, and summaries aligned in one narrative arc.',
		],
		camera: {
			x: -2100,
			y: -90,
			scale: 0.78,
		},
	},
	{
		id: 'review',
		eyebrow: 'Chapter 05',
		label: 'Review loop',
		title: 'Review in context with collaborators and prompts nearby',
		description:
			'Feedback, approvals, and AI-assisted edits happen next to the work itself, so iteration stays grounded in the full board.',
		detail:
			'Instead of scattered comments and disconnected docs, the team sees the chain from note to decision to final output.',
		metricLabel: 'Review mode',
		metricValue: 'Context-rich collaboration',
		bullets: [
			'Leave comments beside prototypes, code, and planning lanes.',
			'Run edits or summaries without leaving the board context.',
			'Keep the feedback loop spatial, visible, and easy to revisit.',
		],
		camera: {
			x: -2740,
			y: -160,
			scale: 0.76,
		},
	},
];
