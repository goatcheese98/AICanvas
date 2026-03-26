/**
 * JSON parsing helpers for safe deserialization of database JSON fields.
 */

import type {
	AssistantContextSnapshot,
	AssistantMessage,
	AssistantRunEvent,
	AssistantTaskInput,
	AssistantTaskOutput,
	PrototypeOverlayCustomData,
} from '@ai-canvas/shared/types';
import { logApiEvent } from '../../observability';

export function logParseFailure(field: string, err: unknown) {
	logApiEvent('warn', 'store.json_parse_failed', {
		field,
		message: err instanceof Error ? err.message : String(err),
	});
}

export function parseMessage(value: string | null): AssistantMessage | undefined {
	if (!value) {
		return undefined;
	}

	try {
		return JSON.parse(value) as AssistantMessage;
	} catch (err) {
		logParseFailure('message', err);
		return undefined;
	}
}

export function parseMessageHistory(value: string | null): AssistantMessage[] | undefined {
	if (!value) {
		return undefined;
	}

	try {
		return JSON.parse(value) as AssistantMessage[];
	} catch (err) {
		logParseFailure('messageHistory', err);
		return undefined;
	}
}

export function parsePrototypeContext(
	value: string | null,
): PrototypeOverlayCustomData | undefined {
	if (!value) {
		return undefined;
	}

	try {
		return JSON.parse(value) as PrototypeOverlayCustomData;
	} catch (err) {
		logParseFailure('prototypeContext', err);
		return undefined;
	}
}

export function parseStringArray(value: string | null): string[] | undefined {
	if (!value) {
		return undefined;
	}

	try {
		return JSON.parse(value) as string[];
	} catch (err) {
		logParseFailure('stringArray', err);
		return undefined;
	}
}

export function parseContextSnapshot(value: string | null): AssistantContextSnapshot | undefined {
	if (!value) {
		return undefined;
	}

	try {
		return JSON.parse(value) as AssistantContextSnapshot;
	} catch (err) {
		logParseFailure('contextSnapshot', err);
		return undefined;
	}
}

export function parseEventData(value: string | null): AssistantRunEvent['data'] | undefined {
	if (!value) {
		return undefined;
	}

	try {
		return JSON.parse(value) as AssistantRunEvent['data'];
	} catch (err) {
		logParseFailure('eventData', err);
		return undefined;
	}
}

export function parseTaskInput(value: string | null): AssistantTaskInput | undefined {
	if (!value) {
		return undefined;
	}

	try {
		return JSON.parse(value) as AssistantTaskInput;
	} catch (err) {
		logParseFailure('taskInput', err);
		return undefined;
	}
}

export function parseTaskOutput(value: string | null): AssistantTaskOutput | undefined {
	if (!value) {
		return undefined;
	}

	try {
		return JSON.parse(value) as AssistantTaskOutput;
	} catch (err) {
		logParseFailure('taskOutput', err);
		return undefined;
	}
}
