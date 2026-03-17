import { normalizeMarkdownOverlay } from '@ai-canvas/shared/schemas';
import type { MarkdownEditorMode, MarkdownNoteSettings } from '@ai-canvas/shared/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

export function useMarkdownNoteState({
	element,
	isSelected,
	onChange,
	onEditingChange,
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
	const [isPreview, setIsPreview] = useState(false);
	const [activeUtilityPanel, setActiveUtilityPanel] = useState<UtilityPanel>('none');
	const [isCompactControlsVisible, setIsCompactControlsVisible] = useState(false);
	const [titleNotice, setTitleNotice] = useState(false);
	const [headerWidth, setHeaderWidth] = useState(element.width);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const utilityPanelRef = useRef<HTMLDivElement>(null);
	const headerRef = useRef<HTMLDivElement>(null);
	const titleNoticeTimeoutRef = useRef<number | null>(null);
	const onChangeRef = useRef(onChange);
	const onEditingChangeRef = useRef(onEditingChange);
	const lastReportedEditingRef = useRef<boolean | null>(null);
	const hasReportedEditingRef = useRef(false);
	const externalSignatureRef = useRef(normalizedElementSignature);
	const lastCommittedSignatureRef = useRef(externalSignatureRef.current);

	useEffect(() => {
		onChangeRef.current = onChange;
	}, [onChange]);

	useEffect(() => {
		onEditingChangeRef.current = onEditingChange;
	}, [onEditingChange]);

	useEffect(() => {
		if (normalizedElementSignature === externalSignatureRef.current) return;
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
	}, [normalizedElement, normalizedElementSignature]);

	useEffect(() => {
		if (!isSelected) {
			setActiveUtilityPanel('none');
			setIsCompactControlsVisible(false);
			setIsPreview(true);
		}
	}, [isSelected]);

	useEffect(
		() => () => {
			if (titleNoticeTimeoutRef.current !== null) {
				window.clearTimeout(titleNoticeTimeoutRef.current);
			}
		},
		[],
	);

	useEffect(() => {
		const node = headerRef.current;
		if (!node) return;

		const updateWidth = () => {
			setHeaderWidth(node.getBoundingClientRect().width);
		};

		updateWidth();

		const resizeObserver = new ResizeObserver(() => updateWidth());
		resizeObserver.observe(node);
		return () => resizeObserver.disconnect();
	}, [element.id, element.width, isSelected, settings.autoHideToolbar]);

	useEffect(() => {
		if (activeUtilityPanel === 'none') return;

		const handlePointerDown = (event: PointerEvent) => {
			if (!utilityPanelRef.current?.contains(event.target as Node)) {
				setActiveUtilityPanel('none');
			}
		};

		window.addEventListener('pointerdown', handlePointerDown);
		return () => window.removeEventListener('pointerdown', handlePointerDown);
	}, [activeUtilityPanel]);

	useEffect(() => {
		if (Object.keys(images).length > 0) prewarmImageCache(images);
	}, [images]);

	const isEditing = isSelected && (!isPreview || activeUtilityPanel !== 'none');

	useEffect(() => {
		if (!hasReportedEditingRef.current && !isEditing) {
			hasReportedEditingRef.current = true;
			lastReportedEditingRef.current = false;
			return;
		}
		if (lastReportedEditingRef.current === isEditing) return;
		hasReportedEditingRef.current = true;
		lastReportedEditingRef.current = isEditing;
		onEditingChangeRef.current?.(isEditing);
	}, [isEditing]);

	useEffect(
		() => () => {
			if (lastReportedEditingRef.current) {
				onEditingChangeRef.current?.(false);
				lastReportedEditingRef.current = false;
			}
		},
		[],
	);

	useEffect(() => {
		if (isPreview && activeUtilityPanel === 'none') return;
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
		const timeout = window.setTimeout(() => {
			lastCommittedSignatureRef.current = nextSignature;
			onChangeRef.current(element.id, content, images, title, settings, editorMode);
		}, 180);
		return () => window.clearTimeout(timeout);
	}, [activeUtilityPanel, content, editorMode, element.id, images, isPreview, settings, title]);

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
	const compactTitle = effectiveHeaderWidth < TITLE_COMPACT_BREAKPOINT;
	const activeMode: MarkdownViewMode = isPreview ? 'preview' : editorMode;
	const surfaceBackground = element.backgroundColor ?? settings.background;
	const showCompactControls =
		isSelected &&
		controlsLayout === 'hidden' &&
		(isCompactControlsVisible || activeUtilityPanel !== 'none');

	useEffect(() => {
		if (controlsLayout !== 'hidden') {
			setIsCompactControlsVisible(false);
		}
	}, [controlsLayout]);

	const handleCommit = useCallback(() => {
		const nextSignature = serializeNoteState({
			content,
			images,
			title,
			settings,
			editorMode,
		});
		lastCommittedSignatureRef.current = nextSignature;
		onChangeRef.current(element.id, content, images, title, settings, editorMode);
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
			const nextSignature = serializeNoteState({
				content: nextContent,
				images,
				title,
				settings,
				editorMode,
			});
			lastCommittedSignatureRef.current = nextSignature;
			onChangeRef.current(element.id, nextContent, images, title, settings, editorMode);
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
		isCompactControlsVisible,
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
