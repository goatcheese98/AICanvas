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
		label: 'AI Canvas',
		title: 'RoopStudio AI Canvas',
		description:
			'A visual workspace for turning raw material into shareable work without losing the trail of decisions.',
		primaryLabel: 'Request access',
		primaryHref: '#waitlist',
		secondaryLabel: 'Sign in',
		secondaryHref: '/login',
	},
	proof: [
		{
			value: 'Capture',
			label: 'raw material lands on the board',
		},
		{
			value: 'Connect',
			label: 'research and decisions stay visible',
		},
		{
			value: 'Compose',
			label: 'outputs inherit the context',
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
		id: 'intro',
		eyebrow: 'Welcome',
		label: 'Your canvas',
		title: 'The board starts as a working surface',
		description:
			'Start with the materials you already have, then let the canvas carry them through the rest of the project.',
		detail: 'Scroll the board from raw inputs to final output.',
		metricLabel: 'Start here',
		metricValue: 'One surface',
		bullets: [
			'Drop material before the structure is obvious.',
			'Keep evidence beside the work it informs.',
			'Move toward output without resetting context.',
		],
		camera: {
			x: 350,
			y: 50,
			scale: 0.88,
		},
	},
	{
		id: 'capture',
		eyebrow: 'Chapter 01',
		label: 'Gather',
		title: 'Gather the raw material',
		description:
			'Bring in screenshots, links, notes, clips, and loose thoughts before they are ready for a document.',
		detail:
			'The board stays forgiving early, so the first pass can be messy without becoming disposable.',
		metricLabel: 'Initial capture',
		metricValue: 'Raw inputs',
		bullets: [
			'Pin notes, screenshots, and references beside each other.',
			'Leave rough labels and sketches without breaking the flow.',
			'Keep the first draft spatial, not buried in a folder tree.',
		],
		camera: {
			x: 200,
			y: 30,
			scale: 0.85,
		},
	},
	{
		id: 'research',
		eyebrow: 'Chapter 02',
		label: 'Synthesize',
		title: 'Extract signal from the mess',
		description:
			'Group sources, compare evidence, and keep open questions beside the work they are shaping.',
		detail:
			'The research layer stays in frame, so insight gathering does not become a separate archive.',
		metricLabel: 'Research surface',
		metricValue: 'Signal wall',
		bullets: [
			'Create source cards with highlights and confidence levels.',
			'Group reference material by theme, user need, or opportunity.',
			'Promote raw notes into structured summaries when patterns emerge.',
		],
		camera: {
			x: -400,
			y: 60,
			scale: 0.82,
		},
	},
	{
		id: 'plan',
		eyebrow: 'Chapter 03',
		label: 'Plan',
		title: 'Turn signal into a path',
		description:
			'Convert the useful patterns into priorities, sequencing, owners, and the next visible decisions.',
		detail:
			'The plan is not detached from discovery; it sits beside the evidence that justifies it.',
		metricLabel: 'Planning mode',
		metricValue: 'Decision path',
		bullets: [
			'Arrange work into columns, checkpoints, and launch criteria.',
			'Map dependencies visually before turning them into tasks.',
			'Keep strategy notes visible beside the execution layer.',
		],
		camera: {
			x: -950,
			y: 40,
			scale: 0.78,
		},
	},
	{
		id: 'polish',
		eyebrow: 'Chapter 04',
		label: 'Compose',
		title: 'Compose the output in context',
		description:
			'Draft briefs, specs, prototypes, and summaries on the same surface that holds the reasoning.',
		detail: 'Finished work should still be traceable to the messy work that made it stronger.',
		metricLabel: 'Output layer',
		metricValue: 'Context-rich output',
		bullets: [
			'Open structured docs and interface panels directly on the canvas.',
			'Reference research and decisions while writing the final brief.',
			'Keep prototypes, specs, and summaries aligned in one narrative arc.',
		],
		camera: {
			x: -1650,
			y: 50,
			scale: 0.78,
		},
	},
];

export const landingWaitlistChapter: LandingStoryChapter = {
	id: 'waitlist',
	eyebrow: 'Final step',
	label: 'Request access',
	title: 'Request early access',
	description:
		'Join the early release if this is the kind of workspace you want for real project work.',
	detail: 'Pan to the access form without leaving the demo frame.',
	metricLabel: 'Waitlist',
	metricValue: 'Early release',
	bullets: [],
	camera: {
		x: -2300,
		y: 0,
		scale: 0.88,
	},
};
