import { useState } from 'react';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AssistantArtifact } from '@ai-canvas/shared/types';
import type { AssistantPatchApplyState } from './ai-chat-types';
import { useAIChatPatchActions } from './useAIChatPatchActions';

function createMarkdownElement() {
	return {
		id: 'note-1',
		type: 'rectangle',
		x: 0,
		y: 0,
		width: 400,
		height: 320,
		angle: 0,
		backgroundColor: '#ffffff',
		strokeColor: '#111827',
		strokeWidth: 1,
		strokeStyle: 'solid',
		fillStyle: 'solid',
		roughness: 0,
		opacity: 100,
		groupIds: [],
		frameId: null,
		roundness: null,
		boundElements: null,
		updated: 1,
		link: null,
		locked: false,
		version: 1,
		versionNonce: 1,
		isDeleted: false,
		seed: 1,
		index: 'a0' as never,
		customData: {
			type: 'markdown',
			title: 'Notes',
			content: '# Notes\n\nOld line',
			images: {},
			settings: {
				fontSize: 16,
				lineHeight: 1.6,
				autoHideToolbar: true,
				background: '#ffffff',
				font: 'system-ui',
			},
			editorMode: 'raw',
		},
	} as const;
}

describe('useAIChatPatchActions', () => {
	it('applies and undoes markdown patches against the canvas scene', () => {
		const updateScene = vi.fn();
		const setElements = vi.fn();
		const setChatError = vi.fn();
		const sceneElements = [createMarkdownElement()];
		const appState = {
			scrollX: 0,
			scrollY: 0,
			selectedElementIds: { 'note-1': true },
			zoom: { value: 1 },
		};
		const artifact: AssistantArtifact = {
			type: 'markdown-patch',
			content: JSON.stringify({
				kind: 'markdown_patch',
				targetId: 'note-1',
				summary: 'Adds an AI update.',
				base: { title: 'Notes', content: '# Notes\n\nOld line' },
				next: { title: 'Notes', content: '# Notes\n\nOld line\n\n## AI Update' },
			}),
		};

		const { result } = renderHook(() => {
			const [assistantPatchStates, setAssistantPatchStates] = useState<
				Record<string, AssistantPatchApplyState>
			>({});
			return {
				assistantPatchStates,
				...useAIChatPatchActions({
					excalidrawApi: {
						getSceneElements: () => sceneElements,
						getAppState: () => appState as never,
						getFiles: () => ({}),
						updateScene,
					} as never,
					setElements,
					setChatError,
					assistantPatchStates,
					setAssistantPatchStates,
				}),
			};
		});

		act(() => {
			expect(result.current.applyAssistantPatch('artifact-1', artifact)).toBe(true);
		});

		expect(updateScene).toHaveBeenCalledTimes(1);
		expect(result.current.assistantPatchStates['artifact-1']).toMatchObject({
			status: 'applied',
			targetId: 'note-1',
			targetType: 'markdown',
		});

		act(() => {
			result.current.undoAssistantPatch('artifact-1');
		});

		expect(updateScene).toHaveBeenCalledTimes(2);
		expect(result.current.assistantPatchStates['artifact-1']).toMatchObject({
			status: 'undone',
		});
		expect(setChatError).not.toHaveBeenCalled();
	});
});
