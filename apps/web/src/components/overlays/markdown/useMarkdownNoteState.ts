import { useMountEffect } from '@/hooks/useMountEffect';
import type { normalizeMarkdownOverlay } from '@ai-canvas/shared/schemas';
import type { MarkdownEditorMode, MarkdownNoteSettings } from '@ai-canvas/shared/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import { prewarmImageCache } from './markdown-media';
import type { ControlsLayout, UtilityPanel } from './markdown-note-helpers';
import type { MarkdownViewMode } from './markdown-note-helpers';
import type { MarkdownNoteProps } from './markdown-note-types';
import { useMarkdownActivity } from './useMarkdownActivity';
import { useMarkdownCheckbox } from './useMarkdownCheckbox';
import { useMarkdownCommit } from './useMarkdownCommit';
import { useMarkdownDerivedState } from './useMarkdownDerivedState';
import { useMarkdownLayout } from './useMarkdownLayout';
import { useMarkdownMedia } from './useMarkdownMedia';
import { hasLocalEdits as checkHasLocalEdits, useMarkdownSync } from './useMarkdownSync';
import { useMarkdownTitle } from './useMarkdownTitle';
import { useMarkdownUtilityPanel } from './useMarkdownUtilityPanel';

interface UseMarkdownNoteStateResult {
	normalizedElement: ReturnType<typeof normalizeMarkdownOverlay>;
	title: string;
	content: string;
	images: Record<string, string>;
	settings: MarkdownNoteSettings;
	editorMode: MarkdownEditorMode;
	isPreview: boolean;
	activeUtilityPanel: UtilityPanel;
	isCompactControlsVisible: boolean;
	titleNotice: boolean;
	showHeader: boolean;
	controlsLayout: ControlsLayout;
	compactTitle: boolean;
	activeMode: MarkdownViewMode;
	surfaceBackground: string;
	showCompactControls: boolean;
	hasLocalEdits: boolean;
	fileInputRef: RefObject<HTMLInputElement | null>;
	utilityPanelRef: RefObject<HTMLDivElement | null>;
	detachedUtilityPanelRef: RefObject<HTMLDivElement | null>;
	headerRef: RefObject<HTMLDivElement | null>;
	setTitle: Dispatch<SetStateAction<string>>;
	setContent: Dispatch<SetStateAction<string>>;
	setImages: Dispatch<SetStateAction<Record<string, string>>>;
	setSettings: Dispatch<SetStateAction<MarkdownNoteSettings>>;
	setEditorMode: Dispatch<SetStateAction<MarkdownEditorMode>>;
	setIsPreview: Dispatch<SetStateAction<boolean>>;
	setActiveUtilityPanel: Dispatch<SetStateAction<UtilityPanel>>;
	setIsCompactControlsVisible: Dispatch<SetStateAction<boolean>>;
	handleCommit: () => void;
	handleSurfaceStyleChange: (elementStyle: {
		backgroundColor?: string;
		strokeColor?: string;
		strokeWidth?: number;
		roundness?: ExcalidrawElement['roundness'];
	}) => void;
	handleTitleChange: (nextValue: string) => void;
	handleTitleBlur: () => void;
	insertImageFiles: (fileList: FileList | null) => Promise<void>;
	handlePreviewCheckboxToggle: (lineIndex: number) => void;
	handleEditorCheckboxToggle: (lineIndex: number) => void;
}

interface MarkdownNoteStateArgs extends MarkdownNoteProps {
	normalizedElement?: ReturnType<typeof normalizeMarkdownOverlay>;
	sourceSignature?: string;
}

export function useMarkdownNoteState({
	element,
	isSelected,
	onChange,
	onActivityChange,
	normalizedElement,
	sourceSignature,
}: MarkdownNoteStateArgs): UseMarkdownNoteStateResult {
	// External data synchronization
	const { resolvedNormalizedElement, resolvedSourceSignature } = useMarkdownSync({
		element,
		normalizedElement,
		sourceSignature,
	});

	// Core state
	const [content, setContent] = useState(resolvedNormalizedElement.content);
	const [images, setImages] = useState<Record<string, string>>(
		resolvedNormalizedElement.images ?? {},
	);
	const [settings, setSettings] = useState(resolvedNormalizedElement.settings);
	const [editorMode, setEditorMode] = useState<MarkdownEditorMode>(
		resolvedNormalizedElement.editorMode ?? 'raw',
	);
	const [isPreviewState, setIsPreview] = useState(false);

	// State ref for commit/checkbox handlers that need synchronous access
	const stateRef = useRef({
		content,
		images,
		title: resolvedNormalizedElement.title,
		settings,
		editorMode,
	});

	// Commit logic hook
	const commit = useMarkdownCommit({
		elementId: element.id,
		onChange,
		externalSignature: resolvedSourceSignature,
	});

	// Utility panel hook
	const utilityPanel = useMarkdownUtilityPanel({ isSelected });

	// Title hook
	const titleState = useMarkdownTitle({
		initialTitle: resolvedNormalizedElement.title,
		onTitleChange: useCallback(
			(newTitle: string) => {
				commit.scheduleAutoCommit({
					...stateRef.current,
					title: newTitle,
					isPreview: isPreviewState,
					activeUtilityPanel: utilityPanel.activeUtilityPanel,
				});
			},
			[commit.scheduleAutoCommit, isPreviewState, utilityPanel.activeUtilityPanel],
		),
	});

	// Keep stateRef synchronized with latest state
	stateRef.current = { content, images, title: titleState.title, settings, editorMode };

	// Combined preview state for layout and derived calculations
	const isPreview = !isSelected ? true : isPreviewState;

	// Layout hook
	const layout = useMarkdownLayout({
		isSelected,
		autoHideToolbar: settings.autoHideToolbar,
		elementWidth: element.width,
		isCompactControlsVisible: utilityPanel.isCompactControlsVisible,
		activeUtilityPanel: utilityPanel.activeUtilityPanel,
		isPreview,
	});

	// Derived UI state
	const derived = useMarkdownDerivedState({
		isSelected,
		isPreviewState,
		editorMode,
		activeUtilityPanel: utilityPanel.activeUtilityPanel,
		elementBackgroundColor: element.backgroundColor,
		settings,
		elementWidth: element.width,
		autoHideToolbar: settings.autoHideToolbar,
		isCompactControlsVisibleState: utilityPanel.isCompactControlsVisible,
	});

	// Media hook
	const media = useMarkdownMedia({
		scheduleAutoCommit: useCallback(() => {
			commit.scheduleAutoCommit({
				...stateRef.current,
				isPreview,
				activeUtilityPanel: utilityPanel.activeUtilityPanel,
			});
		}, [commit.scheduleAutoCommit, isPreview, utilityPanel.activeUtilityPanel]),
		onPanelClose: useCallback(
			() => utilityPanel.setActiveUtilityPanel('none'),
			[utilityPanel.setActiveUtilityPanel],
		),
	});

	// Checkbox hook
	const checkbox = useMarkdownCheckbox({
		elementId: element.id,
		onChangeRef: commit.onChangeRef,
		lastCommittedSignatureRef: commit.lastCommittedSignatureRef,
		stateRef,
	});

	// Activity tracking
	useMarkdownActivity({
		isEditing: isSelected && (!isPreview || utilityPanel.activeUtilityPanel !== 'none'),
		onActivityChange,
	});

	// Cleanup debounce on unmount
	useMountEffect(() => () => commit.cleanupDebounce(stateRef.current));

	// Prewarm image cache
	const hasPrewarmedRef = useRef(false);
	useMountEffect(() => {
		if (!hasPrewarmedRef.current && Object.keys(images).length > 0) {
			hasPrewarmedRef.current = true;
			prewarmImageCache(images);
		}
	});

	// Setter factory with auto-commit
	const makeSetter = <T>(
		setter: Dispatch<SetStateAction<T>>,
		key: keyof typeof stateRef.current,
		current: T,
	) =>
		useCallback(
			(value: SetStateAction<T>) => {
				const next = typeof value === 'function' ? (value as (prev: T) => T)(current) : value;
				setter(next);
				stateRef.current = { ...stateRef.current, [key]: next };
				commit.scheduleAutoCommit({
					...stateRef.current,
					isPreview: derived.isPreview,
					activeUtilityPanel: utilityPanel.activeUtilityPanel,
				});
			},
			[
				setter,
				current,
				commit.scheduleAutoCommit,
				derived.isPreview,
				utilityPanel.activeUtilityPanel,
			],
		);

	const setContentState = makeSetter(setContent, 'content', content);
	const setImagesState = makeSetter(setImages, 'images', images);
	const setSettingsState = makeSetter(setSettings, 'settings', settings);
	const setEditorModeState = makeSetter(setEditorMode, 'editorMode', editorMode);

	// Local edits detection
	const hasLocalEdits = useMemo(
		() => checkHasLocalEdits(stateRef.current, resolvedNormalizedElement),
		[resolvedNormalizedElement, content, images, titleState.title, settings, editorMode],
	);

	// Handler wrappers
	const handleCommit = useCallback(
		() => commit.handleCommit(stateRef.current),
		[commit.handleCommit],
	);

	const handleSurfaceStyleChange = useCallback(
		(elementStyle: {
			backgroundColor?: string;
			strokeColor?: string;
			strokeWidth?: number;
			roundness?: ExcalidrawElement['roundness'];
		}) => {
			const fn = commit.onChangeRef.current;
			if (fn)
				fn(
					element.id,
					stateRef.current.content,
					stateRef.current.images,
					stateRef.current.title,
					stateRef.current.settings,
					stateRef.current.editorMode,
					elementStyle,
				);
		},
		[element.id, commit.onChangeRef],
	);

	const insertImageFiles = useCallback(
		async (fileList: FileList | null) => {
			const result = await media.insertImageFiles(fileList, {
				content: stateRef.current.content,
				images: stateRef.current.images,
			});
			if (result) {
				setImagesState(result.nextImages);
				setContentState(result.nextContent);
			}
		},
		[media.insertImageFiles, setContentState, setImagesState],
	);

	const handleEditorCheckboxToggle = useCallback(
		(lineIndex: number) => {
			checkbox.handleEditorCheckboxToggle(lineIndex, (newContent) => setContentState(newContent));
		},
		[checkbox.handleEditorCheckboxToggle, setContentState],
	);

	return {
		normalizedElement: resolvedNormalizedElement,
		title: titleState.title,
		content,
		images,
		settings,
		editorMode,
		isPreview: derived.isPreview,
		activeUtilityPanel: utilityPanel.activeUtilityPanel,
		isCompactControlsVisible: layout.effectiveIsCompactControlsVisible,
		titleNotice: titleState.titleNotice,
		showHeader: derived.showHeader,
		controlsLayout: derived.controlsLayout,
		compactTitle: derived.compactTitle,
		activeMode: derived.activeMode,
		surfaceBackground: derived.surfaceBackground,
		showCompactControls: derived.showCompactControls,
		hasLocalEdits,
		fileInputRef: media.fileInputRef,
		utilityPanelRef: utilityPanel.utilityPanelRef,
		detachedUtilityPanelRef: utilityPanel.detachedUtilityPanelRef,
		headerRef: layout.headerRef,
		setTitle: titleState.setTitle,
		setContent: setContentState,
		setImages: setImagesState,
		setSettings: setSettingsState,
		setEditorMode: setEditorModeState,
		setIsPreview,
		setActiveUtilityPanel: utilityPanel.setActiveUtilityPanel,
		setIsCompactControlsVisible: utilityPanel.setIsCompactControlsVisible,
		handleCommit,
		handleSurfaceStyleChange,
		handleTitleChange: titleState.handleTitleChange,
		handleTitleBlur: titleState.handleTitleBlur,
		insertImageFiles,
		handlePreviewCheckboxToggle: checkbox.handlePreviewCheckboxToggle,
		handleEditorCheckboxToggle,
	};
}
