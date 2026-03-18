import { useCallback, useRef } from 'react';
import { CHAT_INPUT_MAX_HEIGHT } from './ai-chat-constants';

/**
 * Hook for auto-resizing textarea based on content.
 * Uses event-driven pattern instead of useEffect.
 *
 * @returns Ref to attach to textarea and resize function
 */
export function useAutoResizeTextarea() {
	const textareaRef = useRef<HTMLTextAreaElement | null>(null);

	/**
	 * Resizes the textarea based on its scroll height.
	 * Call this in the textarea's onChange handler.
	 */
	const resizeTextarea = useCallback(() => {
		const textarea = textareaRef.current;
		if (!textarea) {
			return;
		}

		// Reset height to auto to get the correct scrollHeight
		textarea.style.height = '0px';
		const nextHeight = Math.min(Math.max(textarea.scrollHeight, 44), CHAT_INPUT_MAX_HEIGHT);
		textarea.style.height = `${nextHeight}px`;
		textarea.style.overflowY = textarea.scrollHeight > CHAT_INPUT_MAX_HEIGHT ? 'auto' : 'hidden';
	}, []);

	/**
	 * Sets the textarea ref and performs initial resize if needed.
	 */
	const setTextareaRef = useCallback((element: HTMLTextAreaElement | null) => {
		textareaRef.current = element;
		if (element) {
			// Initial resize
			requestAnimationFrame(() => {
				element.style.height = '0px';
				const nextHeight = Math.min(Math.max(element.scrollHeight, 44), CHAT_INPUT_MAX_HEIGHT);
				element.style.height = `${nextHeight}px`;
				element.style.overflowY = element.scrollHeight > CHAT_INPUT_MAX_HEIGHT ? 'auto' : 'hidden';
			});
		}
	}, []);

	return {
		textareaRef,
		setTextareaRef,
		resizeTextarea,
	};
}
