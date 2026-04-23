export interface GeneratedImageAsset {
	bytes: ArrayBuffer;
	mimeType: string;
	provider: 'cloudflare' | 'openrouter';
	model: string;
	prompt: string;
	revisedPrompt?: string;
}

export interface VectorizedAsset {
	content: string;
	mimeType: 'image/svg+xml';
	provider: 'http-tool';
	tool: string;
	model?: string;
}
