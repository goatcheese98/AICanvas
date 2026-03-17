import { describe, expect, it } from 'vitest';
import {
	assistantSchemas,
	parseStoredAssistantAssetContent,
	serializeStoredAssistantAssetContent,
} from './assistant';

describe('assistant schemas', () => {
	it('requires threadId for run creation', () => {
		const result = assistantSchemas.createRun.safeParse({
			message: 'Help me summarize this canvas',
			contextMode: 'all',
		});

		expect(result.success).toBe(false);
	});

	it('requires canvasId for run creation', () => {
		const result = assistantSchemas.createRun.safeParse({
			threadId: 'thread-1',
			message: 'Help me summarize this canvas',
			contextMode: 'all',
		});

		expect(result.success).toBe(false);
	});

	it('normalizes custom thread titles', () => {
		const result = assistantSchemas.createThread.parse({
			canvasId: 'canvas-123',
			title: '   Sprint   planning   ',
		});

		expect(result).toEqual({
			canvasId: 'canvas-123',
			title: 'Sprint planning',
		});
	});

	it('accepts canvas-scoped thread listing requests', () => {
		expect(
			assistantSchemas.listThreads.parse({
				canvasId: 'canvas-abc',
			}),
		).toEqual({
			canvasId: 'canvas-abc',
		});
	});

	it('accepts typed selected-context snapshots on runs', () => {
		const result = assistantSchemas.createRun.parse({
			threadId: 'thread-1',
			canvasId: 'canvas-1',
			message: 'Update this note',
			contextMode: 'selected',
			selectedElementIds: ['note-1'],
			contextSnapshot: {
				canvasId: 'canvas-1',
				totalElementCount: 3,
				selectedElementIds: ['note-1'],
				selectedElementCount: 1,
				selectedOverlayTypes: ['markdown'],
				canvasMeta: {
					title: 'Launch canvas',
				},
				canvasSummary: {
					elementTypeCounts: { rectangle: 3 },
					overlayTypeCounts: { markdown: 1 },
					textBearingElementCount: 1,
					editableOverlayCount: 1,
					selectedCount: 1,
					hasKanban: false,
					hasMarkdown: true,
					hasPrototype: false,
					highlights: ['Release checklist'],
				},
				canvasElementSummaries: [
					{
						id: 'shape-1',
						elementType: 'rectangle',
						label: 'Launch milestone',
					},
				],
				selectionEnvironment: [
					{
						id: 'shape-2',
						elementType: 'ellipse',
						label: 'Nearby idea',
						distanceFromSelection: 18,
					},
				],
				selectionSummary: [
					{
						id: 'note-1',
						elementType: 'rectangle',
						overlayType: 'markdown',
						label: 'Release checklist',
					},
				],
				selectedContexts: [
					{
						kind: 'markdown',
						id: 'note-1',
						priority: 1,
						elementType: 'rectangle',
						overlayType: 'markdown',
						label: 'Checklist',
						bounds: {
							x: 10,
							y: 20,
							width: 320,
							height: 220,
						},
						styleHints: {
							backgroundColor: '#fff',
							strokeColor: '#222',
							fillStyle: 'solid',
							roughness: 0,
							roundness: 'type:2,value:16',
							opacity: 100,
						},
						textExcerpt: '# Release checklist',
						markdown: {
							type: 'markdown',
							title: 'Notes',
							content: '# Release checklist',
						},
					},
				],
			},
		});

		expect(result.contextSnapshot?.selectedContexts[0]).toMatchObject({
			kind: 'markdown',
			id: 'note-1',
		});
	});

	it('serializes and parses stored assistant asset content', () => {
		const serialized = serializeStoredAssistantAssetContent({
			kind: 'stored_asset',
			r2Key: 'assistant-assets/run-1/image.png',
			mimeType: 'image/png',
			provider: 'openrouter',
			model: 'image-v1',
			prompt: 'Draw a mascot',
			revisedPrompt: 'Draw a mascot on white background',
			tool: 'vectorize_asset',
			byteSize: 1234,
			sourceArtifactId: 'artifact-source',
			artifactId: 'artifact-1',
			runId: 'run-1',
		});

		expect(parseStoredAssistantAssetContent(serialized)).toEqual({
			kind: 'stored_asset',
			r2Key: 'assistant-assets/run-1/image.png',
			mimeType: 'image/png',
			provider: 'openrouter',
			model: 'image-v1',
			prompt: 'Draw a mascot',
			revisedPrompt: 'Draw a mascot on white background',
			tool: 'vectorize_asset',
			byteSize: 1234,
			sourceArtifactId: 'artifact-source',
			artifactId: 'artifact-1',
			runId: 'run-1',
		});
	});

	it('rejects invalid stored assistant asset content', () => {
		expect(parseStoredAssistantAssetContent('not json')).toBeNull();
		expect(
			parseStoredAssistantAssetContent(
				JSON.stringify({
					kind: 'stored_asset',
					r2Key: '',
					mimeType: 'image/png',
					provider: 'openrouter',
				}),
			),
		).toBeNull();
	});
});
