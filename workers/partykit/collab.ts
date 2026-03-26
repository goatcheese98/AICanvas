import type { Connection, Party, Server } from 'partykit/server';

/**
 * CollabRoom — real-time collaboration server.
 * Mirrors excalidraw-room protocol over plain WebSockets.
 * Server-blind: never decrypts payloads (E2E encrypted by clients).
 *
 * Direct port from reference codebase (partykit/collab.ts).
 */
export default class CollabRoom implements Server {
	constructor(readonly room: Party) {}

	onConnect(conn: Connection) {
		// Notify the new connection
		conn.send(JSON.stringify({ type: 'init-room' }));

		// Check if this is the first user
		const connections = [...this.room.getConnections()];
		if (connections.length === 1) {
			conn.send(JSON.stringify({ type: 'first-in-room' }));
		} else {
			// Notify existing users about the new connection
			for (const other of connections) {
				if (other.id !== conn.id) {
					other.send(JSON.stringify({ type: 'new-user', socketId: conn.id }));
				}
			}
		}

		// Broadcast updated user list
		this.broadcastUserChange();
	}

	onClose(_conn: Connection) {
		this.broadcastUserChange();
	}

	onMessage(message: string, sender: Connection) {
		const msg = JSON.parse(message);

		switch (msg.type) {
			case 'server-broadcast':
				// Relay encrypted scene data to all other connections
				for (const conn of this.room.getConnections()) {
					if (conn.id !== sender.id) {
						conn.send(
							JSON.stringify({
								type: 'client-broadcast',
								payload: msg.payload,
								iv: msg.iv,
							}),
						);
					}
				}
				break;

			case 'server-volatile-broadcast':
				// Relay cursor data (lossy — OK to drop)
				for (const conn of this.room.getConnections()) {
					if (conn.id !== sender.id) {
						conn.send(
							JSON.stringify({
								type: 'client-broadcast',
								payload: msg.payload,
								iv: msg.iv,
							}),
						);
					}
				}
				break;

			case 'resync-request':
				// Request latest state from other clients
				for (const conn of this.room.getConnections()) {
					if (conn.id !== sender.id) {
						conn.send(JSON.stringify({ type: 'resync-request', socketId: sender.id }));
						break; // Only need one client to respond
					}
				}
				break;
		}
	}

	private broadcastUserChange() {
		const socketIds = [...this.room.getConnections()].map((c) => c.id);
		const msg = JSON.stringify({ type: 'room-user-change', socketIds });
		for (const conn of this.room.getConnections()) {
			conn.send(msg);
		}
	}
}
