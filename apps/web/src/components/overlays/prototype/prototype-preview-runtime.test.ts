import type {
	PrototypeCardPreview,
	PrototypeOverlayCustomData,
	PrototypeOverlayFile,
} from '@ai-canvas/shared/types';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type WorkerListener = (
	event: MessageEvent<{ id: number; ok: boolean; modules?: Record<string, string> }>,
) => void;

const { MockPrototypeCompilerWorker, workerInstances } = vi.hoisted(() => {
	const instances: Array<{
		postMessage: ReturnType<typeof vi.fn>;
		terminate: ReturnType<typeof vi.fn>;
		addEventListener: (type: 'message', listener: WorkerListener) => void;
		removeEventListener: (type: 'message', listener: WorkerListener) => void;
	}> = [];

	class HoistedMockPrototypeCompilerWorker {
		private listeners = new Set<WorkerListener>();

		postMessage = vi.fn((message: { id: number; files: Record<string, PrototypeOverlayFile> }) => {
			this.emit({
				id: message.id,
				ok: true,
				modules: Object.fromEntries(
					Object.entries(message.files).map(([path, file]) => [path, file.code]),
				),
			});
		});

		terminate = vi.fn();

		constructor() {
			instances.push(this);
		}

		addEventListener(_type: 'message', listener: WorkerListener) {
			this.listeners.add(listener);
		}

		removeEventListener(_type: 'message', listener: WorkerListener) {
			this.listeners.delete(listener);
		}

		private emit(data: {
			id: number;
			ok: boolean;
			modules?: Record<string, string>;
		}) {
			for (const listener of this.listeners) {
				listener({
					data,
				} as MessageEvent<{ id: number; ok: boolean; modules?: Record<string, string> }>);
			}
		}
	}

	return {
		MockPrototypeCompilerWorker: HoistedMockPrototypeCompilerWorker,
		workerInstances: instances,
	};
});

import {
	setPrototypeCompilerWorkerFactoryForTests,
	usePrototypePreview,
} from './prototype-preview-runtime';

function createPreview(): PrototypeCardPreview {
	return {
		eyebrow: 'Test',
		title: 'Test',
		description: 'Preview card',
		accent: '#000000',
		background: '#ffffff',
		badges: [],
		metrics: [],
	};
}

function createInput(): PrototypeOverlayCustomData {
	return {
		type: 'prototype',
		template: 'react',
		files: {
			'/index.jsx': {
				code: 'export default function App() { return <div>Hello</div>; }',
				active: true,
			},
		},
		dependencies: {},
		preview: createPreview(),
		title: 'Prototype',
		activeFile: '/index.jsx',
		showEditor: true,
		showPreview: true,
	};
}

describe('usePrototypePreview', () => {
	beforeEach(() => {
		workerInstances.length = 0;
		setPrototypeCompilerWorkerFactoryForTests(
			() => new MockPrototypeCompilerWorker() as unknown as Worker,
		);
	});

	afterEach(() => {
		vi.clearAllMocks();
		setPrototypeCompilerWorkerFactoryForTests(null);
	});

	it('does not recompile when the prototype data is unchanged but object references change', async () => {
		const initialInput = createInput();
		const { rerender } = renderHook(({ input }) => usePrototypePreview(input), {
			initialProps: { input: initialInput },
		});

		await waitFor(() => {
			expect(workerInstances[0]?.postMessage).toHaveBeenCalledTimes(1);
		});

		const worker = workerInstances[0];
		expect(worker).toBeDefined();

		rerender({
			input: {
				...initialInput,
				files: Object.fromEntries(
					Object.entries(initialInput.files).map(([path, file]) => [path, { ...file }]),
				),
				dependencies: { ...initialInput.dependencies },
				preview: initialInput.preview ? { ...initialInput.preview } : createPreview(),
			},
		});

		await waitFor(() => {
			expect(worker?.postMessage).toHaveBeenCalledTimes(1);
		});
	});

	it('recompiles when refresh is requested', async () => {
		const { result } = renderHook(() => usePrototypePreview(createInput()));

		await waitFor(() => {
			expect(workerInstances[0]?.postMessage).toHaveBeenCalledTimes(1);
		});

		const worker = workerInstances[0];

		act(() => {
			result.current.refresh();
		});

		await waitFor(() => {
			expect(worker?.postMessage).toHaveBeenCalledTimes(2);
		});
	});
});
