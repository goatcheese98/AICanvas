export function sentenceCase(text: string): string {
	const trimmed = text.trim().replace(/\s+/g, ' ');
	if (!trimmed) return 'Untitled';
	return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export function escapeSvgText(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

export function slug(text: string): string {
	return (
		text
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/(^-|-$)/g, '')
			.slice(0, 24) || 'node'
	);
}

export function truncateLabel(text: string, max = 56): string {
	const normalized = sentenceCase(text).replace(/\s+/g, ' ');
	return normalized.length <= max ? normalized : `${normalized.slice(0, max - 1).trimEnd()}…`;
}

export function normalizeSource(value?: string): string {
	return (value ?? '').replace(/\r\n/g, '\n').trim();
}

export function isEditableSelectionRequest(message: string): boolean {
	return /(add|adjust|change|clean up|condense|convert|edit|expand|fix|improve|move|organize|polish|priorit|refine|rename|reorder|rewrite|summari[sz]e|turn this into|update)/i.test(
		message,
	);
}

export function isCreateNewArtifactIntent(message: string): boolean {
	return /\b(new\s+(board|kanban|note|prototype)|create\s+(a\s+)?new|from this|based on this|turn this into|make (?:a|an)\b)/i.test(
		message,
	);
}
