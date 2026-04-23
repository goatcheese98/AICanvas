export const MARKDOWN_IMAGE_SCHEME = 'image://';

export function createMarkdownImageToken(imageId: string, alt = 'image'): string {
	return `![${alt}](${MARKDOWN_IMAGE_SCHEME}${imageId})`;
}

export function resolveMarkdownImageSrc(
	src: string | undefined,
	images?: Record<string, string>,
): string | undefined {
	if (!src) return undefined;
	if (!src.startsWith(MARKDOWN_IMAGE_SCHEME)) return src;
	return images?.[src.slice(MARKDOWN_IMAGE_SCHEME.length)];
}

export function appendBlock(content: string, block: string): string {
	if (!content.trim()) return block;
	return `${content.replace(/\s+$/, '')}\n\n${block}`;
}

export function toggleMarkdownCheckboxLine(content: string, lineIndex: number): string {
	const lines = content.split('\n');
	const line = lines[lineIndex];
	if (!line) return content;

	if (line.includes('- [ ]')) {
		lines[lineIndex] = line.replace('- [ ]', '- [x]');
		return lines.join('\n');
	}

	if (line.includes('- [x]')) {
		lines[lineIndex] = line.replace('- [x]', '- [ ]');
		return lines.join('\n');
	}

	return content;
}
