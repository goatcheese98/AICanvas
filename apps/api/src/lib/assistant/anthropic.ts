import type { AppEnv } from '../../types';

interface AnthropicMessageRequest {
	system?: string;
	messages: Array<{
		role: 'user' | 'assistant';
		content: string;
	}>;
	maxTokens?: number;
}

interface AnthropicMessageResult {
	text: string;
	model: string;
}

function getAnthropicBaseUrl(bindings: AppEnv['Bindings']): string {
	return bindings.ANTHROPIC_API_BASE_URL ?? 'https://api.anthropic.com';
}

function getAnthropicTextModel(bindings: AppEnv['Bindings']): string {
	return bindings.ANTHROPIC_TEXT_MODEL ?? 'claude-haiku-4-5-20251001';
}

async function ensureFetchOk(response: Response, fallback: string): Promise<Response> {
	if (response.ok) {
		return response;
	}

	const body = await response.text();
	throw new Error(body || fallback);
}

export async function createAnthropicMessage(
	bindings: AppEnv['Bindings'],
	request: AnthropicMessageRequest,
): Promise<AnthropicMessageResult> {
	if (!bindings.ANTHROPIC_API_KEY) {
		throw new Error('ANTHROPIC_API_KEY is not configured');
	}

	const response = await fetch(`${getAnthropicBaseUrl(bindings)}/v1/messages`, {
		method: 'POST',
		headers: {
			'x-api-key': bindings.ANTHROPIC_API_KEY,
			'anthropic-version': '2023-06-01',
			'content-type': 'application/json',
		},
		body: JSON.stringify({
			model: getAnthropicTextModel(bindings),
			max_tokens: request.maxTokens ?? 1200,
			system: request.system,
			messages: request.messages,
		}),
	});

	const okResponse = await ensureFetchOk(response, 'Anthropic message request failed');
	const payload = (await okResponse.json()) as {
		model?: string;
		content?: Array<{
			type?: string;
			text?: string;
		}>;
	};

	const text = (payload.content ?? [])
		.filter((block) => block.type === 'text' && typeof block.text === 'string')
		.map((block) => block.text ?? '')
		.join('\n')
		.trim();

	if (!text) {
		throw new Error('Anthropic message response contained no text');
	}

	return {
		text,
		model: payload.model ?? getAnthropicTextModel(bindings),
	};
}
