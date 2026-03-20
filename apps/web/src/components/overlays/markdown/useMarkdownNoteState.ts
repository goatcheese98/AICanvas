import { useMountEffect } from '@/hooks/useMountEffect';
import { normalizeMarkdownOverlay } from '@ai-canvas/shared/schemas';
import type { MarkdownEditorMode, MarkdownNoteSettings } from '@ai-canvas/shared/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import { prewarmImageCache } from './markdown-media';
import { serializeOverlayState, type ControlsLayout, type UtilityPanel } from './markdown-note-helpers';
import type { MarkdownViewMode } from './markdown-note-helpers';
import type { MarkdownNoteProps } from './markdown-note-types';
import { useMarkdownActivity } from './useMarkdownActivity';
import { useMarkdownCheckbox } from './useMarkdownCheckbox';
import { useMarkdownCommit, type OnChangeCallback } from './useMarkdownCommit';
import { useMarkdownLayout } from './useMarkdownLayout';
import { useMarkdownMedia } from './useMarkdownMedia';
import { useMarkdownTitle } from './useMarkdownTitle';
import { useMarkdownUtilityPanel } from './useMarkdownUtilityPanel';

interface UseMarkdownNoteStateResult {
	normalizedElement: MarkdownNoteStateArgs['normalizedElement'];
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
	const resolvedNormalizedElement = useMemo(
		() => normalizedElement ?? normalizeMarkdownOverlay(element.customData),
		[element.customData, normalizedElement],
	);
	const resolvedSourceSignature = useMemo(
		() => sourceSignature ?? serializeOverlayState(resolvedNormalizedElement),
		[resolvedNormalizedElement, sourceSignature],
	);

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

	// Derived state refs for commit/checkbox logic
	const stateRef = useRef({
		content,
		images,
		title: resolvedNormalizedElement.title,
		settings,
		editorMode,
	});

	// Commit logic hook
	const {
		onChangeRef,
		externalSignatureRef,
		lastCommittedSignatureRef,
		debounceTimeoutRef,
		handleCommit,
		scheduleAutoCommit,
		cleanupDebounce,
	} = useMarkdownCommit({
		elementId: element.id,
		onChange,
		externalSignature: resolvedSourceSignature,
	});

	// Utility panel hook
	const utilityPanelState = useMarkdownUtilityPanel({ isSelected });

	// Title hook
	const {
		title,
		setTitle,
		titleNotice,
		handleTitleChange,
		handleTitleBlur,
	} = useMarkdownTitle({
		initialTitle: resolvedNormalizedElement.title,
		onTitleChange: useCallback(
			(newTitle: string) => {
				scheduleAutoCommit({
					content: stateRef.current.content,
					images: stateRef.current.images,
					title: newTitle,
					settings: stateRef.current.settings,
					editorMode: stateRef.current.editorMode,
					isPreview: isPreviewState,
					activeUtilityPanel: utilityPanelState.activeUtilityPanel,
				});
			},
			[scheduleAutoCommit, isPreviewState, utilityPanelState.activeUtilityPanel],
		),
	});

	stateRef.current = {
		content,
		images,
		title,
		settings,
		editorMode,
	};

	// Layout hook
	const {
		headerRef,
		showHeader,
		controlsLayout,
		compactTitle,
		showCompactControls,
		effectiveIsCompactControlsVisible,
	} = useMarkdownLayout({
		isSelected,
		autoHideToolbar: settings.autoHideToolbar,
		elementWidth: element.width,
		isCompactControlsVisible: utilityPanelState.isCompactControlsVisible,
		activeUtilityPanel: utilityPanelState.activeUtilityPanel,
		isPreview: !isSelected ? true : isPreviewState,
	});

	// Media hook
	const { fileInputRef, insertImageFiles: insertImageFilesBase } = useMarkdownMedia({
		scheduleAutoCommit: useCallback(() => {
			scheduleAutoCommit({
				content: stateRef.current.content,
				images: stateRef.current.images,
				title: stateRef.current.title,
				settings: stateRef.current.settings,
				editorMode: stateRef.current.editorMode,
				isPreview: isPreviewState,
				activeUtilityPanel: utilityPanelState.activeUtilityPanel,
			});
		}, [scheduleAutoCommit, isPreviewState, utilityPanelState.activeUtilityPanel]),
		onPanelClose: useCallback(() => {
			utilityPanelState.setActiveUtilityPanel('none');
		}, [utilityPanelState.setActiveUtilityPanel]),
	});

	// Checkbox hook
	const { handleEditorCheckboxToggle, handlePreviewCheckboxToggle } = useMarkdownCheckbox({
		elementId: element.id,
		onChangeRef,
		lastCommittedSignatureRef,
		stateRef,
	});

	// Is preview derived state
	const isPreview = !isSelected ? true : isPreviewState;
	const activeMode: MarkdownViewMode = isPreview ? 'preview' : editorMode;
	const surfaceBackground = element.backgroundColor ?? settings.background;

	// Activity tracking
	const isEditing = isSelected && (!isPreview || utilityPanelState.activeUtilityPanel !== 'none');
	useMarkdownActivity({ isEditing, onActivityChange });

	// Cleanup debounce on unmount
	useMountEffect(() => {
		return () => {
			cleanupDebounce({
				content: stateRef.current.content,
				images: stateRef.current.images,
				title: stateRef.current.title,
				settings: stateRef.current.settings,
				editorMode: stateRef.current.editorMode,
			});
		};
	});

	// Prewarm image cache
	const hasPrewarmedRef = useRef(false);
	useMountEffect(() => {
		if (!hasPrewarmedRef.current && Object.keys(images).length > 0) {
			hasPrewarmedRef.current = true;
			prewarmImageCache(images);
		}
	});

	// Setters with auto-commit
	const setContentState = useCallback(
		(value: SetStateAction<string>) => {
			const nextValue = typeof value === 'function' ? value(content) : value;
			setContent(nextValue);
			stateRef.current = { ...stateRef.current, content: nextValue };
			scheduleAutoCommit({
				...stateRef.current,
				content: nextValue,
				isPreview,
				activeUtilityPanel: utilityPanelState.activeUtilityPanel,
			});
		},
		[content, isPreview, scheduleAutoCommit, utilityPanelState.activeUtilityPanel],
	);

	const setImagesState = useCallback(
		(value: SetStateAction<Record<string, string>>) => {
			const nextValue = typeof value === 'function' ? value(images) : value;
			setImages(nextValue);
			stateRef.current = { ...stateRef.current, images: nextValue };
			scheduleAutoCommit({
				...stateRef.current,
				images: nextValue,
				isPreview,
				activeUtilityPanel: utilityPanelState.activeUtilityPanel,
			});
		},
		[images, isPreview, scheduleAutoCommit, utilityPanelState.activeUtilityPanel],
	);

	const setSettingsState = useCallback(
		(value: SetStateAction<MarkdownNoteSettings>) => {
			const nextValue = typeof value === 'function' ? value(settings) : value;
			setSettings(nextValue);
			stateRef.current = { ...stateRef.current, settings: nextValue };
			scheduleAutoCommit({
				...stateRef.current,
				settings: nextValue,
				isPreview,
				activeUtilityPanel: utilityPanelState.activeUtilityPanel,
			});
		},
		[settings, isPreview, scheduleAutoCommit, utilityPanelState.activeUtilityPanel],
	);

	const setEditorModeState = useCallback(
		(value: SetStateAction<MarkdownEditorMode>) => {
			const nextValue = typeof value === 'function' ? value(editorMode) : value;
			setEditorMode(nextValue);
			stateRef.current = { ...stateRef.current, editorMode: nextValue };
			scheduleAutoCommit({
				...stateRef.current,
				editorMode: nextValue,
				isPreview,
				activeUtilityPanel: utilityPanelState.activeUtilityPanel,
			});
		},
		[editorMode, isPreview, scheduleAutoCommit, utilityPanelState.activeUtilityPanel],
	);

	// Has local edits check
	const hasLocalEdits =
		stateRef.current.content !== resolvedNormalizedElement.content ||
		stateRef.current.title !== resolvedNormalizedElement.title ||
		JSON.stringify(stateRef.current.images) !==
			JSON.stringify(resolvedNormalizedElement.images ?? {}) ||
		JSON.stringify(stateRef.current.settings) !==
			JSON.stringify(resolvedNormalizedElement.settings) ||
		stateRef.current.editorMode !== (resolvedNormalizedElement.editorMode ?? 'raw');

	// Handle commit wrapper
	const handleCommitWrapper = useCallback(() => {
		handleCommit({
			content: stateRef.current.content,
			images: stateRef.current.images,
			title: stateRef.current.title,
			settings: stateRef.current.settings,
			editorMode: stateRef.current.editorMode,
		});
	}, [handleCommit]);

	// Surface style change handler
	const handleSurfaceStyleChange = useCallback(
		(elementStyle: {
			backgroundColor?: string;
			strokeColor?: string;
			strokeWidth?: number;
			roundness?: ExcalidrawElement['roundness'];
		}) => {
			const onChangeFn = onChangeRef.current;
			if (!onChangeFn) return;
			onChangeFn(
				element.id,
				stateRef.current.content,
				stateRef.current.images,
				stateRef.current.title,
				stateRef.current.settings,
				stateRef.current.editorMode,
				elementStyle,
			);
		},
		[element.id],
	);

	// Insert image files wrapper
	const insertImageFiles = useCallback(
		async (fileList: FileList | null) => {
			const result = await insertImageFilesBase(fileList, {
				content: stateRef.current.content,
				images: stateRef.current.images,
			});
			if (result) {
				setImagesState(result.nextImages);
				setContentState(result.nextContent);
			}
		},
		[insertImageFilesBase, setContentState, setImagesState],
	);

	// Wrapped checkbox handlers
	const handleEditorCheckboxToggleWrapper = useCallback(
		(lineIndex: number) => {
			handleEditorCheckboxToggle(lineIndex, (newContent) => {
				setContentState(newContent);
			});
		},
		[handleEditorCheckboxToggle, setContentState],
	);

	return {
		normalizedElement: resolvedNormalizedElement,
		title,
		content,
		images,
		settings,
		editorMode,
		isPreview,
		activeUtilityPanel: utilityPanelState.activeUtilityPanel,
		isCompactControlsVisible: effectiveIsCompactControlsVisible,
		titleNotice,
		showHeader,
		controlsLayout,
		compactTitle,
		activeMode,
		surfaceBackground,
		showCompactControls,
		hasLocalEdits,
		fileInputRef,
		utilityPanelRef: utilityPanelState.utilityPanelRef,
		detachedUtilityPanelRef: utilityPanelState.detachedUtilityPanelRef,
		headerRef,
		setTitle,
		setContent: setContentState,
		setImages: setImagesState,
		setSettings: setSettingsState,
		setEditorMode: setEditorModeState,
		setIsPreview,
		setActiveUtilityPanel: utilityPanelState.setActiveUtilityPanel,
		setIsCompactControlsVisible: utilityPanelState.setIsCompactControlsVisible,
		handleCommit: handleCommitWrapper,
		handleSurfaceStyleChange,
		handleTitleChange,
		handleTitleBlur,
		insertImageFiles,
		handlePreviewCheckboxToggle,
		handleEditorCheckboxToggle: handleEditorCheckboxToggleWrapper,
	};
}
