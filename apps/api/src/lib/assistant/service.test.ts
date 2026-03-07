import { describe, expect, it } from 'vitest';
import { generateAssistantResponse } from './service';

describe('assistant service', () => {
	it('returns a chat response', async () => {
		const result = await generateAssistantResponse({
			message: 'help me scope this canvas',
			contextMode: 'all',
			generationMode: 'chat',
		});

		expect(result.message.role).toBe('assistant');
		expect(result.message.generationMode).toBe('chat');
		expect(result.message.content).toContain('whole-canvas');
	});

	it('returns Mermaid artifacts for Mermaid mode', async () => {
		const result = await generateAssistantResponse({
			message: 'design auth flow',
			contextMode: 'selected',
			generationMode: 'mermaid',
		});

		expect(result.message.artifacts?.[0]).toMatchObject({ type: 'mermaid' });
		expect(result.message.content).toContain('```mermaid');
	});

	it('returns D2 artifacts for d2 mode', async () => {
		const result = await generateAssistantResponse({
			message: 'service dependencies',
			contextMode: 'all',
			generationMode: 'd2',
		});

		expect(result.message.artifacts?.[0]).toMatchObject({ type: 'd2' });
		expect(result.message.content).toContain('```d2');
	});

	it('returns kanban operations for kanban mode', async () => {
		const result = await generateAssistantResponse({
			message: 'plan launch tasks',
			contextMode: 'all',
			generationMode: 'kanban',
		});

		expect(result.message.artifacts?.[0]).toMatchObject({ type: 'kanban-ops' });
		expect(result.message.content).toContain('```json');
	});
});
