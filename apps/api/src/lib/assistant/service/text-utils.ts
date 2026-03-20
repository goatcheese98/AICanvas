import { sentenceCase } from './service-utils';

export function truncateTitle(text: string): string {
	return sentenceCase(text).slice(0, 32) || 'Prototype';
}

export function extractPrototypeSubject(message: string): string {
	const match = message.match(/\b(?:for|about|around|targeting)\s+(.+)$/i);
	const subject = (match?.[1] ?? message)
		.replace(
			/\b(create|build|make|design|prototype|website|landing page|landing-page|page|dashboard|app)\b/gi,
			' ',
		)
		.replace(/[^\w\s-]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
	return subject || 'AI Product';
}

export function toTitleWords(text: string): string {
	return text
		.split(/\s+/)
		.filter(Boolean)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join(' ');
}

export function extractPromptKeywords(text: string): string[] {
	const stopwords = new Set([
		'a',
		'an',
		'and',
		'app',
		'build',
		'create',
		'design',
		'for',
		'from',
		'in',
		'landing',
		'page',
		'prototype',
		'site',
		'that',
		'the',
		'this',
		'website',
		'with',
	]);

	return Array.from(
		new Set(
			text
				.toLowerCase()
				.split(/[^a-z0-9]+/)
				.filter((token) => token.length > 2 && !stopwords.has(token)),
		),
	).slice(0, 6);
}

export function expectsFunctionalPrototype(message: string): boolean {
	const normalized = message.toLowerCase();
	if (/(landing page|landing-page|website|homepage|marketing site)/.test(normalized)) {
		return false;
	}

	return /(calculator|todo|timer|tracker|converter|quiz|editor|generator|planner|tool|utility|app)/.test(
		normalized,
	);
}
