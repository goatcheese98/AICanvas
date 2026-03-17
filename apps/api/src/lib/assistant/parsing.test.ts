import { describe, expect, it } from 'vitest';
import {
	buildConversationPrompt,
	buildD2Prompt,
	buildKanbanPrompt,
	buildMermaidPrompt,
	buildPrototypePrompt,
	extractCodeBlock,
} from './parsing';

describe('assistant parsing helpers', () => {
	it('extracts fenced code blocks by language', () => {
		const text = ['before', '```mermaid', 'flowchart TD', '  A --> B', '```', 'after'].join('\n');
		expect(extractCodeBlock(text, 'mermaid')).toBe('flowchart TD\n  A --> B');
		expect(extractCodeBlock(text, 'd2')).toBeNull();
	});

	it('builds conversation prompts from history', () => {
		expect(
			buildConversationPrompt([
				{ role: 'user', text: 'hello' },
				{ role: 'assistant', text: 'world' },
			]),
		).toBe('USER: hello\n\nASSISTANT: world');
	});

	it('builds mode-specific prompts', () => {
		expect(buildMermaidPrompt('Map login flow')).toContain('Mermaid');
		expect(buildD2Prompt('Map login flow')).toContain('d2 code block');
		expect(buildKanbanPrompt('Plan launch')).toContain('JSON kanban operations');
	});

	it('guides prototype generation toward request-specific responsive layouts', () => {
		const prompt = buildPrototypePrompt('Create a calculator app');

		expect(prompt).toContain('Start from a blank file graph');
		expect(prompt).toContain('/index.jsx is the required runtime entry file');
		expect(prompt).toContain('Do not assume /App.jsx or /styles.css');
		expect(prompt).toContain('Choose the layout based on the requested workflow');
		expect(prompt).toContain(
			'build a working interactive product surface instead of a marketing site',
		);
		expect(prompt).toContain('Treat the canvas as a resizable container');
		expect(prompt).toContain('Avoid in-app runtime labels like "Ready"');
	});
});
