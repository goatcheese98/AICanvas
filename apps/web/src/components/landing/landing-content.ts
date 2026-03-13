export type LandingActorId =
	| 'cluster'
	| 'imageRef'
	| 'sketchNote'
	| 'markdown'
	| 'chat'
	| 'richText'
	| 'kanban'
	| 'prototype'
	| 'waitlist';

export type LandingConnectorId =
	| 'cluster-to-chat'
	| 'chat-to-richtext'
	| 'richtext-to-kanban'
	| 'kanban-to-prototype';

export type LandingChatState =
	| 'hidden'
	| 'prompt'
	| 'drafting'
	| 'handoff'
	| 'iterating'
	| 'invite';

export type LandingCollaborationState = 'hidden' | 'commentary' | 'active';

export type LandingArtifactState = {
	cluster: 'ambient' | 'active';
	markdown: 'seed' | 'draft' | 'aligned';
	richText: 'hidden' | 'draft' | 'organized';
	kanban: 'hidden' | 'forming' | 'active';
	prototype: 'hidden' | 'active';
	waitlist: 'hidden' | 'active';
};

export type LandingScene = {
	id: 'start' | 'assist' | 'shape' | 'organize' | 'iterate' | 'invite';
	label: string;
	title: string;
	description: string;
	camera: {
		x: number;
		y: number;
		scale: number;
	};
	visibleActors: readonly LandingActorId[];
	focusActors: readonly LandingActorId[];
	connectorState: readonly LandingConnectorId[];
	collaborationState: LandingCollaborationState;
	enterAnimations: readonly ('fade' | 'lift' | 'draw')[];
	chatState: LandingChatState;
	artifactState: LandingArtifactState;
	tourCard: {
		x: number;
		y: number;
		width: number;
	};
	cta?: {
		primaryLabel?: string;
		primaryTarget?: number;
		secondaryLabel?: string;
		secondaryHref?: string;
	};
};

export const landingContent = {
	brand: {
		name: 'RoopStudio',
	},
	hero: {
		eyebrow: 'A next-generation canvas for ideas, making, and shared progress',
	},
	scenes: [
		{
			id: 'start',
			label: 'Start anywhere',
			title: 'One canvas for rough ideas, research, plans, and polished work.',
			description:
				'Capture whatever helps you think: notes, images, sketches, and structured blocks can all live together from the first thought onward.',
			camera: { x: 1600, y: 820, scale: 0.72 },
			visibleActors: ['cluster', 'imageRef', 'sketchNote', 'markdown'],
			focusActors: ['cluster', 'markdown'],
			connectorState: [],
			collaborationState: 'hidden',
			enterAnimations: ['fade', 'lift'],
			chatState: 'hidden',
			tourCard: { x: 820, y: 160, width: 370 },
			artifactState: {
				cluster: 'active',
				markdown: 'seed',
				richText: 'hidden',
				kanban: 'hidden',
				prototype: 'hidden',
				waitlist: 'hidden',
			},
			cta: {
				primaryLabel: 'See it in action',
				primaryTarget: 1,
				secondaryLabel: 'Join waitlist',
				secondaryHref: '#waitlist',
			},
		},
		{
			id: 'assist',
			label: 'Use AI in place',
			title: 'Ask AI right on the board instead of switching tabs.',
			description:
				'Research, summarizing, restructuring, and first drafts happen beside your notes so momentum stays on the canvas.',
			camera: { x: 2050, y: 760, scale: 0.8 },
			visibleActors: ['cluster', 'markdown', 'chat', 'imageRef'],
			focusActors: ['chat', 'markdown'],
			connectorState: ['cluster-to-chat'],
			collaborationState: 'hidden',
			enterAnimations: ['fade', 'draw'],
			chatState: 'prompt',
			tourCard: { x: 2320, y: 90, width: 380 },
			artifactState: {
				cluster: 'active',
				markdown: 'draft',
				richText: 'hidden',
				kanban: 'hidden',
				prototype: 'hidden',
				waitlist: 'hidden',
			},
		},
		{
			id: 'shape',
			label: 'Shape the board',
			title: 'Turn scattered input into something clear and reusable.',
			description:
				'Useful AI output can drop straight into markdown and rich text blocks, so the board gets sharper instead of becoming another chat log.',
			camera: { x: 2225, y: 885, scale: 0.84 },
			visibleActors: ['cluster', 'markdown', 'chat', 'richText', 'imageRef'],
			focusActors: ['richText', 'markdown'],
			connectorState: ['cluster-to-chat', 'chat-to-richtext'],
			collaborationState: 'commentary',
			enterAnimations: ['fade', 'lift', 'draw'],
			chatState: 'handoff',
			tourCard: { x: 1840, y: 1310, width: 380 },
			artifactState: {
				cluster: 'ambient',
				markdown: 'draft',
				richText: 'draft',
				kanban: 'hidden',
				prototype: 'hidden',
				waitlist: 'hidden',
			},
		},
		{
			id: 'organize',
			label: 'Organize together',
			title: 'Move from ideas to a plan without losing the context behind it.',
			description:
				'Notes become grouped next steps, collaborators react in place, and everyone can follow the same board as it becomes more structured.',
			camera: { x: 2550, y: 860, scale: 0.88 },
			visibleActors: ['markdown', 'chat', 'richText', 'kanban'],
			focusActors: ['kanban', 'richText'],
			connectorState: ['chat-to-richtext', 'richtext-to-kanban'],
			collaborationState: 'active',
			enterAnimations: ['fade', 'lift', 'draw'],
			chatState: 'drafting',
			tourCard: { x: 2860, y: 950, width: 360 },
			artifactState: {
				cluster: 'ambient',
				markdown: 'aligned',
				richText: 'organized',
				kanban: 'forming',
				prototype: 'hidden',
				waitlist: 'hidden',
			},
		},
		{
			id: 'iterate',
			label: 'Make and refine',
			title: 'Sketch, prototype, and revise with the source material still in view.',
			description:
				'Ideas, AI help, planning, and visual exploration stay side by side, which makes it easier to compare options and keep moving.',
			camera: { x: 2920, y: 1110, scale: 0.9 },
			visibleActors: ['markdown', 'chat', 'richText', 'kanban', 'prototype'],
			focusActors: ['prototype', 'kanban'],
			connectorState: ['richtext-to-kanban', 'kanban-to-prototype'],
			collaborationState: 'active',
			enterAnimations: ['fade', 'lift', 'draw'],
			chatState: 'iterating',
			tourCard: { x: 3470, y: 840, width: 340 },
			artifactState: {
				cluster: 'ambient',
				markdown: 'aligned',
				richText: 'organized',
				kanban: 'active',
				prototype: 'active',
				waitlist: 'hidden',
			},
		},
		{
			id: 'invite',
			label: 'Try RoopStudio',
			title: 'Keep the whole story on one living board.',
			description:
				'RoopStudio connects the rough thought, the useful AI assist, the shared plan, and the final output without making you start over in another tool.',
			camera: { x: 3280, y: 1210, scale: 0.94 },
			visibleActors: ['markdown', 'chat', 'richText', 'kanban', 'prototype', 'waitlist'],
			focusActors: ['waitlist', 'prototype'],
			connectorState: ['chat-to-richtext', 'richtext-to-kanban', 'kanban-to-prototype'],
			collaborationState: 'active',
			enterAnimations: ['fade', 'lift', 'draw'],
			chatState: 'invite',
			tourCard: { x: 3435, y: 1630, width: 360 },
			artifactState: {
				cluster: 'ambient',
				markdown: 'aligned',
				richText: 'organized',
				kanban: 'active',
				prototype: 'active',
				waitlist: 'active',
			},
			cta: {
				primaryLabel: 'Request access',
				secondaryLabel: 'Sign in',
				secondaryHref: '/login',
			},
		},
	] satisfies readonly LandingScene[],
} as const;
