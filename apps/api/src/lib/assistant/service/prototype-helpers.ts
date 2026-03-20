import { normalizePrototypeOverlay } from '@ai-canvas/shared/schemas';
import type { PrototypeOverlayCustomData } from '@ai-canvas/shared/types';
import type { AssistantDraft, AssistantServiceInput } from '../types';
import { buildPromptDrivenPrototype, expectsFunctionalPrototype } from './prototype-generators';
import { normalizeSource, sentenceCase } from './service-utils';

export function serializePrototypeArtifact(prototype: PrototypeOverlayCustomData): string {
	return JSON.stringify(
		{
			title: prototype.title,
			template: prototype.template,
			activeFile: prototype.activeFile,
			dependencies: prototype.dependencies,
			preview: prototype.preview,
			files: prototype.files,
			showEditor: prototype.showEditor,
			showPreview: prototype.showPreview,
		},
		null,
		2,
	);
}

export function parsePrototypeArtifactContent(value: string): PrototypeOverlayCustomData | null {
	try {
		const parsed = JSON.parse(value) as Record<string, unknown> & {
			prototype?: PrototypeOverlayCustomData;
		};
		return normalizePrototypeOverlay(
			(typeof parsed.prototype === 'object' && parsed.prototype !== null
				? parsed.prototype
				: parsed) as PrototypeOverlayCustomData | Record<string, unknown>,
		);
	} catch {
		return null;
	}
}

export function isStarterPrototypeOutput(prototype: PrototypeOverlayCustomData): boolean {
	const defaultPrototype = normalizePrototypeOverlay({ template: 'react', title: 'Prototype' });
	const appCode = normalizeSource(prototype.files['/App.jsx']?.code);
	const defaultAppCode = normalizeSource(defaultPrototype.files['/App.jsx']?.code);
	const stylesCode = normalizeSource(prototype.files['/styles.css']?.code);
	const defaultStylesCode = normalizeSource(defaultPrototype.files['/styles.css']?.code);

	return (
		appCode === defaultAppCode ||
		stylesCode === defaultStylesCode ||
		appCode.includes('PulseBoard') ||
		appCode.includes('launch: {') ||
		appCode.includes('pipeline: {')
	);
}

export function isFunctionalPrototypeOutput(
	prototype: PrototypeOverlayCustomData,
	message: string,
): boolean {
	if (!expectsFunctionalPrototype(message)) {
		return true;
	}

	const appCode = normalizeSource(prototype.files['/App.jsx']?.code);
	const hasState = appCode.includes('useState');
	const hasInteraction = appCode.includes('onClick') || appCode.includes('onSubmit');
	const looksLikeMarketing =
		appCode.includes('Start Free') ||
		appCode.includes('Book Demo') ||
		appCode.includes('See the tour') ||
		appCode.includes('Conversion-ready website');

	if (/calculator/i.test(message)) {
		const hasCalculatorBehavior =
			appCode.includes('evaluateExpression') ||
			appCode.includes('CalculatorButton') ||
			appCode.includes("label: '='") ||
			appCode.includes("label: '÷'");
		return hasState && hasInteraction && hasCalculatorBehavior && !looksLikeMarketing;
	}

	return hasState && hasInteraction && !looksLikeMarketing;
}

export function buildPrototypeFallback(input: AssistantServiceInput): PrototypeOverlayCustomData {
	return buildPromptDrivenPrototype(input);
}

export function buildPrototypeDraft(input: AssistantServiceInput): AssistantDraft {
	const prototype = buildPrototypeFallback(input);
	const serialized = serializePrototypeArtifact(prototype);

	return {
		content: [
			'Prepared prototype files for the canvas.',
			'',
			`Request: ${sentenceCase(input.message)}`,
			'',
			'The output includes a full multi-file prototype payload that can be inserted onto the canvas or applied to a selected prototype.',
		].join('\n'),
		artifacts: [{ type: 'prototype-files', content: serialized }],
	};
}
