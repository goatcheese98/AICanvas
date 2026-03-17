import type {
	AssistantMessage,
	GenerationMode,
	PrototypeOverlayCustomData,
} from '@ai-canvas/shared/types';
import { extractCodeBlock } from './parsing';
import type { AssistantServiceInput } from './types';

export function sanitizeHistoryMessages(
	history: AssistantServiceInput['history'],
): AssistantMessage[] {
	if (!Array.isArray(history)) {
		return [];
	}

	return history
		.filter(
			(message) =>
				(message.role === 'user' || message.role === 'assistant') &&
				typeof message.content === 'string',
		)
		.slice(-12)
		.map((message) => ({
			id: message.id,
			role: message.role,
			content: message.content.trim().slice(0, 4000),
			generationMode: message.generationMode,
			artifacts: message.artifacts,
			createdAt: message.createdAt,
		}))
		.filter((message) => message.content.length > 0);
}

export function buildAnthropicConversation(
	input: AssistantServiceInput,
	currentUserContent: string,
): Array<{ role: 'user' | 'assistant'; content: string }> {
	return [
		...sanitizeHistoryMessages(input.history).map((message) => ({
			role: message.role,
			content: message.content,
		})),
		{
			role: 'user',
			content: currentUserContent,
		},
	];
}

export function inferPrototypeTemplate(
	input: AssistantServiceInput,
): PrototypeOverlayCustomData['template'] {
	const message = input.message.toLowerCase();

	if (
		/(vanilla|html\s*\/\s*css|html css|plain javascript|plain js|vanilla js|vanilla javascript)/.test(
			message,
		)
	) {
		return 'vanilla';
	}

	if (/(react|jsx|tsx)/.test(message)) {
		return 'react';
	}

	return input.prototypeContext?.template ?? 'react';
}

export function getLastDiagramArtifact(
	history: AssistantServiceInput['history'],
): { mode: Extract<GenerationMode, 'mermaid' | 'd2'>; content: string } | null {
	if (!Array.isArray(history)) {
		return null;
	}

	for (const message of [...history].reverse()) {
		for (const artifact of [...(message.artifacts ?? [])].reverse()) {
			if (
				(artifact.type === 'mermaid' || artifact.type === 'd2') &&
				artifact.content.trim().length > 0
			) {
				return { mode: artifact.type, content: artifact.content.trim() };
			}
		}

		if (message.role !== 'assistant') {
			continue;
		}

		if (message.generationMode === 'mermaid') {
			const code = extractCodeBlock(message.content, 'mermaid');
			if (code) {
				return { mode: 'mermaid', content: code };
			}
		}

		if (message.generationMode === 'd2') {
			const code = extractCodeBlock(message.content, 'd2');
			if (code) {
				return { mode: 'd2', content: code };
			}
		}
	}

	return null;
}

function isDiagramFollowUpRequest(message: string): boolean {
	return /(fix|update|adjust|change|edit|refine|improve|render|rerender|re-render|correct|repair|clean up|arrow|edge|line|label|node|spacing|align|move|swap|reverse|rotate|that|it|this|same diagram)/.test(
		message,
	);
}

export function getLastSvgSource(history: AssistantServiceInput['history']): string | null {
	if (!Array.isArray(history)) {
		return null;
	}

	for (const message of [...history].reverse()) {
		if (message.role !== 'assistant' || message.generationMode !== 'svg') {
			continue;
		}

		const code = extractCodeBlock(message.content, 'svg');
		if (code) {
			return code;
		}
	}

	return null;
}

function getLastMediaGenerationMode(
	history: AssistantServiceInput['history'],
): Extract<GenerationMode, 'image' | 'sketch' | 'svg'> | null {
	if (!Array.isArray(history)) {
		return null;
	}

	for (const message of [...history].reverse()) {
		if (message.role !== 'assistant') {
			continue;
		}

		if (
			message.generationMode === 'image' ||
			message.generationMode === 'sketch' ||
			message.generationMode === 'svg'
		) {
			return message.generationMode;
		}
	}

	return null;
}

function isImageFollowUpRequest(message: string): boolean {
	return /\b(background|lighting|style|color|palette|scene|setting|composition|pose|expression|outfit|add|remove|change|adjust|update|refine|improve|simplify|variation|version|another|different|with|without|make it|make the|keep the|same subject|same image|same svg|same icon|bigger|larger|smaller|proceed|go ahead|do it|yes|yep|let's do|lets do|try that)\b/.test(
		message,
	);
}

export function resolveGenerationMode(input: AssistantServiceInput): GenerationMode {
	if (input.generationMode) {
		return input.generationMode;
	}

	const message = input.message.toLowerCase();
	const hasVisualVerb =
		/\b(generate|create|creat|make|render|design|draw|illustrat(?:e|ion)|craft|build)\b/.test(
			message,
		);
	const hasExplicitImageIntent =
		/\b(generate|create|creat|make|render|design|draw|illustrat(?:e|ion))\s+(?:an?\s+)?(?:image|illustration|photo|poster|artwork|hero image|hero illustration|cover image)\b/.test(
			message,
		) ||
		/\b(?:image|illustration|photo|poster|artwork|hero image|hero illustration|cover image)\s+of\b/.test(
			message,
		);
	const hasExplicitSvgIntent =
		(/\b(svg|vector|vectorized|vectorizable|vector graphic|logo|icon|mascot|sticker)\b/.test(
			message,
		) &&
			hasVisualVerb) ||
		/\b(as|in)\s+svg\b/.test(message);

	if (/\bd2\b/.test(message)) {
		return 'd2';
	}

	if (/(kanban|backlog|sprint board|task board|turn this into tasks|plan tasks)/.test(message)) {
		return 'kanban';
	}

	if (
		/(mermaid|flowchart|sequence diagram|state diagram|architecture diagram|diagram this|diagram the)/.test(
			message,
		)
	) {
		return 'mermaid';
	}

	if (hasExplicitSvgIntent) {
		return 'svg';
	}

	if (/(wireframe|hand-drawn sketch|sketch this|whiteboard sketch)/.test(message)) {
		return 'sketch';
	}

	if (hasExplicitImageIntent) {
		return 'image';
	}

	if (
		/(prototype|protoype|prototype|propotype|mockup|landing page|landing-page|react app|dashboard ui|ui prototype|build a component|build a page|vanilla js|vanilla javascript|html css|jsx|tsx)/.test(
			message,
		) ||
		(Boolean(input.prototypeContext) &&
			/(react|vanilla|html|css|javascript|js|jsx|tsx|convert|rewrite|migrate|refactor|restyle|rebuild)/.test(
				message,
			))
	) {
		return 'prototype';
	}

	if (/(generate an image|create an image|hero illustration|illustration|cover image)/.test(message)) {
		return 'image';
	}

	const lastDiagramArtifact = getLastDiagramArtifact(input.history);
	if (lastDiagramArtifact && isDiagramFollowUpRequest(message)) {
		return lastDiagramArtifact.mode;
	}

	const lastMediaGenerationMode = getLastMediaGenerationMode(input.history);
	if (lastMediaGenerationMode && isImageFollowUpRequest(message)) {
		return lastMediaGenerationMode;
	}

	return 'chat';
}
