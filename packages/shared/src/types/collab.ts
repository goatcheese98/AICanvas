export interface CollabUser {
	socketId: string;
	username: string;
	color: string;
	avatarUrl?: string;
}

export type ClientToServerMessage =
	| { type: 'server-broadcast'; payload: string; iv: string }
	| { type: 'server-volatile-broadcast'; payload: string; iv: string }
	| { type: 'resync-request' };

export type ServerToClientMessage =
	| { type: 'init-room' }
	| { type: 'first-in-room' }
	| { type: 'new-user'; socketId: string }
	| { type: 'room-user-change'; socketIds: string[] }
	| { type: 'client-broadcast'; payload: string; iv: string }
	| { type: 'resync-request'; socketId: string };

export type CollabMessage = ClientToServerMessage | ServerToClientMessage;
