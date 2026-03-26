import { describe, expect, it } from 'vitest';
import {
	buildAnthropicConversation,
	getLastDiagramArtifact,
	inferPrototypeTemplate,
	resolveGenerationMode,
} from './generation-mode';
import type { AssistantServiceInput } from './types';

function createInput(overrides?: Partial<AssistantServiceInput>): AssistantServiceInput {
	return {
		message: 'Help me',
		contextMode: 'none',
		...overrides,
	};
}

describe('generation mode helpers', () => {
	it('resolves follow-up media requests from prior history', () => {
		const mode = resolveGenerationMode(
			createInput({
				message: 'make it warmer',
				history: [
					{
						id: 'assistant-1',
						role: 'assistant',
						content: 'Here is the first sketch',
						generationMode: 'sketch',
						createdAt: new Date().toISOString(),
					},
				],
			}),
		);

		expect(mode).toBe('sketch');
	});

	it('builds an anthropic conversation from sanitized history plus the latest message', () => {
		const conversation = buildAnthropicConversation(
			createInput({
				history: [
					{
						id: 'user-1',
						role: 'user',
						content: '  First request  ',
						createdAt: new Date().toISOString(),
					},
				],
			}),
			'Latest prompt',
		);

		expect(conversation).toEqual([
			{ role: 'user', content: 'First request' },
			{ role: 'user', content: 'Latest prompt' },
		]);
	});

	it('infers the requested prototype template', () => {
		expect(inferPrototypeTemplate(createInput({ message: 'Build a vanilla js dashboard' }))).toBe(
			'vanilla',
		);
		expect(inferPrototypeTemplate(createInput({ message: 'Build a react dashboard' }))).toBe(
			'react',
		);
	});

	it('treats selected prototype rebuild requests as prototype runs', () => {
		expect(
			resolveGenerationMode(
				createInput({
					message: 'turn this into an actual working demo',
					contextMode: 'selected',
					prototypeContext: {
						type: 'prototype',
						title: 'Tetris Game',
						template: 'react',
						files: {},
						activeFile: '/App.jsx',
					},
				}),
			),
		).toBe('prototype');
	});

	it('finds the last diagram artifact from history', () => {
		const artifact = getLastDiagramArtifact([
			{
				id: 'assistant-1',
				role: 'assistant',
				content: '```mermaid\nflowchart TD\nA-->B\n```',
				generationMode: 'mermaid',
				createdAt: new Date().toISOString(),
			},
		]);

		expect(artifact).toEqual({
			mode: 'mermaid',
			content: 'flowchart TD\nA-->B',
		});
	});
});
