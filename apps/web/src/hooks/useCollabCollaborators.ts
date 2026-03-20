import { useAppStore } from '@/stores/store';
import { useCallback, useRef, useState } from 'react';
import {
	applyCollaboratorsSnapshot,
	createId,
	getSessionCollaboratorColor,
	type CollaborationApi,
	type CollaboratorColor,
	type CollaboratorState,
} from './collaboration-session';

export interface CollabCollaborators {
	collaborators: Map<string, CollaboratorState>;
	applyCollaborators: (next: Map<string, CollaboratorState>) => void;
	collaboratorColor: CollaboratorColor;
	clientId: string;
	collaboratorsRef: { current: Map<string, CollaboratorState> };
}

function createCollaboratorState(): Map<string, CollaboratorState> {
	return new Map();
}

export function useCollabCollaborators(
	apiRef: { current: CollaborationApi | null },
): CollabCollaborators {
	const setAppState = useAppStore((s) => s.setAppState);
	const [collaborators, setCollaborators] = useState<Map<string, CollaboratorState>>(
		createCollaboratorState(),
	);
	const collaboratorsRef = useRef<Map<string, CollaboratorState>>(createCollaboratorState());
	const clientIdRef = useRef(createId());
	const collaboratorColorRef = useRef<CollaboratorColor>(getSessionCollaboratorColor());

	const applyCollaborators = useCallback(
		(next: Map<string, CollaboratorState>) => {
			collaboratorsRef.current = next;
			applyCollaboratorsSnapshot(apiRef.current, setCollaborators, setAppState, next);
		},
		[setAppState, apiRef],
	);

	const resetCollaborators = useCallback(() => {
		collaboratorsRef.current = createCollaboratorState();
		setCollaborators(createCollaboratorState());
	}, []);

	return {
		collaborators,
		applyCollaborators,
		collaboratorColor: collaboratorColorRef.current,
		clientId: clientIdRef.current,
		collaboratorsRef,
	};
}
