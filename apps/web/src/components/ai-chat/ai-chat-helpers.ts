import type { AssistantArtifact, AssistantMessage } from '@ai-canvas/shared/types';
import { buildPrototypeFromMessageContent, filterVisibleArtifacts } from './assistant-artifacts';
import type { AssistantPatchApplyState, PatchArtifactDescriptor } from './ai-chat-types';

export function clonePatchCustomData<T extends Record<string, unknown>>(value: T): T {
	if (typeof structuredClone === 'function') {
		return structuredClone(value);
	}

	return JSON.parse(JSON.stringify(value)) as T;
}

export function buildConversationHistory(messages: AssistantMessage[]): AssistantMessage[] {
	return messages.slice(-12).map((message) => ({
		id: message.id,
		role: message.role,
		content: message.content,
		generationMode: message.generationMode,
		artifacts: message.artifacts,
		createdAt: message.createdAt,
	}));
}

export function looksLikePatchProposalContent(content: string): boolean {
	return /(apply this patch|ready to apply|reversible changes|reversible selection edits|use the patch cards below|kanban update applied|patch successfully applied)/i.test(
		content,
	);
}

export function buildArtifactKey(messageId: string, artifact: AssistantArtifact, index: number) {
	return `${messageId}-${artifact.type}-${index}`;
}

export function getLatestPendingPatchArtifacts(
	messages: AssistantMessage[],
	patchStates: Record<string, AssistantPatchApplyState>,
): PatchArtifactDescriptor[] {
	for (const message of [...messages].reverse()) {
		const patchArtifacts = filterVisibleArtifacts(message.artifacts ?? [])
			.map((artifact, index) => ({
				artifact,
				artifactKey: buildArtifactKey(message.id, artifact, index),
			}))
			.filter(
				({ artifact, artifactKey }) =>
					(artifact.type === 'markdown-patch' || artifact.type === 'kanban-patch') &&
					patchStates[artifactKey]?.status !== 'applied',
			);

		if (patchArtifacts.length > 0) {
			return patchArtifacts;
		}
	}

	return [];
}

export function canInsertMessageAsMarkdown(message: AssistantMessage): boolean {
	return (
		message.role === 'assistant' &&
		message.content.trim().length > 0 &&
		!looksLikePatchProposalContent(message.content) &&
		!(message.artifacts ?? []).some(
			(artifact) =>
				artifact.type === 'kanban-ops' ||
				artifact.type === 'markdown-patch' ||
				artifact.type === 'kanban-patch',
		)
	);
}

export function canApplyMessageAsPrototype(message: AssistantMessage): boolean {
	return message.role === 'assistant' && buildPrototypeFromMessageContent(message.content) !== null;
}

export function extractCodeBlock(content: string, language: string): string | null {
	const pattern = new RegExp(`\\\`\\\`\\\`${language}\\s*([\\s\\S]*?)\\\`\\\`\\\``, 'i');
	const match = content.match(pattern);
	const value = match?.[1]?.trim();
	return value ? value : null;
}

export function extractSvgFromMessageContent(message: AssistantMessage): string | null {
	return message.role === 'assistant' ? extractCodeBlock(message.content, 'svg') : null;
}

export function canInsertMessageAsSvg(message: AssistantMessage): boolean {
	return message.role === 'assistant' && extractSvgFromMessageContent(message) !== null;
}

export function getThreadPreview(thread: { messages: AssistantMessage[] }) {
	if (!thread.messages.some((message) => message.role === 'user')) {
		return 'No requests yet';
	}

	const preview = thread.messages.at(-1)?.content?.replace(/\s+/g, ' ').trim() ?? '';
	return preview || 'No messages yet';
}

export function getThreadDisplayTitle(thread: {
	title: string;
	messages: AssistantMessage[];
}) {
	return thread.messages.some((message) => message.role === 'user') ? thread.title : 'New chat';
}

export function getThreadMonogram(title: string) {
	const monogram = title
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part.charAt(0).toUpperCase())
		.join('');

	return monogram || 'AI';
}

export function formatThreadTimestamp(updatedAt: string) {
	const timestamp = new Date(updatedAt);
	const now = new Date();
	const sameDay = timestamp.toDateString() === now.toDateString();

	return sameDay
		? timestamp.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
		: timestamp.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export async function writeToClipboard(value: string) {
	if (!value.trim()) {
		throw new Error('Nothing to copy.');
	}

	if (!navigator.clipboard?.writeText) {
		throw new Error('Clipboard is unavailable.');
	}

	await navigator.clipboard.writeText(value);
}
