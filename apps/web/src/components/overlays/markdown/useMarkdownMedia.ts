import { useCallback, useRef } from 'react';
import { compressImageDataUrl } from './markdown-media';
import { appendBlock, createMarkdownImageToken } from './markdown-utils';

interface InsertResult {
	nextImages: Record<string, string>;
	nextContent: string;
}

interface UseMarkdownMediaProps {
	scheduleAutoCommit: () => void;
	onPanelClose?: () => void;
}

interface UseMarkdownMediaReturn {
	fileInputRef: React.RefObject<HTMLInputElement | null>;
	insertImageFiles: (fileList: FileList | null, currentState: {
		content: string;
		images: Record<string, string>;
	}) => Promise<InsertResult | null>;
}

async function processImageFile(file: File): Promise<{ imageId: string; dataUrl: string }> {
	const dataUrl = await new Promise<string>((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result));
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(file);
	});

	const imageId = crypto.randomUUID();
	const compressedDataUrl = await compressImageDataUrl(dataUrl);
	return { imageId, dataUrl: compressedDataUrl };
}

export function useMarkdownMedia({
	scheduleAutoCommit,
	onPanelClose,
}: UseMarkdownMediaProps): UseMarkdownMediaReturn {
	const fileInputRef = useRef<HTMLInputElement>(null);

	const insertImageFiles = useCallback(
		async (
			fileList: FileList | null,
			currentState: {
				content: string;
				images: Record<string, string>;
			},
		): Promise<InsertResult | null> => {
			if (!fileList?.length) return null;

			const nextImages = { ...currentState.images };
			let nextContent = currentState.content;

			for (const file of Array.from(fileList)) {
				const { imageId, dataUrl } = await processImageFile(file);
				nextImages[imageId] = dataUrl;
				nextContent = appendBlock(
					nextContent,
					createMarkdownImageToken(imageId, file.name || 'image'),
				);
			}

			scheduleAutoCommit();
			onPanelClose?.();

			return { nextImages, nextContent };
		},
		[scheduleAutoCommit, onPanelClose],
	);

	return {
		fileInputRef,
		insertImageFiles,
	};
}
