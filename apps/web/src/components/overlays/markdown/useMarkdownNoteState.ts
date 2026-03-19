import { useMountEffect } from '@/hooks/useMountEffect';
import { normalizeMarkdownOverlay } from '@ai-canvas/shared/schemas';
import type { MarkdownEditorMode, MarkdownNoteSettings } from '@ai-canvas/shared/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import { compressImageDataUrl, prewarmImageCache } from './markdown-media';
import {
	MARKDOWN_HEADER_FULL_BREAKPOINT,
	MARKDOWN_HEADER_HIDDEN_BREAKPOINT,
	MAX_MARKDOWN_TITLE_LENGTH,
	TITLE_COMPACT_BREAKPOINT,
	serializeNoteState,
	serializeOverlayState,
} from './markdown-note-helpers';
import type { ControlsLayout, MarkdownViewMode, UtilityPanel } from './markdown-note-helpers';
import type { MarkdownNoteProps } from './markdown-note-types';
import {
	appendBlock,
	createMarkdownImageToken,
	toggleMarkdownCheckboxLine,
} from './markdown-utils';

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

// Helper to commit state changes
function commitState(
	content: string,
	images: Record<string, string>,
	title: string,
	settings: MarkdownNoteSettings,
	editorMode: MarkdownEditorMode,
	elementId: string,
	onChangeRef: React.MutableRefObject<
		| ((
				id: string,
				content: string,
				images: Record<string, string>,
				title: string,
				settings: MarkdownNoteSettings,
				editorMode: MarkdownEditorMode,
		  ) => void)
		| undefined
	>,
	lastCommittedSignatureRef: React.MutableRefObject<string>,
) {
	const nextSignature = serializeNoteState({
		content,
		images,
		title,
		settings,
		editorMode,
	});
	lastCommittedSignatureRef.current = nextSignature;
	onChangeRef.current?.(elementId, content, images, title, settings, editorMode);
}

// Helper to schedule debounced commits
function scheduleDebounce(
	content: string,
	images: Record<string, string>,
	title: string,
	settings: MarkdownNoteSettings,
	editorMode: MarkdownEditorMode,
	elementId: string,
	onChangeRef: React.MutableRefObject<
		| ((
				id: string,
				content: string,
				images: Record<string, string>,
				title: string,
				settings: MarkdownNoteSettings,
				editorMode: MarkdownEditorMode,
		  ) => void)
		| undefined
	>,
	externalSignatureRef: React.MutableRefObject<string>,
	lastCommittedSignatureRef: React.MutableRefObject<string>,
	timeoutRef: React.MutableRefObject<number | null>,
) {
	const nextSignature = serializeNoteState({
		content,
		images,
		title,
		settings,
		editorMode,
	});
	if (
		nextSignature === externalSignatureRef.current ||
		nextSignature === lastCommittedSignatureRef.current
	) {
		return;
	}
	if (timeoutRef.current !== null) {
		window.clearTimeout(timeoutRef.current);
	}
	timeoutRef.current = window.setTimeout(() => {
		lastCommittedSignatureRef.current = nextSignature;
		onChangeRef.current?.(elementId, content, images, title, settings, editorMode);
		timeoutRef.current = null;
	}, 180);
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
	const [title, setTitle] = useState(resolvedNormalizedElement.title);
	const [content, setContent] = useState(resolvedNormalizedElement.content);
	const [images, setImages] = useState<Record<string, string>>(
		resolvedNormalizedElement.images ?? {},
	);
	const [settings, setSettings] = useState(resolvedNormalizedElement.settings);
	const [editorMode, setEditorMode] = useState<MarkdownEditorMode>(
		resolvedNormalizedElement.editorMode ?? 'raw',
	);
	const [isPreviewState, setIsPreview] = useState(false);
	const [activeUtilityPanelState, setActiveUtilityPanel] = useState<UtilityPanel>('none');
	const [isCompactControlsVisibleState, setIsCompactControlsVisible] = useState(false);
	const [titleNotice, setTitleNotice] = useState(false);
	const [headerWidth, setHeaderWidth] = useState(element.width);

	const fileInputRef = useRef<HTMLInputElement>(null);
	const utilityPanelRef = useRef<HTMLDivElement>(null);
	const detachedUtilityPanelRef = useRef<HTMLDivElement>(null);
	const headerRef = useRef<HTMLDivElement>(null);
	const titleNoticeTimeoutRef = useRef<number | null>(null);
	const debounceTimeoutRef = useRef<number | null>(null);
	const onChangeRef = useRef(onChange);
	const onActivityChangeRef = useRef(onActivityChange);
	const lastReportedActivityRef = useRef<boolean | null>(null);
	const hasReportedActivityRef = useRef(false);
	const externalSignatureRef = useRef(resolvedSourceSignature);
	const lastCommittedSignatureRef = useRef(externalSignatureRef.current);
	const hasPrewarmedRef = useRef(false);
	const titleRef = useRef(title);
	const contentRef = useRef(content);
	const imagesRef = useRef(images);
	const settingsRef = useRef(settings);
	const editorModeRef = useRef(editorMode);

	// Derived state: isPreview and activeUtilityPanel based on isSelected
	const isPreview = !isSelected ? true : isPreviewState;
	const activeUtilityPanel = !isSelected ? 'none' : activeUtilityPanelState;
	const isCompactControlsVisible = !isSelected ? false : isCompactControlsVisibleState;
	titleRef.current = title;
	contentRef.current = content;
	imagesRef.current = images;
	settingsRef.current = settings;
	editorModeRef.current = editorMode;
	onChangeRef.current = onChange;
	onActivityChangeRef.current = onActivityChange;

	// Cleanup timeout on unmount
	useMountEffect(() => {
		return () => {
			if (titleNoticeTimeoutRef.current !== null) {
				window.clearTimeout(titleNoticeTimeoutRef.current);
			}
		};
	});

	// ResizeObserver for header width
	useMountEffect(() => {
		const node = headerRef.current;
		if (!node) return;

		const updateWidth = () => {
			setHeaderWidth(node.getBoundingClientRect().width);
		};

		updateWidth();

		const resizeObserver = new ResizeObserver(() => updateWidth());
		resizeObserver.observe(node);
		return () => resizeObserver.disconnect();
	});

	// Outside click handler for utility panel
	useMountEffect(() => {
		const handlePointerDown = (event: PointerEvent) => {
			// Use a ref to track current state since this handler is set up once
			const currentPanel = activeUtilityPanelRef.current;
			const target = event.target as Node;
			const insideTrigger = utilityPanelRef.current?.contains(target) ?? false;
			const insideDetachedPanel = detachedUtilityPanelRef.current?.contains(target) ?? false;
			if (currentPanel !== 'none' && !insideTrigger && !insideDetachedPanel) {
				setActiveUtilityPanel('none');
			}
		};

		window.addEventListener('pointerdown', handlePointerDown);
		return () => window.removeEventListener('pointerdown', handlePointerDown);
	});

	// Track activeUtilityPanel changes for the outside click handler
	const activeUtilityPanelRef = useRef(activeUtilityPanel);
	activeUtilityPanelRef.current = activeUtilityPanel;

	// Prewarm image cache (only once when images first have data)
	useMountEffect(() => {
		if (!hasPrewarmedRef.current && Object.keys(images).length > 0) {
			hasPrewarmedRef.current = true;
			prewarmImageCache(images);
		}
	});

	const isEditing = isSelected && (!isPreview || activeUtilityPanel !== 'none');

	// Report activity changes
	const prevIsEditingRef = useRef(isEditing);
	if (prevIsEditingRef.current !== isEditing) {
		prevIsEditingRef.current = isEditing;
		if (hasReportedActivityRef.current && lastReportedActivityRef.current !== isEditing) {
			lastReportedActivityRef.current = isEditing;
			onActivityChangeRef.current?.(isEditing);
		}
		hasReportedActivityRef.current = true;
	}

	// Activity cleanup on unmount
	useMountEffect(() => {
		hasReportedActivityRef.current = true;
		lastReportedActivityRef.current = isEditing;
		if (isEditing) {
			onActivityChangeRef.current?.(true);
		}
		return () => {
			if (lastReportedActivityRef.current) {
				onActivityChangeRef.current?.(false);
				lastReportedActivityRef.current = false;
			}
		};
	});

	// Cleanup debounce timeout on unmount
	useMountEffect(() => {
		return () => {
			if (debounceTimeoutRef.current !== null) {
				window.clearTimeout(debounceTimeoutRef.current);
				commitState(
					contentRef.current,
					imagesRef.current,
					titleRef.current,
					settingsRef.current,
					editorModeRef.current,
					element.id,
					onChangeRef,
					lastCommittedSignatureRef,
				);
				debounceTimeoutRef.current = null;
			}
		};
	});

	const scheduleAutoCommit = useCallback(() => {
		if (isPreview && activeUtilityPanel === 'none') {
			return;
		}

		scheduleDebounce(
			contentRef.current,
			imagesRef.current,
			titleRef.current,
			settingsRef.current,
			editorModeRef.current,
			element.id,
			onChangeRef,
			externalSignatureRef,
			lastCommittedSignatureRef,
			debounceTimeoutRef,
		);
	}, [activeUtilityPanel, element.id, isPreview]);

	const setTitleState = useCallback(
		(value: SetStateAction<string>) => {
			const nextValue = typeof value === 'function' ? value(titleRef.current) : value;
			titleRef.current = nextValue;
			setTitle(nextValue);
			scheduleAutoCommit();
		},
		[scheduleAutoCommit],
	);

	const setContentState = useCallback(
		(value: SetStateAction<string>) => {
			const nextValue = typeof value === 'function' ? value(contentRef.current) : value;
			contentRef.current = nextValue;
			setContent(nextValue);
			scheduleAutoCommit();
		},
		[scheduleAutoCommit],
	);

	const setImagesState = useCallback(
		(value: SetStateAction<Record<string, string>>) => {
			const nextValue = typeof value === 'function' ? value(imagesRef.current) : value;
			imagesRef.current = nextValue;
			setImages(nextValue);
			scheduleAutoCommit();
		},
		[scheduleAutoCommit],
	);

	const setSettingsState = useCallback(
		(value: SetStateAction<MarkdownNoteSettings>) => {
			const nextValue = typeof value === 'function' ? value(settingsRef.current) : value;
			settingsRef.current = nextValue;
			setSettings(nextValue);
			scheduleAutoCommit();
		},
		[scheduleAutoCommit],
	);

	const setEditorModeState = useCallback(
		(value: SetStateAction<MarkdownEditorMode>) => {
			const nextValue = typeof value === 'function' ? value(editorModeRef.current) : value;
			editorModeRef.current = nextValue;
			setEditorMode(nextValue);
			scheduleAutoCommit();
		},
		[scheduleAutoCommit],
	);

	const hasLocalEdits =
		serializeNoteState({
			content,
			images,
			title,
			settings,
			editorMode,
		}) !== externalSignatureRef.current;

	const showHeader = isSelected || !settings.autoHideToolbar;
	const effectiveHeaderWidth = showHeader && headerWidth > 0 ? headerWidth : element.width;
	const controlsLayout: ControlsLayout =
		effectiveHeaderWidth < MARKDOWN_HEADER_HIDDEN_BREAKPOINT
			? 'hidden'
			: effectiveHeaderWidth < MARKDOWN_HEADER_FULL_BREAKPOINT
				? 'icon'
				: 'full';

	// Derived state: reset compact controls when layout changes from hidden
	const effectiveIsCompactControlsVisible = useMemo(() => {
		if (controlsLayout !== 'hidden') {
			return false;
		}
		return isCompactControlsVisible;
	}, [controlsLayout, isCompactControlsVisible]);

	const compactTitle = effectiveHeaderWidth < TITLE_COMPACT_BREAKPOINT;
	const activeMode: MarkdownViewMode = isPreview ? 'preview' : editorMode;
	const surfaceBackground = element.backgroundColor ?? settings.background;
	const showCompactControls =
		isSelected &&
		controlsLayout === 'hidden' &&
		(effectiveIsCompactControlsVisible || activeUtilityPanel !== 'none');

	const handleCommit = useCallback(() => {
		commitState(
			content,
			images,
			title,
			settings,
			editorMode,
			element.id,
			onChangeRef,
			lastCommittedSignatureRef,
		);
	}, [content, editorMode, element.id, images, settings, title]);

	const handleSurfaceStyleChange = useCallback(
		(elementStyle: {
			backgroundColor?: string;
			strokeColor?: string;
			strokeWidth?: number;
			roundness?: ExcalidrawElement['roundness'];
		}) => {
			onChangeRef.current(element.id, content, images, title, settings, editorMode, elementStyle);
		},
		[content, editorMode, element.id, images, settings, title],
	);

	const showTitleLimitNotice = useCallback(() => {
		setTitleNotice(true);
		if (titleNoticeTimeoutRef.current !== null) {
			window.clearTimeout(titleNoticeTimeoutRef.current);
		}
		titleNoticeTimeoutRef.current = window.setTimeout(() => {
			setTitleNotice(false);
			titleNoticeTimeoutRef.current = null;
		}, 1800);
	}, []);

	const handleTitleChange = useCallback(
		(nextValue: string) => {
			if (nextValue.length > MAX_MARKDOWN_TITLE_LENGTH) {
				showTitleLimitNotice();
				setTitleState(nextValue.slice(0, MAX_MARKDOWN_TITLE_LENGTH));
				return;
			}
			setTitleState(nextValue);
		},
		[setTitleState, showTitleLimitNotice],
	);

	const handleTitleBlur = useCallback(() => {
		const trimmedTitle = title.trim();
		setTitleState(trimmedTitle.length > 0 ? trimmedTitle : resolvedNormalizedElement.title);
	}, [resolvedNormalizedElement.title, setTitleState, title]);

	const insertImageFiles = useCallback(
		async (fileList: FileList | null) => {
			if (!fileList?.length) return;

			const nextImages = { ...images };
			let nextContent = content;

			for (const file of Array.from(fileList)) {
				const dataUrl = await new Promise<string>((resolve, reject) => {
					const reader = new FileReader();
					reader.onload = () => resolve(String(reader.result));
					reader.onerror = () => reject(reader.error);
					reader.readAsDataURL(file);
				});

				const imageId = crypto.randomUUID();
				nextImages[imageId] = await compressImageDataUrl(dataUrl);
				nextContent = appendBlock(
					nextContent,
					createMarkdownImageToken(imageId, file.name || 'image'),
				);
			}

			imagesRef.current = nextImages;
			contentRef.current = nextContent;
			setImages(nextImages);
			setContent(nextContent);
			scheduleAutoCommit();
			setActiveUtilityPanel('none');
		},
		[content, images, scheduleAutoCommit],
	);

	const handleEditorCheckboxToggle = useCallback(
		(lineIndex: number) => {
			setContentState((current) => toggleMarkdownCheckboxLine(current, lineIndex));
		},
		[setContentState],
	);

	const handlePreviewCheckboxToggle = useCallback(
		(lineIndex: number) => {
			const nextContent = toggleMarkdownCheckboxLine(content, lineIndex);
			contentRef.current = nextContent;
			setContent(nextContent);
			commitState(
				nextContent,
				imagesRef.current,
				titleRef.current,
				settingsRef.current,
				editorModeRef.current,
				element.id,
				onChangeRef,
				lastCommittedSignatureRef,
			);
		},
		[content, element.id],
	);

	return {
		normalizedElement: resolvedNormalizedElement,
		title,
		content,
		images,
		settings,
		editorMode,
		isPreview,
		activeUtilityPanel,
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
		utilityPanelRef,
		detachedUtilityPanelRef,
		headerRef,
		setTitle: setTitleState,
		setContent: setContentState,
		setImages: setImagesState,
		setSettings: setSettingsState,
		setEditorMode: setEditorModeState,
		setIsPreview,
		setActiveUtilityPanel,
		setIsCompactControlsVisible,
		handleCommit,
		handleSurfaceStyleChange,
		handleTitleChange,
		handleTitleBlur,
		insertImageFiles,
		handlePreviewCheckboxToggle,
		handleEditorCheckboxToggle,
	};
}
