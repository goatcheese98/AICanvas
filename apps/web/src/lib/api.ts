import type { AppType } from '@ai-canvas/api';
import type { JoinWaitlist, JoinWaitlistResponse } from '@ai-canvas/shared/schemas';
import type {
	AssistantArtifactRecord,
	AssistantRun,
	AssistantRunEvent,
	AssistantTask,
	AssistantThread,
} from '@ai-canvas/shared/types';
import { hc } from 'hono/client';
import {
	addObservabilityBreadcrumb,
	captureBrowserException,
	getSentryTraceHeaders,
} from './observability';

function normalizeApiBaseUrl(value: string | undefined): string {
	return (value ?? '').trim().replace(/\/+$/, '');
}

function toApiUrl(path: string): string {
	const normalizedBaseUrl = normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL);
	return normalizedBaseUrl ? `${normalizedBaseUrl}${path}` : path;
}

function createClientRequestId() {
	return typeof crypto.randomUUID === 'function'
		? crypto.randomUUID()
		: `client-${Math.random().toString(36).slice(2, 12)}`;
}

function buildObservedHeaders(headers: Record<string, string> = {}) {
	return {
		...getSentryTraceHeaders(),
		...headers,
		'x-client-request-id': createClientRequestId(),
	};
}

async function observedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
	const observedHeaders = buildObservedHeaders(
		Object.fromEntries(new Headers(init.headers).entries()),
	);
	const response = await fetch(input, {
		...init,
		headers: observedHeaders,
	});
	const serverRequestId = response.headers.get('x-request-id') ?? undefined;
	addObservabilityBreadcrumb('api.request', {
		url: typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url,
		method: init.method ?? 'GET',
		status: response.status,
		serverRequestId,
		clientRequestId: observedHeaders['x-client-request-id'],
	});
	return response;
}

export async function getRequiredAuthHeaders(
	getToken: () => Promise<string | null>,
): Promise<Record<string, string>> {
	const token = await getToken();
	if (!token) {
		throw new Error('Sign in is required to access this resource.');
	}

	return {
		Authorization: `Bearer ${token}`,
	};
}

export const api = hc<AppType>(normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL) || '/', {
	fetch: observedFetch,
});

async function readJsonOrThrow<T>(response: Response, fallbackMessage: string): Promise<T> {
	const serverRequestId = response.headers.get('x-request-id');

	if (!response.ok) {
		const body = await response.text();
		const message = body || fallbackMessage;
		const enrichedMessage = serverRequestId ? `${message} (request ${serverRequestId})` : message;
		const error = new Error(enrichedMessage);
		captureBrowserException(error, {
			tags: {
				area: 'api',
				action: 'response_error',
			},
			extra: {
				status: response.status,
				serverRequestId,
				url: response.url,
			},
		});
		throw error;
	}

	return (await response.json()) as T;
}

function consumeSsePayload(buffer: string) {
	const parts = buffer.split('\n\n');
	return {
		complete: parts.slice(0, -1),
		remainder: parts.at(-1) ?? '',
	};
}

function parseSseEvent(rawEvent: string): AssistantRunEvent | null {
	const lines = rawEvent.split('\n');
	let dataLine = '';

	for (const line of lines) {
		if (line.startsWith('data: ')) {
			dataLine = line.slice(6);
		}
	}

	if (!dataLine) {
		return null;
	}

	try {
		return JSON.parse(dataLine) as AssistantRunEvent;
	} catch {
		return null;
	}
}

export async function streamAssistantRunEvents(
	runId: string,
	headers: Record<string, string>,
	onEvent: (event: AssistantRunEvent) => void,
): Promise<void> {
	const response = await observedFetch(toApiUrl(`/api/assistant/runs/${runId}/events`), {
		headers,
	});

	if (!response.ok) {
		const body = await response.text();
		throw new Error(body || `Assistant event stream failed with status ${response.status}`);
	}

	if (!response.body) {
		throw new Error('Assistant event stream is unavailable.');
	}

	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let buffer = '';

	while (true) {
		const { done, value } = await reader.read();
		if (done) {
			break;
		}

		buffer += decoder.decode(value, { stream: true });
		const { complete, remainder } = consumeSsePayload(buffer);
		buffer = remainder;

		for (const rawEvent of complete) {
			const event = parseSseEvent(rawEvent);
			if (event) {
				onEvent(event);
			}
		}
	}
}

export async function fetchAssistantThreads(
	canvasId: string,
	headers: Record<string, string>,
): Promise<AssistantThread[]> {
	const response = await observedFetch(
		toApiUrl(`/api/assistant/threads?canvasId=${encodeURIComponent(canvasId)}`),
		{ headers },
	);
	return readJsonOrThrow<AssistantThread[]>(
		response,
		`Assistant thread fetch failed with status ${response.status}`,
	);
}

export async function createAssistantThread(
	input: { canvasId: string; title?: string },
	headers: Record<string, string>,
): Promise<AssistantThread> {
	const response = await observedFetch(toApiUrl('/api/assistant/threads'), {
		method: 'POST',
		headers: {
			...headers,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(input),
	});
	return readJsonOrThrow<AssistantThread>(
		response,
		`Assistant thread creation failed with status ${response.status}`,
	);
}

export async function deleteAssistantThread(
	threadId: string,
	headers: Record<string, string>,
): Promise<void> {
	const response = await observedFetch(toApiUrl(`/api/assistant/threads/${threadId}`), {
		method: 'DELETE',
		headers,
	});
	await readJsonOrThrow<{ ok: true }>(
		response,
		`Assistant thread deletion failed with status ${response.status}`,
	);
}

export async function fetchAssistantRun(
	runId: string,
	headers: Record<string, string>,
): Promise<AssistantRun> {
	const response = await observedFetch(toApiUrl(`/api/assistant/runs/${runId}`), { headers });
	return readJsonOrThrow<AssistantRun>(
		response,
		`Assistant run fetch failed with status ${response.status}`,
	);
}

export async function fetchAssistantRunTasks(
	runId: string,
	headers: Record<string, string>,
): Promise<AssistantTask[]> {
	const response = await observedFetch(toApiUrl(`/api/assistant/runs/${runId}/tasks`), { headers });
	return readJsonOrThrow<AssistantTask[]>(
		response,
		`Assistant task fetch failed with status ${response.status}`,
	);
}

export async function fetchAssistantRunArtifacts(
	runId: string,
	headers: Record<string, string>,
): Promise<AssistantArtifactRecord[]> {
	const response = await observedFetch(toApiUrl(`/api/assistant/runs/${runId}/artifacts`), {
		headers,
	});
	return readJsonOrThrow<AssistantArtifactRecord[]>(
		response,
		`Assistant artifact fetch failed with status ${response.status}`,
	);
}

export async function joinWaitlist(input: JoinWaitlist): Promise<JoinWaitlistResponse> {
	const response = await observedFetch(toApiUrl('/api/waitlist'), {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(input),
	});

	return readJsonOrThrow<JoinWaitlistResponse>(
		response,
		`Waitlist signup failed with status ${response.status}`,
	);
}
