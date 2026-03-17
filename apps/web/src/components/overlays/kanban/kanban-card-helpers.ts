import { KANBAN_ACCENT_BORDER, KANBAN_ACCENT_TEXT } from './kanban-theme';

const LABEL_TONES = [
	{
		background: 'color-mix(in srgb, var(--color-accent-bg) 82%, white)',
		borderColor: KANBAN_ACCENT_BORDER,
		color: KANBAN_ACCENT_TEXT,
	},
	{
		background: 'color-mix(in srgb, var(--color-success-bg) 88%, white)',
		borderColor: 'color-mix(in srgb, var(--color-success-text) 20%, transparent)',
		color: 'var(--color-success-text)',
	},
	{
		background: 'color-mix(in srgb, var(--color-danger-bg) 88%, white)',
		borderColor: 'color-mix(in srgb, var(--color-danger-border) 80%, transparent)',
		color: 'var(--color-danger-text)',
	},
	{
		background: 'color-mix(in srgb, var(--color-warm-bg) 88%, white)',
		borderColor: 'color-mix(in srgb, var(--color-warm-text) 16%, transparent)',
		color: 'var(--color-warm-text)',
	},
] as const;

export function parseLabelInput(value: string) {
	return value
		.split(',')
		.map((label) => label.trim())
		.filter(Boolean);
}

export function autosizeTextarea(target: HTMLTextAreaElement) {
	target.style.height = '0px';
	target.style.height = `${target.scrollHeight}px`;
}

function hashString(value: string) {
	let hash = 0;
	for (let index = 0; index < value.length; index += 1) {
		hash = (hash << 5) - hash + value.charCodeAt(index);
		hash |= 0;
	}
	return Math.abs(hash);
}

export function getLabelTone(label: string) {
	return LABEL_TONES[hashString(label) % LABEL_TONES.length] ?? LABEL_TONES[0];
}
