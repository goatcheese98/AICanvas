export function normalizeLineEndings(value: string): string {
	return value.replace(/\r\n/g, '\n');
}

export function extractCodeBlock(content: string, language: string): string | null {
	const pattern = new RegExp(`\`\`\`${language}\\s*\\n([\\s\\S]*?)\\n\`\`\``, 'i');
	const match = content.match(pattern);
	return match?.[1]?.trim() || null;
}
