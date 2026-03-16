import { describe, expect, it } from 'vitest';
import {
	buildMarkdownOverlayArtifact,
	buildPlacementPlanArtifact,
	buildResponseArtifacts,
	buildResponseSummary,
} from './task-execution';

describe('assistant task execution helpers', () => {
	it('builds a generic markdown overlay for non-image modes', async () => {
		const artifact = await buildMarkdownOverlayArtifact({
			message: 'diagram the auth flow',
			contextMode: 'all',
			mode: 'mermaid',
			artifacts: [],
		});

		expect(artifact.title).toBe('Generated markdown overlay');
		expect(artifact.content).toContain('# Mermaid Draft');
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

	it('adds downloadable identifiers to stored image artifacts in responses', () => {
		const artifacts = buildResponseArtifacts(
			[
				{
					id: 'artifact-image',
					runId: 'run-1',
					taskId: 'task-1',
					type: 'image',
					title: 'Generated source image',
					content: JSON.stringify({
						kind: 'stored_asset',
						r2Key: 'assistant-assets/run-1/image.png',
						mimeType: 'image/png',
						provider: 'cloudflare',
					}),
					createdAt: '2026-03-07T00:00:00.000Z',
				},
			],
			['image'],
		);

		expect(JSON.parse(artifacts[0]?.content ?? '{}')).toMatchObject({
			artifactId: 'artifact-image',
			runId: 'run-1',
			mimeType: 'image/png',
		});
	});

	it('keeps image summaries focused on the generated asset only', () => {
		const summary = buildResponseSummary({
			mode: 'image',
			message: 'create an image of a bus',
			summary: 'Generated an image preview ready to insert.',
			artifacts: [
				{
					id: 'artifact-image',
					runId: 'run-1',
					taskId: 'task-1',
					type: 'image',
					title: 'Generated source image',
					content: '{}',
					createdAt: '2026-03-07T00:00:00.000Z',
				},
			],
		});

		expect(summary).toContain('Generated an image preview ready to insert.');
		expect(summary).not.toContain('asset brief');
		expect(summary).not.toContain('placement plan');
	});
});
