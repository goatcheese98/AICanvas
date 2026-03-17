import './ImageNode.css';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useLexicalNodeSelection } from '@lexical/react/useLexicalNodeSelection';
import { mergeRegister } from '@lexical/utils';
import {
	$getNodeByKey,
	$getSelection,
	$isNodeSelection,
	COMMAND_PRIORITY_LOW,
	KEY_ESCAPE_COMMAND,
	type NodeKey,
} from 'lexical';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { $isImageNode } from './ImageNode';
import { computeResizeDimensions, computeScale } from './imageResizeMath';

type ImageStatus = { error: true } | { error: false; height: number; width: number };
const imageCache = new Map<string, Promise<ImageStatus> | ImageStatus>();

function useSuspenseImage(src: string): ImageStatus {
	const cached = imageCache.get(src);
	if (cached && 'error' in cached) return cached;
	if (cached) throw cached;

	const promise = new Promise<ImageStatus>((resolve) => {
		const img = new Image();
		img.src = src;
		img.onload = () =>
			resolve({ error: false, height: img.naturalHeight, width: img.naturalWidth });
		img.onerror = () => resolve({ error: true });
	}).then((result) => {
		imageCache.set(src, result);
		return result;
	});

	imageCache.set(src, promise);
	throw promise;
}

function SuspendedImage({
	src,
	alt,
	imageRef,
	style,
	onError,
}: {
	src: string;
	alt: string;
	imageRef: React.RefObject<HTMLImageElement | null>;
	style: React.CSSProperties;
	onError: () => void;
}) {
	const status = useSuspenseImage(src);

	useEffect(() => {
		if (status.error) onError();
	}, [onError, status.error]);

	if (status.error) {
		return <span style={{ color: '#9ca3af', fontSize: 13 }}>Image failed to load</span>;
	}

	return (
		<img ref={imageRef} src={src} alt={alt} style={style} draggable={false} onError={onError} />
	);
}

export default function ImageComponent({
	altText,
	height,
	maxWidth,
	nodeKey,
	resizable,
	src,
	width,
}: {
	altText: string;
	height: 'inherit' | number;
	maxWidth: number;
	nodeKey: NodeKey;
	resizable: boolean;
	src: string;
	width: 'inherit' | number;
}) {
	const imageRef = useRef<HTMLImageElement>(null);
	const [isSelected, setSelected, clearSelection] = useLexicalNodeSelection(nodeKey);
	const [editor] = useLexicalComposerContext();
	const [isLoadError, setIsLoadError] = useState(false);
	const isResizingRef = useRef(false);
	const resizeCleanupRef = useRef<(() => void) | null>(null);

	const clearResizeListeners = useCallback(() => {
		isResizingRef.current = false;
		resizeCleanupRef.current?.();
		resizeCleanupRef.current = null;
	}, []);

	const isInNodeSelection = useMemo(
		() =>
			isSelected &&
			editor.getEditorState().read(() => {
				const selection = $getSelection();
				return $isNodeSelection(selection) && selection.has(nodeKey);
			}),
		[editor, isSelected, nodeKey],
	);

	const handlePointerDown = useCallback(
		(event: React.PointerEvent) => {
			if (isResizingRef.current || !editor.isEditable()) return;
			event.stopPropagation();
			Promise.resolve().then(() => {
				if (event.shiftKey) {
					setSelected(!isSelected);
				} else {
					clearSelection();
					setSelected(true);
				}
			});
		},
		[clearSelection, editor, isSelected, setSelected],
	);

	useEffect(
		() =>
			mergeRegister(
				editor.registerCommand(
					KEY_ESCAPE_COMMAND,
					() => {
						if (!isSelected) return false;
						clearSelection();
						return true;
					},
					COMMAND_PRIORITY_LOW,
				),
			),
		[clearSelection, editor, isSelected],
	);

	useEffect(() => clearResizeListeners, [clearResizeListeners]);

	const onHandlePointerDown = useCallback(
		(event: React.PointerEvent) => {
			event.preventDefault();
			event.stopPropagation();

			const img = imageRef.current;
			if (!img) return;

			const rect = img.getBoundingClientRect();
			const scale = computeScale(img.offsetWidth, rect.width);
			const startX = event.clientX;
			const startY = event.clientY;
			const dragState = {
				startW: rect.width / scale,
				startH: rect.height / scale,
				scale,
			};

			clearResizeListeners();
			isResizingRef.current = true;

			const onMove = (moveEvent: PointerEvent) => {
				const { width: nextWidth, height: nextHeight } = computeResizeDimensions(
					dragState,
					moveEvent.clientX - startX,
					moveEvent.clientY - startY,
				);
				img.style.width = `${nextWidth}px`;
				img.style.height = `${nextHeight}px`;
			};

			const onUp = () => {
				const finalWidth = Math.round(Number.parseFloat(img.style.width) || img.offsetWidth);
				const finalHeight = Math.round(Number.parseFloat(img.style.height) || img.offsetHeight);
				editor.update(() => {
					const node = $getNodeByKey(nodeKey);
					if ($isImageNode(node)) node.setWidthAndHeight(finalWidth, finalHeight);
				});
				clearResizeListeners();
			};

			resizeCleanupRef.current = () => {
				document.removeEventListener('pointermove', onMove);
				document.removeEventListener('pointerup', onUp);
			};
			document.addEventListener('pointermove', onMove);
			document.addEventListener('pointerup', onUp);
		},
		[clearResizeListeners, editor, nodeKey],
	);

	const imageStyle: React.CSSProperties = {
		display: 'block',
		maxWidth: typeof maxWidth === 'number' ? `${maxWidth}px` : '100%',
		width: typeof width === 'number' ? width : undefined,
		height: typeof height === 'number' ? height : undefined,
	};

	return (
		<Suspense fallback={null}>
			<span
				className={`canvas-editor-image${isInNodeSelection ? ' selected' : ''}`}
				draggable={isInNodeSelection && !isResizingRef.current}
				onPointerDown={handlePointerDown}
			>
				{isLoadError ? (
					<span style={{ color: '#9ca3af', fontSize: 13 }}>Image failed to load</span>
				) : (
					<SuspendedImage
						src={src}
						alt={altText}
						imageRef={imageRef}
						style={imageStyle}
						onError={() => setIsLoadError(true)}
					/>
				)}
				{resizable && isInNodeSelection && !isLoadError ? (
					<span
						className="canvas-image-resize-handle"
						onMouseDown={(event) => event.preventDefault()}
						onPointerDown={onHandlePointerDown}
					/>
				) : null}
			</span>
		</Suspense>
	);
}
