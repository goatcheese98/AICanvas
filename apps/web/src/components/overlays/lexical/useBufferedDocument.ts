import { useMountEffect } from '@/hooks/useMountEffect';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

export type BufferedCommitReason = 'debounce' | 'editing-exit' | 'deselect' | 'unmount';

export interface BufferedDocumentDebugState {
	isDirty: boolean;
	hasPendingCommit: boolean;
	lastCommitAt: number | null;
	lastCommitReason: BufferedCommitReason | null;
	lastExternalSyncAt: number | null;
	commitCount: number;
	externalSyncCount: number;
	localValueSize: number;
	remoteValueSize: number;
	awaitingRemoteAck: boolean;
}

interface UseBufferedDocumentOptions {
	remoteValue: string;
	isEditing: boolean;
	debounceMs: number;
	onCommit: (value: string, reason: BufferedCommitReason) => void;
	enableDebugMetrics?: boolean;
}

function createDebugState(
	localValue: string,
	remoteValue: string,
	hasPendingCommit: boolean,
	awaitingRemoteAck: boolean,
	overrides?: Partial<BufferedDocumentDebugState>,
): BufferedDocumentDebugState {
	return {
		isDirty: hasPendingCommit || awaitingRemoteAck || localValue !== remoteValue,
		hasPendingCommit,
		lastCommitAt: null,
		lastCommitReason: null,
		lastExternalSyncAt: null,
		commitCount: 0,
		externalSyncCount: 0,
		localValueSize: localValue.length,
		remoteValueSize: remoteValue.length,
		awaitingRemoteAck,
		...overrides,
	};
}

export function useBufferedDocument({
	remoteValue,
	isEditing,
	debounceMs,
	onCommit,
	enableDebugMetrics = false,
}: UseBufferedDocumentOptions) {
	const [editorInitialValue, setEditorInitialValue] = useState(remoteValue);
	const [editorInstanceKey, setEditorInstanceKey] = useState(0);
	const latestLocalValueRef = useRef(remoteValue);
	const pendingValueRef = useRef<string | null>(null);
	const pendingCommitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const awaitingRemoteAckRef = useRef<string | null>(null);
	const [debugState, setDebugState] = useState<BufferedDocumentDebugState>(() =>
		createDebugState(remoteValue, remoteValue, false, false),
	);

	const publishDebugState = useCallback(
		(overrides?: Partial<BufferedDocumentDebugState>) => {
			if (!enableDebugMetrics) return;
			setDebugState((current) =>
				createDebugState(
					latestLocalValueRef.current,
					remoteValue,
					pendingValueRef.current !== null,
					awaitingRemoteAckRef.current !== null,
					{
						lastCommitAt: current.lastCommitAt,
						lastCommitReason: current.lastCommitReason,
						lastExternalSyncAt: current.lastExternalSyncAt,
						commitCount: current.commitCount,
						externalSyncCount: current.externalSyncCount,
						...overrides,
					},
				),
			);
		},
		[enableDebugMetrics, remoteValue],
	);

	const flush = useCallback(
		(reason: BufferedCommitReason) => {
			if (pendingCommitTimeoutRef.current !== null) {
				clearTimeout(pendingCommitTimeoutRef.current);
				pendingCommitTimeoutRef.current = null;
			}

			const pendingValue = pendingValueRef.current;
			if (pendingValue === null) {
				publishDebugState();
				return;
			}

			pendingValueRef.current = null;
			awaitingRemoteAckRef.current = pendingValue;
			onCommit(pendingValue, reason);
			publishDebugState({
				lastCommitAt: Date.now(),
				lastCommitReason: reason,
				commitCount: debugState.commitCount + 1,
			});
		},
		[debugState.commitCount, onCommit, publishDebugState],
	);

	const scheduleLocalChange = useCallback(
		(nextValue: string) => {
			latestLocalValueRef.current = nextValue;
			pendingValueRef.current = nextValue;

			if (pendingCommitTimeoutRef.current !== null) {
				clearTimeout(pendingCommitTimeoutRef.current);
			}

			pendingCommitTimeoutRef.current = setTimeout(() => {
				pendingCommitTimeoutRef.current = null;
				flush('debounce');
			}, debounceMs);

			publishDebugState();
		},
		[debounceMs, flush, publishDebugState],
	);

	// Track previous isEditing to detect change
	const prevIsEditingRef = useRef(isEditing);

	// Handle flush on editing exit - moved to useEffect
	useEffect(() => {
		if (prevIsEditingRef.current && !isEditing) {
			// Editing just ended, flush immediately
			flush('editing-exit');
		}
		prevIsEditingRef.current = isEditing;
	}, [isEditing, flush]);

	// External store sync for remoteValue changes - moved to useEffect
	const lastProcessedRemoteValueRef = useRef(remoteValue);
	const externalSyncCountRef = useRef(0);

	useEffect(() => {
		const newRemoteValue = remoteValue;
		if (newRemoteValue === lastProcessedRemoteValueRef.current) {
			return;
		}
		lastProcessedRemoteValueRef.current = newRemoteValue;

		if (newRemoteValue === awaitingRemoteAckRef.current) {
			awaitingRemoteAckRef.current = null;
			publishDebugState();
		} else if (newRemoteValue === latestLocalValueRef.current) {
			publishDebugState();
		} else if (awaitingRemoteAckRef.current !== null) {
			publishDebugState();
		} else if (pendingValueRef.current !== null || isEditing) {
			publishDebugState();
		} else {
			latestLocalValueRef.current = newRemoteValue;
			setEditorInitialValue(newRemoteValue);
			setEditorInstanceKey((current) => current + 1);
			externalSyncCountRef.current += 1;
			publishDebugState({
				lastExternalSyncAt: Date.now(),
				externalSyncCount: externalSyncCountRef.current,
			});
		}
	}, [remoteValue, isEditing, flush, publishDebugState]);

	// Flush on unmount
	useMountEffect(() => {
		return () => {
			flush('unmount');
		};
	});

	return {
		editorInitialValue,
		editorInstanceKey,
		scheduleLocalChange,
		flush,
		getLatestValue: () => latestLocalValueRef.current,
		debugState,
	};
}
