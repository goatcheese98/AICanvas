import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CHAT_INPUT_MAX_HEIGHT } from './ai-chat-constants';
import { useAutoResizeTextarea } from './useAutoResizeTextarea';

// Test component that uses the hook
function TestComponent({
	initialValue = '',
	onResize,
	testId = 'test-textarea',
}: {
	initialValue?: string;
	onResize?: () => void;
	testId?: string;
}) {
	const { textareaRef, resizeTextarea } = useAutoResizeTextarea();
	const [value, setValue] = useState(initialValue);

	return (
		<textarea
			ref={textareaRef}
			value={value}
			onChange={(e) => {
				setValue(e.target.value);
				resizeTextarea();
				onResize?.();
			}}
			data-testid={testId}
		/>
	);
}

describe('useAutoResizeTextarea', () => {
	it('initializes with null ref', () => {
		function RefChecker() {
			const { textareaRef } = useAutoResizeTextarea();
			return <div data-testid="ref-check">{textareaRef.current === null ? 'null' : 'set'}</div>;
		}

		const { unmount } = render(<RefChecker />);
		expect(screen.getByTestId('ref-check').textContent).toBe('null');
		unmount();
	});

	it('resizes textarea on input change', () => {
		const onResize = vi.fn();
		const { unmount } = render(<TestComponent onResize={onResize} testId="resize-textarea" />);

		const textarea = screen.getByTestId('resize-textarea') as HTMLTextAreaElement;

		// Trigger a change event
		fireEvent.change(textarea, { target: { value: 'Some text' } });

		expect(onResize).toHaveBeenCalled();
		unmount();
	});

	it('respects max height limit', () => {
		const { unmount } = render(<TestComponent testId="max-height-textarea" />);

		const textarea = screen.getByTestId('max-height-textarea') as HTMLTextAreaElement;

		// Mock scrollHeight to be larger than max
		Object.defineProperty(textarea, 'scrollHeight', {
			configurable: true,
			value: CHAT_INPUT_MAX_HEIGHT + 100,
			writable: true,
		});

		fireEvent.change(textarea, { target: { value: 'A\n'.repeat(50) } });

		// Should have overflow auto when exceeding max height
		expect(textarea.style.overflowY).toBe('auto');
		unmount();
	});

	it('sets overflow to hidden when content is small', () => {
		const { unmount } = render(<TestComponent testId="small-textarea" />);

		const textarea = screen.getByTestId('small-textarea') as HTMLTextAreaElement;

		// Mock scrollHeight to be small
		Object.defineProperty(textarea, 'scrollHeight', {
			configurable: true,
			value: 50,
			writable: true,
		});

		fireEvent.change(textarea, { target: { value: 'Short' } });

		expect(textarea.style.overflowY).toBe('hidden');
		unmount();
	});
});
