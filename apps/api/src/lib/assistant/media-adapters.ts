import type { AppEnv } from '../../types';
import {
	generateCloudflareImageAsset,
	generateOpenRouterImageAsset,
	vectorizeWithHttpTool,
} from './providers';

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

export async function generateImageAsset(
	bindings: AppEnv['Bindings'],
	input: {
		prompt: string;
		style: 'image' | 'sketch';
	},
): Promise<GeneratedImageAsset> {
	if (bindings.AI) {
		return generateCloudflareImageAsset(bindings, input);
	}

	if (bindings.OPENROUTER_API_KEY) {
		return generateOpenRouterImageAsset(bindings, input);
	}

	throw new Error('AI binding or OPENROUTER_API_KEY must be configured for image generation');
}

export async function vectorizeImageAsset(
	bindings: AppEnv['Bindings'],
	input: {
		bytes: ArrayBuffer;
		mimeType: string;
		prompt?: string;
	},
): Promise<VectorizedAsset> {
	return vectorizeWithHttpTool(bindings, input);
}
