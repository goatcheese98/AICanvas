import { createPortal } from 'react-dom';
import { NOTE_FONT_STACK } from './lexical-note-helpers';

interface LexicalCommentComposerProps {
	show: boolean;
	pendingAnchorText: string;
	commentDraft: string;
	onChangeDraft: (value: string) => void;
	onClose: () => void;
	onSubmit: () => void;
}

export function LexicalCommentComposer({
	show,
	pendingAnchorText,
	commentDraft,
	onChangeDraft,
	onClose,
	onSubmit,
}: LexicalCommentComposerProps) {
	if (!show || typeof document === 'undefined') {
		return null;
	}

	return createPortal(
		<div
			style={{
				position: 'fixed',
				inset: 0,
				zIndex: 4020,
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				background: 'rgba(28,25,23,0.18)',
				backdropFilter: 'blur(3px)',
			}}
		>
			<div
				style={{
					width: 320,
					borderRadius: 18,
					border: '1px solid #e7e5e4',
					background: 'rgba(255,255,255,0.98)',
					boxShadow: '0 22px 60px rgba(28,25,23,0.2)',
					padding: 18,
					display: 'flex',
					flexDirection: 'column',
					gap: 12,
					fontFamily: NOTE_FONT_STACK,
				}}
			>
				<div>
					<div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#78716c' }}>
						New Comment
					</div>
					<div style={{ marginTop: 4, fontSize: 14, color: '#57534e' }}>
						Add context for this selection or note.
					</div>
				</div>
				{pendingAnchorText ? (
					<blockquote
						style={{
							margin: 0,
							padding: '6px 10px',
							borderLeft: '3px solid #d6d3d1',
							background: '#fafaf9',
							color: '#78716c',
							fontSize: 13,
						}}
					>
						{pendingAnchorText}
					</blockquote>
				) : null}
				<textarea
					autoFocus
					value={commentDraft}
					onChange={(event) => onChangeDraft(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
							event.preventDefault();
							onSubmit();
						}
						if (event.key === 'Escape') {
							event.preventDefault();
							onClose();
						}
					}}
					placeholder="Type a comment..."
					style={{
						minHeight: 90,
						resize: 'vertical',
						borderRadius: 14,
						border: '1px solid #d6d3d1',
						padding: '10px 12px',
						fontSize: 14,
						outline: 'none',
					}}
				/>
				<div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
					<button
						type="button"
						onClick={onClose}
						style={{
							border: 0,
							background: '#f5f5f4',
							color: '#57534e',
							padding: '8px 12px',
							borderRadius: 999,
							fontSize: 13,
							cursor: 'pointer',
						}}
					>
						Cancel
					</button>
					<button
						type="button"
						disabled={!commentDraft.trim()}
						onClick={onSubmit}
						style={{
							border: 0,
							background: '#4d55cc',
							color: '#fff',
							padding: '8px 14px',
							borderRadius: 999,
							fontSize: 13,
							cursor: commentDraft.trim() ? 'pointer' : 'not-allowed',
							opacity: commentDraft.trim() ? 1 : 0.45,
						}}
					>
						Comment
					</button>
				</div>
			</div>
		</div>,
		document.body,
	);
}
