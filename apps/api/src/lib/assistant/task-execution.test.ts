import { describe, expect, it } from 'vitest';
import {
	buildMarkdownOverlayArtifact,
	buildPlacementPlanArtifact,
	buildResponseArtifacts,
} from './task-execution';

describe('assistant task execution helpers', () => {
	it('builds an image markdown brief from generated artifacts', async () => {
		const artifact = await buildMarkdownOverlayArtifact({
			message: 'create a launch poster',
			contextMode: 'all',
			mode: 'image',
			artifacts: [
				{
					id: 'artifact-image',
					runId: 'run-1',
					taskId: 'task-1',
					type: 'image',
					title: 'Generated source image',
					content: 'Prompt: create a launch poster',
					createdAt: '2026-03-07T00:00:00.000Z',
				},
				{
					id: 'artifact-vector',
					runId: 'run-1',
					taskId: 'task-2',
					type: 'image-vector',
					title: 'Vectorized generated asset',
					content: 'Vectorized asset derived from generated source image',
					createdAt: '2026-03-07T00:00:01.000Z',
				},
			],
		});

		expect(artifact.title).toBe('Generated asset markdown brief');
		expect(artifact.content).toContain('# Generated Asset Brief');
		expect(artifact.content).toContain('Vectorized asset: Vectorized generated asset');
	});

	it('builds an avoid-overlap placement plan', () => {
		const plan = buildPlacementPlanArtifact({
			title: 'Canvas placement plan',
			artifacts: [
				{
					id: 'artifact-markdown',
					runId: 'run-1',
					taskId: 'task-1',
					type: 'markdown',
					title: 'Generated markdown overlay',
					content: '# Mermaid Draft',
					createdAt: '2026-03-07T00:00:00.000Z',
				},
			],
		});

		expect(plan.title).toBe('Canvas placement plan');
		expect(plan.content).toContain('"strategy": "avoid-overlap"');
		expect(plan.content).toContain('"artifactType": "markdown"');
	});

	it('deduplicates persisted and service artifacts by type/content', () => {
		const artifacts = buildResponseArtifacts(
			[
				{
					id: 'artifact-markdown',
					runId: 'run-1',
					taskId: 'task-1',
					type: 'markdown',
					title: 'Generated markdown overlay',
					content: '# Mermaid Draft',
					createdAt: '2026-03-07T00:00:00.000Z',
				},
			],
			['markdown'],
			[{ type: 'markdown', content: '# Mermaid Draft' }],
		);

		expect(artifacts).toEqual([{ type: 'markdown', content: '# Mermaid Draft' }]);
	});
});
