export interface CanvasTourGuideOverlay {
	label: string;
	title: string;
	description: string;
	hint: string;
	accentColor: string;
	placement: {
		leftRem: number;
		topRem: number;
		widthRem: number;
	};
}

export interface CanvasTourChapter {
	id: string;
	label: string;
	title: string;
	description: string;
	camera: {
		x: number;
		y: number;
	zoom: number;
	};
	overlay: CanvasTourGuideOverlay;
	ai?: {
		placeholder: string;
	};
}

export const canvasTourChapters: CanvasTourChapter[] = [
	{
		id: 'llm-midterm',
		label: 'First pass',
		title: 'Start with what you already have',
		description:
			'Lecture notes, screenshots, links, and rough questions can all live on the same board before you organize them.',
		camera: {
			x: 980,
			y: 560,
			zoom: 0.9,
		},
		overlay: {
			label: 'First pass',
			title: 'Start with what you already have',
			description:
				'Lecture notes, screenshots, links, and rough questions can all live on the same board before you organize them.',
			hint: 'The board starts loose on purpose so nothing useful gets lost.',
			accentColor: '#8b82ff',
			placement: {
				leftRem: 1.2,
				topRem: 1.2,
				widthRem: 16,
			},
		},
		ai: {
			placeholder: 'Ask for a summary, explanation, or practice quiz',
		},
	},
];
