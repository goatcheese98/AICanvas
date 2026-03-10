import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $findMatchingParent, $wrapNodeInElement, mergeRegister } from '@lexical/utils';
import {
	$createParagraphNode,
	$createRangeSelection,
	$getSelection,
	$insertNodes,
	$isNodeSelection,
	$isRootOrShadowRoot,
	$setSelection,
	COMMAND_PRIORITY_EDITOR,
	COMMAND_PRIORITY_HIGH,
	COMMAND_PRIORITY_LOW,
	DRAGOVER_COMMAND,
	DRAGSTART_COMMAND,
	DROP_COMMAND,
	createCommand,
	getDOMSelectionFromTarget,
	isHTMLElement,
	type LexicalCommand,
	type LexicalEditor,
	type LexicalNode,
} from 'lexical';
import { $isAutoLinkNode, $isLinkNode, LinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link';
import { $createImageNode, $isImageNode, ImageNode, type ImagePayload } from '../nodes/ImageNode';
import { compressImageDataUrl } from '@/lib/image-compression';

export const INSERT_IMAGE_COMMAND: LexicalCommand<ImagePayload> = createCommand('INSERT_IMAGE_COMMAND');

const SUPPORTED_MIME = new Set([
	'image/jpeg',
	'image/jpg',
	'image/png',
	'image/gif',
	'image/webp',
	'image/avif',
	'image/svg+xml',
	'image/bmp',
	'image/tiff',
	'image/ico',
	'image/x-icon',
]);

const TRANSPARENT_IMAGE = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const dragImage = document.createElement('img');
dragImage.src = TRANSPARENT_IMAGE;

function readFileAsDataUrl(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = reject;
		reader.readAsDataURL(file);
	});
}

async function processImageFile(file: File): Promise<string> {
	const dataUrl = await readFileAsDataUrl(file);
	if (file.type === 'image/svg+xml' || file.type === 'image/gif') return dataUrl;
	return compressImageDataUrl(dataUrl);
}

function isImageFile(file: File): boolean {
	return SUPPORTED_MIME.has(file.type) || file.type.startsWith('image/');
}

function $getImageNodeInSelection(): ImageNode | null {
	const selection = $getSelection();
	if (!$isNodeSelection(selection)) return null;
	const node = selection.getNodes()[0];
	return $isImageNode(node) ? node : null;
}

function getDragImageData(event: DragEvent): ImagePayload | null {
	const dragData = event.dataTransfer?.getData('application/x-lexical-drag');
	if (!dragData) return null;
	const { type, data } = JSON.parse(dragData) as { type: string; data: ImagePayload };
	return type === 'image' ? data : null;
}

declare global {
	interface DragEvent {
		rangeOffset?: number;
		rangeParent?: Node;
	}
}

function canDropImage(event: DragEvent): boolean {
	const target = event.target;
	return Boolean(
		isHTMLElement(target) &&
			!target.closest('code, span.canvas-editor-image') &&
			isHTMLElement(target.parentElement) &&
			target.parentElement.closest('[contenteditable="true"]'),
	);
}

function getDragSelection(event: DragEvent): Range | null | undefined {
	const domSelection = getDOMSelectionFromTarget(event.target);
	if (document.caretRangeFromPoint) {
		return document.caretRangeFromPoint(event.clientX, event.clientY);
	}
	if (event.rangeParent && domSelection) {
		domSelection.collapse(event.rangeParent, event.rangeOffset || 0);
		return domSelection.getRangeAt(0);
	}
	throw new Error('Cannot get the selection when dragging');
}

function $onDragStart(event: DragEvent): boolean {
	const node = $getImageNodeInSelection();
	if (!node || !event.dataTransfer) return false;

	event.dataTransfer.setData('text/plain', '_');
	event.dataTransfer.setDragImage(dragImage, 0, 0);
	event.dataTransfer.setData(
		'application/x-lexical-drag',
		JSON.stringify({
			type: 'image',
			data: {
				altText: node.__altText,
				height: node.__height,
				key: node.getKey(),
				maxWidth: node.__maxWidth,
				src: node.__src,
				width: node.__width,
			},
		}),
	);
	return true;
}

function $onDragOver(event: DragEvent): boolean {
	const node = $getImageNodeInSelection();
	if (!node) return false;
	if (!canDropImage(event)) event.preventDefault();
	return false;
}

function $onDrop(event: DragEvent, editor: LexicalEditor): boolean {
	const node = $getImageNodeInSelection();
	if (!node) return false;

	const data = getDragImageData(event);
	if (!data) return false;

	const existingLink = $findMatchingParent(
		node,
		(parent: LexicalNode): parent is LinkNode => !$isAutoLinkNode(parent) && $isLinkNode(parent),
	);

	event.preventDefault();
	if (canDropImage(event)) {
		const range = getDragSelection(event);
		node.remove();
		const rangeSelection = $createRangeSelection();
		if (range) rangeSelection.applyDOMRange(range);
		$setSelection(rangeSelection);
		editor.dispatchCommand(INSERT_IMAGE_COMMAND, data);
		if (existingLink) {
			editor.dispatchCommand(TOGGLE_LINK_COMMAND, existingLink.getURL());
		}
	}

	return true;
}

export function openImageFilePicker(onSelect: (payload: ImagePayload) => void) {
	const input = document.createElement('input');
	input.type = 'file';
	input.accept = 'image/*';
	input.onchange = async () => {
		const file = input.files?.[0];
		if (!file) return;
		try {
			const src = await processImageFile(file);
			onSelect({
				altText: file.name,
				src,
			});
		} catch (error) {
			console.error('Canvas note image pick failed', error);
		}
	};
	input.click();
}

export default function ImagesPlugin() {
	const [editor] = useLexicalComposerContext();

	useEffect(() => {
		if (!editor.hasNodes([ImageNode])) {
			throw new Error('ImagesPlugin: ImageNode not registered on editor');
		}

		const unregister = mergeRegister(
			editor.registerCommand<ImagePayload>(
				INSERT_IMAGE_COMMAND,
				(payload) => {
					const imageNode = $createImageNode(payload);
					$insertNodes([imageNode]);
					if ($isRootOrShadowRoot(imageNode.getParentOrThrow())) {
						$wrapNodeInElement(imageNode, $createParagraphNode).selectEnd();
					}
					return true;
				},
				COMMAND_PRIORITY_EDITOR,
			),
			editor.registerCommand(DRAGSTART_COMMAND, (event) => $onDragStart(event), COMMAND_PRIORITY_HIGH),
			editor.registerCommand(DRAGOVER_COMMAND, (event) => $onDragOver(event), COMMAND_PRIORITY_LOW),
			editor.registerCommand(DROP_COMMAND, (event) => $onDrop(event, editor), COMMAND_PRIORITY_HIGH),
		);

		const rootElement = editor.getRootElement();

		const onPaste = async (event: ClipboardEvent) => {
			if (!editor.isEditable()) return;
			const items = event.clipboardData?.items;
			if (!items) return;

			for (const item of items) {
				const file = item.getAsFile();
				if (item.kind !== 'file' || !file || !isImageFile(file)) continue;
				event.preventDefault();
				try {
					const src = await processImageFile(file);
					editor.dispatchCommand(INSERT_IMAGE_COMMAND, {
						altText: file.name,
						src,
					});
				} catch (error) {
					console.error('Canvas note image paste failed', error);
				}
				break;
			}
		};

		const onDropFiles = async (event: DragEvent) => {
			if (!editor.isEditable()) return;
			const files = Array.from(event.dataTransfer?.files ?? []);
			const imageFile = files.find(isImageFile);
			if (!imageFile) return;

			event.preventDefault();
			try {
				const src = await processImageFile(imageFile);
				editor.update(() => {
					const range = getDragSelection(event);
					if (range) {
						const rangeSelection = $createRangeSelection();
						rangeSelection.applyDOMRange(range);
						$setSelection(rangeSelection);
					}
				});
				editor.dispatchCommand(INSERT_IMAGE_COMMAND, {
					altText: imageFile.name,
					src,
				});
			} catch (error) {
				console.error('Canvas note image drop failed', error);
			}
		};

		rootElement?.addEventListener('paste', onPaste);
		rootElement?.addEventListener('drop', onDropFiles);

		return () => {
			unregister();
			rootElement?.removeEventListener('paste', onPaste);
			rootElement?.removeEventListener('drop', onDropFiles);
		};
	}, [editor]);

	return null;
}
