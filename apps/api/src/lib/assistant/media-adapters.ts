import type { AppEnv } from '../../types';
import type { GeneratedImageAsset, VectorizedAsset } from './media-types';
import {
	generateCloudflareImageAsset,
	generateOpenRouterImageAsset,
	vectorizeWithHttpTool,
} from './providers';

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
