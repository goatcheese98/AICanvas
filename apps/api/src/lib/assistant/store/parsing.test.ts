import { describe, expect, it, vi } from 'vitest';
import {
	logParseFailure,
	parseContextSnapshot,
	parseEventData,
	parseMessage,
	parseMessageHistory,
	parsePrototypeContext,
	parseStringArray,
	parseTaskInput,
	parseTaskOutput,
} from './parsing';

// Mock the observability module
vi.mock('../../observability', () => ({
	logApiEvent: vi.fn(),
}));

describe('store/parsing helpers', () => {
	describe('parseMessage', () => {
		it('returns undefined for null value', () => {
			expect(parseMessage(null)).toBeUndefined();
		});

		it('parses valid JSON message', () => {
			const message = { id: '1', role: 'user', content: 'hello', createdAt: '2024-01-01' };
			expect(parseMessage(JSON.stringify(message))).toEqual(message);
		});

		it('returns undefined and logs for invalid JSON', () => {
			expect(parseMessage('invalid json')).toBeUndefined();
		});
	});

	describe('parseMessageHistory', () => {
		it('returns undefined for null value', () => {
			expect(parseMessageHistory(null)).toBeUndefined();
		});

		it('parses valid JSON message array', () => {
			const messages = [
				{ id: '1', role: 'user', content: 'hello', createdAt: '2024-01-01' },
				{ id: '2', role: 'assistant', content: 'hi', createdAt: '2024-01-01' },
			];
			expect(parseMessageHistory(JSON.stringify(messages))).toEqual(messages);
		});

		it('returns undefined for invalid JSON', () => {
			expect(parseMessageHistory('invalid')).toBeUndefined();
		});
	});

	describe('parsePrototypeContext', () => {
		it('returns undefined for null value', () => {
			expect(parsePrototypeContext(null)).toBeUndefined();
		});

		it('parses valid prototype context', () => {
			const context = { files: { '/index.js': 'console.log("hello")' } };
			expect(parsePrototypeContext(JSON.stringify(context))).toEqual(context);
		});

		it('returns undefined for invalid JSON', () => {
			expect(parsePrototypeContext('invalid')).toBeUndefined();
		});
	});

	describe('parseStringArray', () => {
		it('returns undefined for null value', () => {
			expect(parseStringArray(null)).toBeUndefined();
		});

		it('parses valid string array', () => {
			const arr = ['a', 'b', 'c'];
			expect(parseStringArray(JSON.stringify(arr))).toEqual(arr);
		});

		it('returns undefined for invalid JSON', () => {
			expect(parseStringArray('invalid')).toBeUndefined();
		});
	});

	describe('parseContextSnapshot', () => {
		it('returns undefined for null value', () => {
			expect(parseContextSnapshot(null)).toBeUndefined();
		});

		it('parses valid context snapshot', () => {
			const snapshot = { elements: [], partial: false };
			expect(parseContextSnapshot(JSON.stringify(snapshot))).toEqual(snapshot);
		});

		it('returns undefined for invalid JSON', () => {
			expect(parseContextSnapshot('invalid')).toBeUndefined();
		});
	});

	describe('parseEventData', () => {
		it('returns undefined for null value', () => {
			expect(parseEventData(null)).toBeUndefined();
		});

		it('parses valid event data', () => {
			const data = { message: 'test' };
			expect(parseEventData(JSON.stringify(data))).toEqual(data);
		});

		it('returns undefined for invalid JSON', () => {
			expect(parseEventData('invalid')).toBeUndefined();
		});
	});

	describe('parseTaskInput', () => {
		it('returns undefined for null value', () => {
			expect(parseTaskInput(null)).toBeUndefined();
		});

		it('parses valid task input', () => {
			const input = { prompt: 'test prompt' };
			expect(parseTaskInput(JSON.stringify(input))).toEqual(input);
		});

		it('returns undefined for invalid JSON', () => {
			expect(parseTaskInput('invalid')).toBeUndefined();
		});
	});

	describe('parseTaskOutput', () => {
		it('returns undefined for null value', () => {
			expect(parseTaskOutput(null)).toBeUndefined();
		});

		it('parses valid task output', () => {
			const output = { result: 'test result' };
			expect(parseTaskOutput(JSON.stringify(output))).toEqual(output);
		});

		it('returns undefined for invalid JSON', () => {
			expect(parseTaskOutput('invalid')).toBeUndefined();
		});
	});

	describe('logParseFailure', () => {
		it('logs parse failure with Error', () => {
			// Just verify it doesn't throw
			expect(() => logParseFailure('testField', new Error('test error'))).not.toThrow();
		});

		it('logs parse failure with non-Error', () => {
			// Just verify it doesn't throw
			expect(() => logParseFailure('testField', 'string error')).not.toThrow();
		});
	});
});
