import { useMountEffect } from '@/hooks/useMountEffect';
import { type Dispatch, type SetStateAction, useCallback, useRef, useState } from 'react';
import { MAX_MARKDOWN_TITLE_LENGTH } from './markdown-note-helpers';

interface UseMarkdownTitleProps {
	initialTitle: string;
	onTitleChange: (title: string) => void;
}

interface UseMarkdownTitleReturn {
	title: string;
	setTitle: Dispatch<SetStateAction<string>>;
	titleNotice: boolean;
	handleTitleChange: (nextValue: string) => void;
	handleTitleBlur: () => void;
}

export function useMarkdownTitle({
	initialTitle,
	onTitleChange,
}: UseMarkdownTitleProps): UseMarkdownTitleReturn {
	const [title, setTitleState] = useState(initialTitle);
	const titleRef = useRef(title);
	titleRef.current = title;
	const [titleNotice, setTitleNotice] = useState(false);
	const titleNoticeTimeoutRef = useRef<number | null>(null);

	// Cleanup timeout on unmount
	useMountEffect(() => {
		return () => {
			if (titleNoticeTimeoutRef.current !== null) {
				window.clearTimeout(titleNoticeTimeoutRef.current);
			}
		};
	});

	const showTitleLimitNotice = useCallback(() => {
		setTitleNotice(true);
		if (titleNoticeTimeoutRef.current !== null) {
			window.clearTimeout(titleNoticeTimeoutRef.current);
		}
		titleNoticeTimeoutRef.current = window.setTimeout(() => {
			setTitleNotice(false);
			titleNoticeTimeoutRef.current = null;
		}, 1800);
	}, []);

	const setTitle = useCallback(
		(value: SetStateAction<string>) => {
			const nextValue = typeof value === 'function' ? value(title) : value;
			setTitleState(nextValue);
			onTitleChange(nextValue);
		},
		[onTitleChange, title],
	);

	const handleTitleChange = useCallback(
		(nextValue: string) => {
			if (nextValue.length > MAX_MARKDOWN_TITLE_LENGTH) {
				showTitleLimitNotice();
				setTitle(nextValue.slice(0, MAX_MARKDOWN_TITLE_LENGTH));
				return;
			}
			setTitle(nextValue);
		},
		[setTitle, showTitleLimitNotice],
	);

	const handleTitleBlur = useCallback(() => {
		const currentTitle = titleRef.current;
		const trimmedTitle = currentTitle.trim();
		setTitle(trimmedTitle.length > 0 ? trimmedTitle : initialTitle);
	}, [initialTitle, setTitle]);

	return {
		title,
		setTitle,
		titleNotice,
		handleTitleChange,
		handleTitleBlur,
	};
}
