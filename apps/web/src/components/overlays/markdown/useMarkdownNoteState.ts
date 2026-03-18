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
	serializeImages,
	serializeNoteState,
	serializeOverlayState,
	serializeSettings,
} from './markdown-note-helpers';
import type { ControlsLayout, MarkdownViewMode, UtilityPanel } from './markdown-note-helpers';
import type { MarkdownNoteProps } from './markdown-note-types';
import {
	appendBlock,
	createMarkdownImageToken,
	toggleMarkdownCheckboxLine,
} from './markdown-utils';

// Helper refs for state change detection outside of useEffect
const usePrevious = <T>(value: T): T | undefined => {
	const ref = useRef<T | undefined>(undefined);
	const prev = ref.current;
	ref.current = value;
	return prev;
};

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
}: MarkdownNoteProps): UseMarkdownNoteStateResult {
	const normalizedElement = useMemo(
		() => normalizeMarkdownOverlay(element.customData),
		[element.customData],
	);
	const normalizedElementSignature = useMemo(
		() => serializeOverlayState(normalizedElement),
		[normalizedElement],
	);

	const [title, setTitle] = useState(normalizedElement.title);
	const [content, setContent] = useState(normalizedElement.content);
	const [images, setImages] = useState<Record<string, string>>(normalizedElement.images ?? {});
	const [settings, setSettings] = useState(normalizedElement.settings);
	const [editorMode, setEditorMode] = useState<MarkdownEditorMode>(
		normalizedElement.editorMode ?? 'raw',
	);
	const [isPreviewState, setIsPreview] = useState(false);
	const [activeUtilityPanelState, setActiveUtilityPanel] = useState<UtilityPanel>('none');
	const [isCompactControlsVisibleState, setIsCompactControlsVisible] = useState(false);
	const [titleNotice, setTitleNotice] = useState(false);
	const [headerWidth, setHeaderWidth] = useState(element.width);

	const fileInputRef = useRef<HTMLInputElement>(null);
	const utilityPanelRef = useRef<HTMLDivElement>(null);
	const headerRef = useRef<HTMLDivElement>(null);
	const titleNoticeTimeoutRef = useRef<number | null>(null);
	const debounceTimeoutRef = useRef<number | null>(null);
	const onChangeRef = useRef(onChange);
	const onActivityChangeRef = useRef(onActivityChange);
	const lastReportedActivityRef = useRef<boolean | null>(null);
	const hasReportedActivityRef = useRef(false);
	const externalSignatureRef = useRef(normalizedElementSignature);
	const lastCommittedSignatureRef = useRef(externalSignatureRef.current);
	const hasPrewarmedRef = useRef(false);

	// Track previous signature for external sync
	const prevSignature = usePrevious(normalizedElementSignature);

	// Sync external state changes when signature changes (migrated from useEffect)
	// Using useMemo for synchronous state derivation
	useMemo(() => {
		if (
			prevSignature !== undefined &&
			normalizedElementSignature !== externalSignatureRef.current
		) {
			externalSignatureRef.current = normalizedElementSignature;
			lastCommittedSignatureRef.current = normalizedElementSignature;
			const nextImages = normalizedElement.images ?? {};
			setTitle((current) =>
				current === normalizedElement.title ? current : normalizedElement.title,
			);
			setContent((current) =>
				current === normalizedElement.content ? current : normalizedElement.content,
			);
			setImages((current) =>
				serializeImages(current) === serializeImages(nextImages) ? current : nextImages,
			);
			setSettings((current) =>
				serializeSettings(current) === serializeSettings(normalizedElement.settings)
					? current
					: normalizedElement.settings,
			);
			setEditorMode((current) => {
				const nextMode = normalizedElement.editorMode ?? 'raw';
				return current === nextMode ? current : nextMode;
			});
		}
		// Return value not used, this is for side-effect-like sync during render
		return null;
	}, [normalizedElement, normalizedElementSignature, prevSignature]);

	// Derived state: isPreview and activeUtilityPanel based on isSelected
	const isPreview = !isSelected ? true : isPreviewState;
	const activeUtilityPanel = !isSelected ? 'none' : activeUtilityPanelState;
	const isCompactControlsVisible = !isSelected ? false : isCompactControlsVisibleState;

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
			if (currentPanel !== 'none' && !utilityPanelRef.current?.contains(event.target as Node)) {
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
		lastReportedActivityRef.current = false;
		return () => {
			if (lastReportedActivityRef.current) {
				onActivityChangeRef.current?.(false);
				lastReportedActivityRef.current = false;
			}
		};
	});

	// Debounced save - triggered on state changes
	useMemo(() => {
		// Skip if in preview mode with no utility panel
		if (isPreview && activeUtilityPanel === 'none') return;

		scheduleDebounce(
			content,
			images,
			title,
			settings,
			editorMode,
			element.id,
			onChangeRef,
			externalSignatureRef,
			lastCommittedSignatureRef,
			debounceTimeoutRef,
		);
	}, [activeUtilityPanel, content, editorMode, element.id, images, isPreview, settings, title]);

	// Cleanup debounce timeout on unmount
	useMountEffect(() => {
		return () => {
			if (debounceTimeoutRef.current !== null) {
				window.clearTimeout(debounceTimeoutRef.current);
			}
		};
	});

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
				setTitle(nextValue.slice(0, MAX_MARKDOWN_TITLE_LENGTH));
				return;
			}
			setTitle(nextValue);
		},
		[showTitleLimitNotice],
	);

	const handleTitleBlur = useCallback(() => {
		const trimmedTitle = title.trim();
		setTitle(trimmedTitle.length > 0 ? trimmedTitle : normalizedElement.title);
	}, [normalizedElement.title, title]);

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

			setImages(nextImages);
			setContent(nextContent);
			setActiveUtilityPanel('none');
		},
		[content, images],
	);

	const handleEditorCheckboxToggle = useCallback((lineIndex: number) => {
		setContent((current) => toggleMarkdownCheckboxLine(current, lineIndex));
	}, []);

	const handlePreviewCheckboxToggle = useCallback(
		(lineIndex: number) => {
			const nextContent = toggleMarkdownCheckboxLine(content, lineIndex);
			setContent(nextContent);
			commitState(
				nextContent,
				images,
				title,
				settings,
				editorMode,
				element.id,
				onChangeRef,
				lastCommittedSignatureRef,
			);
		},
		[content, editorMode, element.id, images, settings, title],
	);

	return {
		normalizedElement,
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
		headerRef,
		setTitle,
		setContent,
		setImages,
		setSettings,
		setEditorMode,
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
