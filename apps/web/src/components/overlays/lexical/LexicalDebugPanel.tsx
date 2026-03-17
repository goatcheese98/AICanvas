import type { BufferedDocumentDebugState } from './useBufferedDocument';

export function LexicalDebugPanel({
	elementId,
	renderCount,
	debugState,
}: {
	elementId: string;
	renderCount: number;
	debugState: BufferedDocumentDebugState;
}) {
	return (
		<div
			style={{
				position: 'absolute',
				right: 12,
				bottom: 12,
				zIndex: 20,
				width: 260,
				borderRadius: 14,
				border: '1px solid rgba(120, 113, 108, 0.24)',
				background: 'rgba(28, 25, 23, 0.92)',
				color: '#f5f5f4',
				padding: 12,
				fontFamily: '"Cascadia Code", "SFMono-Regular", monospace',
				fontSize: 11,
				lineHeight: 1.45,
				boxShadow: '0 12px 30px rgba(0,0,0,0.22)',
				pointerEvents: 'none',
			}}
		>
			<div
				style={{
					fontWeight: 700,
					letterSpacing: '0.08em',
					textTransform: 'uppercase',
					marginBottom: 8,
				}}
			>
				Lexical Debug
			</div>
			<div>id: {elementId}</div>
			<div>renders: {renderCount}</div>
			<div>dirty: {String(debugState.isDirty)}</div>
			<div>pending: {String(debugState.hasPendingCommit)}</div>
			<div>awaitingAck: {String(debugState.awaitingRemoteAck)}</div>
			<div>localBytes: {debugState.localValueSize}</div>
			<div>remoteBytes: {debugState.remoteValueSize}</div>
			<div>commits: {debugState.commitCount}</div>
			<div>externalSyncs: {debugState.externalSyncCount}</div>
			<div>lastReason: {debugState.lastCommitReason ?? 'none'}</div>
			<div>
				lastCommitAt:{' '}
				{debugState.lastCommitAt ? new Date(debugState.lastCommitAt).toLocaleTimeString() : 'never'}
			</div>
			<div>
				lastExternalSyncAt:{' '}
				{debugState.lastExternalSyncAt
					? new Date(debugState.lastExternalSyncAt).toLocaleTimeString()
					: 'never'}
			</div>
		</div>
	);
}
