export const AI_MODELS = {
	claude: {
		default: 'claude-sonnet-4-20250514',
		available: [
			'claude-sonnet-4-20250514',
			'claude-haiku-4-5-20251001',
		],
	},
	gemini: {
		default: 'gemini-2.0-flash',
		available: ['gemini-2.0-flash', 'gemini-2.5-pro-preview-06-05'],
	},
} as const;

export const GENERATION_MODES = {
	chat: { label: 'Chat', description: 'General conversation' },
	mermaid: { label: 'Mermaid', description: 'Generate Mermaid diagrams' },
	d2: { label: 'D2', description: 'Generate D2 diagrams' },
	image: { label: 'Image', description: 'Generate images' },
	sketch: { label: 'Sketch', description: 'Sketch-style rendering' },
	kanban: { label: 'Kanban', description: 'Kanban board operations' },
} as const;
