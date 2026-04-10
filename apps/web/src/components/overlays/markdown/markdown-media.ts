import type React from 'react';
import { defaultUrlTransform } from 'react-markdown';

const MAX_IMAGE_SIDE = 1600;
const JPEG_QUALITY = 0.82;
const COMPRESS_THRESHOLD = 80 * 1024;

export const MARKDOWN_IMAGE_SCHEME = 'image://';

const objectUrlCache = new Map<string, string>();

type ExcalidrawClipboardImageElement = {
	type?: string;
	fileId?: string;
};

type ExcalidrawClipboardFile = {
	dataURL?: string;
};

type ExcalidrawClipboardPayload = {
	type?: string;
	elements?: ExcalidrawClipboardImageElement[];
	files?: Record<string, ExcalidrawClipboardFile>;
};

function createImageId() {
	return `img_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function readBlobAsDataUrl(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			if (typeof reader.result === 'string') {
				resolve(reader.result);
				return;
			}
			reject(new Error('Failed to read image'));
		};
		reader.onerror = () => reject(reader.error ?? new Error('Failed to read image'));
		reader.readAsDataURL(blob);
	});
}

function dataUrlToObjectUrl(dataUrl: string): string {
	const commaIndex = dataUrl.indexOf(',');
	if (commaIndex === -1) throw new Error('Invalid data URL');
	const mime = dataUrl.slice(0, commaIndex).match(/data:([^;]+)/)?.[1];
	if (!mime?.startsWith('image/')) throw new Error('Not an image data URL');

	const binary = atob(dataUrl.slice(commaIndex + 1));
	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index += 1) {
		bytes[index] = binary.charCodeAt(index);
	}

	return URL.createObjectURL(new Blob([bytes], { type: mime }));
}

function extractExcalidrawDataUrl(text: string): string | null {
	if (!text.includes('"excalidraw/clipboard"')) return null;
	try {
		const parsed = JSON.parse(text) as ExcalidrawClipboardPayload;
		if (parsed.type !== 'excalidraw/clipboard') return null;
		const imageElement = parsed.elements?.find(
			(candidate) => candidate.type === 'image' && typeof candidate.fileId === 'string',
		);
		const file = imageElement?.fileId ? parsed.files?.[imageElement.fileId] : undefined;
		return typeof file?.dataURL === 'string' ? file.dataURL : null;
	} catch {
		return text.match(/"dataURL"\s*:\s*"(data:image[^"]+)"/)?.[1]?.replace(/\\\//g, '/') ?? null;
	}
}

function extractImageSrcFromHtml(html: string): string | null {
	if (!html) return null;
	return (
		new DOMParser()
			.parseFromString(html, 'text/html')
			.querySelector('img')
			?.getAttribute('src')
			?.trim() ?? null
	);
}

function insertMarkdownAtCursor(
	target: HTMLTextAreaElement,
	value: string,
	src: string,
	onChange: (nextValue: string) => void,
	altText = 'image',
) {
	const start = target.selectionStart ?? value.length;
	const end = target.selectionEnd ?? value.length;
	const imageMarkdown = `![${altText}](${src})`;
	const prefix = start > 0 && value[start - 1] !== '\n' ? '\n' : '';
	const suffix = end < value.length && value[end] !== '\n' ? '\n' : '';
	const insertion = `${prefix}${imageMarkdown}${suffix}`;
	onChange(`${value.slice(0, start)}${insertion}${value.slice(end)}`);

	requestAnimationFrame(() => {
		const caret = start + insertion.length;
		target.setSelectionRange(caret, caret);
	});
}

export async function compressImageDataUrl(dataUrl: string): Promise<string> {
	if (dataUrl.length < COMPRESS_THRESHOLD) return dataUrl;

	return new Promise((resolve) => {
		const image = new Image();
		image.onload = () => {
			let { width, height } = image;
			if (width > MAX_IMAGE_SIDE || height > MAX_IMAGE_SIDE) {
				const ratio = Math.min(MAX_IMAGE_SIDE / width, MAX_IMAGE_SIDE / height);
				width = Math.round(width * ratio);
				height = Math.round(height * ratio);
			}

			const canvas = document.createElement('canvas');
			canvas.width = width;
			canvas.height = height;
			const ctx = canvas.getContext('2d');
			if (!ctx) {
				resolve(dataUrl);
				return;
			}

			ctx.drawImage(image, 0, 0, width, height);
			const webp = canvas.toDataURL('image/webp', 0.85);
			if (webp.startsWith('data:image/webp') && webp.length < dataUrl.length) {
				resolve(webp);
				return;
			}

			const jpeg = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
			resolve(jpeg.length < dataUrl.length ? jpeg : dataUrl);
		};
		image.onerror = () => resolve(dataUrl);
		image.src = dataUrl;
	});
}

export function prewarmImageCache(images: Record<string, string>) {
	for (const dataUrl of Object.values(images)) {
		if (objectUrlCache.has(dataUrl)) continue;
		try {
			objectUrlCache.set(dataUrl, dataUrlToObjectUrl(dataUrl));
		} catch {
			objectUrlCache.set(dataUrl, '');
		}
	}
}

export function resolveMarkdownAssetSrc(
	src: string | undefined,
	images?: Record<string, string>,
): string | undefined {
	if (!src) return undefined;
	const trimmed = src.trim();
	if (!trimmed.startsWith(MARKDOWN_IMAGE_SCHEME)) return trimmed || undefined;

	const imageId = trimmed.slice(MARKDOWN_IMAGE_SCHEME.length);
	const dataUrl = images?.[imageId];
	if (!dataUrl) return undefined;

	if (objectUrlCache.has(dataUrl)) {
		const cached = objectUrlCache.get(dataUrl);
		return cached || undefined;
	}

	try {
		const objectUrl = dataUrlToObjectUrl(dataUrl);
		objectUrlCache.set(dataUrl, objectUrl);
		return objectUrl;
	} catch {
		objectUrlCache.set(dataUrl, '');
		return undefined;
	}
}

export function markdownUrlTransform(url: string) {
	const trimmed = url.trim();
	if (
		trimmed.startsWith(MARKDOWN_IMAGE_SCHEME) ||
		trimmed.startsWith('data:image/') ||
		trimmed.startsWith('blob:')
	) {
		return trimmed;
	}

	return defaultUrlTransform(trimmed);
}

interface HandleMarkdownImagePasteOptions {
	event: React.ClipboardEvent<HTMLTextAreaElement>;
	value: string;
	onChange: (nextValue: string) => void;
	onImageAdd: (id: string, dataUrl: string) => void;
}

export async function handleImagePasteAsMarkdown({
	event,
	value,
	onChange,
	onImageAdd,
}: HandleMarkdownImagePasteOptions): Promise<boolean> {
	const clipboard = event.clipboardData;
	if (!clipboard) return false;
	const target = event.currentTarget;

	const imageItem = Array.from(clipboard.items).find(
		(item) => item.kind === 'file' && item.type.startsWith('image/'),
	);
	if (imageItem) {
		event.preventDefault();
		const file = imageItem.getAsFile();
		if (!file) return false;
		const compressed = await compressImageDataUrl(await readBlobAsDataUrl(file));
		const imageId = createImageId();
		onImageAdd(imageId, compressed);
		insertMarkdownAtCursor(
			target,
			value,
			`${MARKDOWN_IMAGE_SCHEME}${imageId}`,
			onChange,
			file.name || 'image',
		);
		return true;
	}

	const text = clipboard.getData('text/plain');
	if (text.includes('"excalidraw/clipboard"')) {
		event.preventDefault();
		const imageDataUrl = extractExcalidrawDataUrl(text);
		if (imageDataUrl) {
			const compressed = await compressImageDataUrl(imageDataUrl);
			const imageId = createImageId();
			onImageAdd(imageId, compressed);
			insertMarkdownAtCursor(
				target,
				value,
				`${MARKDOWN_IMAGE_SCHEME}${imageId}`,
				onChange,
				'canvas-image',
			);
		}
		return true;
	}

	const html = clipboard.getData('text/html');
	const htmlSrc = extractImageSrcFromHtml(html);
	if (htmlSrc) {
		event.preventDefault();
		if (htmlSrc.startsWith('data:image/')) {
			const compressed = await compressImageDataUrl(htmlSrc);
			const imageId = createImageId();
			onImageAdd(imageId, compressed);
			insertMarkdownAtCursor(target, value, `${MARKDOWN_IMAGE_SCHEME}${imageId}`, onChange);
		} else {
			insertMarkdownAtCursor(target, value, htmlSrc, onChange);
		}
		return true;
	}

	return false;
}
