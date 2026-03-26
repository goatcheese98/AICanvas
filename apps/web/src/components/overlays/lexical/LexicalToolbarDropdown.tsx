import { useMountEffect } from '@/hooks/useMountEffect';
import { useCallback, useState } from 'react';
import ReactDOM from 'react-dom';

interface PortalDropdownProps {
	triggerRef: React.RefObject<HTMLElement | null>;
	isOpen: boolean;
	onClose: () => void;
	children: React.ReactNode;
	minWidth?: number;
}

import type { ReactElement } from 'react';

export function PortalDropdown({
	triggerRef,
	isOpen,
	onClose,
	children,
	minWidth = 160,
}: PortalDropdownProps): ReactElement | null {
	const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

	const updatePosition = useCallback(() => {
		if (!isOpen || !triggerRef.current) return;
		const rect = triggerRef.current.getBoundingClientRect();
		const left = Math.min(rect.left, window.innerWidth - minWidth - 8);
		setPosition({ top: rect.bottom + 4, left });
	}, [isOpen, minWidth, triggerRef]);

	// Update position when dropdown opens (legitimate DOM positioning - useMountEffect)
	useMountEffect(() => {
		if (isOpen) {
			updatePosition();
		}
	});

	// Update position when isOpen changes (derived from props, not effect)
	// Using inline check since this is DOM positioning for the portal
	if (isOpen && !position) {
		updatePosition();
	}

	if (!isOpen || !position) return null;

	return ReactDOM.createPortal(
		<>
			<div
				style={{ position: 'fixed', inset: 0, zIndex: 99990 }}
				onClick={onClose}
				onMouseDown={(event) => event.preventDefault()}
			/>
			<div
				style={{
					position: 'fixed',
					top: position.top,
					left: position.left,
					zIndex: 99991,
					background: 'rgba(255,255,255,0.98)',
					border: '1px solid #e7e5e4',
					borderRadius: 12,
					padding: 10,
					boxShadow: '0 16px 36px rgba(28,25,23,0.12), 0 1px 4px rgba(28,25,23,0.06)',
					minWidth,
					backdropFilter: 'blur(12px)',
					fontFamily:
						'"Segoe UI Variable", "SF Pro Text", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
				}}
				onMouseDown={(event) => event.stopPropagation()}
			>
				{children}
			</div>
		</>,
		document.body,
	);
}
