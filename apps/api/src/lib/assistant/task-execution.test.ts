import { describe, expect, it } from 'vitest';
import {
	buildMarkdownOverlayArtifact,
	buildPlacementPlanArtifact,
	buildResponseArtifacts,
	buildResponseSummary,
	createImageGenerationInput,
	resolveSourceArtifactForTask,
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

	it('reports prototype run failures without claiming a file bundle was produced', () => {
		const summary = buildResponseSummary({
			mode: 'prototype',
			message: 'build a prototype landing page for prompt workflows',
			summary: 'Prepared prototype files for the canvas.',
			artifacts: [],
		});

		expect(summary).toContain('Prototype generation did not produce a valid file bundle.');
		expect(summary).toContain('No prototype artifact was stored for this run.');
		expect(summary).not.toContain('Prepared artifacts:');
	});

	it('resolves vectorization inputs from the referenced upstream image task', () => {
		const artifact = resolveSourceArtifactForTask({
			currentTaskId: 'task-vectorize',
			sourceArtifactType: 'image',
			sourceTaskType: 'generate_image',
			tasks: [
				{
					id: 'task-generate-image',
					runId: 'run-1',
					type: 'generate_image',
					status: 'completed',
					title: 'Generate source image',
					output: {
						kind: 'artifact_created',
						artifactIds: ['artifact-source-image'],
					},
					createdAt: '2026-03-07T00:00:00.000Z',
					updatedAt: '2026-03-07T00:00:01.000Z',
				},
				{
					id: 'task-generate-response',
					runId: 'run-1',
					type: 'generate_response',
					status: 'completed',
					title: 'Generate assistant response',
					output: {
						kind: 'artifact_created',
						artifactIds: ['artifact-unrelated-image'],
					},
					createdAt: '2026-03-07T00:00:02.000Z',
					updatedAt: '2026-03-07T00:00:03.000Z',
				},
				{
					id: 'task-vectorize',
					runId: 'run-1',
					type: 'vectorize_asset',
					status: 'queued',
					title: 'Vectorize generated asset',
					createdAt: '2026-03-07T00:00:04.000Z',
					updatedAt: '2026-03-07T00:00:04.000Z',
				},
			],
			artifacts: [
				{
					id: 'artifact-source-image',
					runId: 'run-1',
					taskId: 'task-generate-image',
					type: 'image',
					title: 'Generated source image',
					content: '{}',
					createdAt: '2026-03-07T00:00:01.000Z',
				},
				{
					id: 'artifact-unrelated-image',
					runId: 'run-1',
					taskId: 'task-generate-response',
					type: 'image',
					title: 'Other image artifact',
					content: '{}',
					createdAt: '2026-03-07T00:00:03.000Z',
				},
			],
		});

		expect(artifact?.id).toBe('artifact-source-image');
	});

	it('falls back to the explicit source artifact id when provided', () => {
		const artifact = resolveSourceArtifactForTask({
			currentTaskId: 'task-vectorize',
			sourceArtifactType: 'image',
			sourceArtifactId: 'artifact-explicit',
			sourceTaskType: 'generate_image',
			tasks: [],
			artifacts: [
				{
					id: 'artifact-latest',
					runId: 'run-1',
					taskId: 'task-other',
					type: 'image',
					title: 'Latest image artifact',
					content: '{}',
					createdAt: '2026-03-07T00:00:02.000Z',
				},
				{
					id: 'artifact-explicit',
					runId: 'run-1',
					taskId: 'task-generate-image',
					type: 'image',
					title: 'Explicit image artifact',
					content: '{}',
					createdAt: '2026-03-07T00:00:01.000Z',
				},
			],
		});

		expect(artifact?.id).toBe('artifact-explicit');
	});

	it('adds anti-signature guidance to generated image prompts', () => {
		expect(createImageGenerationInput('draw an elephant', 'sketch').prompt).toContain(
			'no signature, watermark, caption, label, or text',
		);
		expect(createImageGenerationInput('draw an elephant', 'image').prompt).toContain(
			'no signature, watermark, caption, label, or text',
		);
		expect(createImageGenerationInput('draw an elephant', 'sketch').prompt).toContain(
			'solid pure white background (#FFFFFF)',
		);
		expect(createImageGenerationInput('draw an elephant', 'sketch').prompt).toContain(
			'avoid any artifact or residue touching the outer edges of the image',
		);
		expect(createImageGenerationInput('draw an elephant', 'sketch').prompt).toContain(
			'dark contour lines should be continuous, smooth, and flow naturally',
		);
		expect(createImageGenerationInput('draw an elephant', 'image').prompt).toContain(
			'preserve the subject in color unless the user explicitly asks for monochrome, grayscale, black-and-white, or silhouette-only treatment',
		);
		expect(createImageGenerationInput('draw an elephant', 'image').prompt).toContain(
			'render the subject in full color with a deliberate palette that matches the request rather than defaulting to grayscale or black ink',
		);
	});
});
