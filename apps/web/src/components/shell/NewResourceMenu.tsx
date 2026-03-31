import type { ResourceCreationType } from '@/components/shell/useNewResourceCreation';
import {
	RESOURCE_CATEGORIES,
	RESOURCE_TYPE_METADATA,
	type ResourceIconType,
	type ResourceTypeMetadata,
	getResourceShortcut,
} from '@/lib/resource-creation';
import { useCallback, useEffect, useRef, useState } from 'react';

export type NewResourceOption = { type: ResourceCreationType };

interface NewResourceMenuProps {
	isOpen: boolean;
	onClose: () => void;
	onSelect: (option: NewResourceOption) => void;
	triggerRef?: React.RefObject<HTMLElement | null>;
}

interface MenuPosition {
	top: number;
	left: number;
}

/**
 * Dropdown menu for creating new resources
 * Similar pattern to footer popover in LeftSidebar
 */
export function NewResourceMenu({ isOpen, onClose, onSelect, triggerRef }: NewResourceMenuProps) {
	const [isAnimatingOut, setIsAnimatingOut] = useState(false);
	const [position, setPosition] = useState<MenuPosition>({ top: 0, left: 0 });
	const popoverRef = useRef<HTMLDivElement>(null);
	const menuRef = useRef<HTMLDivElement>(null);

	// Calculate position relative to trigger element
	useEffect(() => {
		if (!isOpen || !triggerRef?.current) return;

		const trigger = triggerRef.current;
		const rect = trigger.getBoundingClientRect();

		// Position below the trigger button, aligned to left
		setPosition({
			top: rect.bottom + 8,
			left: rect.left,
		});
	}, [isOpen, triggerRef]);

	// Handle close with animation
	const handleClose = useCallback(() => {
		setIsAnimatingOut(true);
		setTimeout(() => {
			setIsAnimatingOut(false);
			onClose();
		}, 150);
	}, [onClose]);

	// Handle selection
	const handleSelect = useCallback(
		(type: ResourceCreationType) => {
			onSelect({ type });
			handleClose();
		},
		[onSelect, handleClose],
	);

	// Close on escape key
	useEffect(() => {
		if (!isOpen) return;

		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				handleClose();
			}
		};

		document.addEventListener('keydown', handleKeyDown);
		return () => document.removeEventListener('keydown', handleKeyDown);
	}, [isOpen, handleClose]);

	// Close on click outside
	useEffect(() => {
		if (!isOpen) return;

		const handleClickOutside = (e: MouseEvent) => {
			const target = e.target as Node;
			if (
				popoverRef.current &&
				!popoverRef.current.contains(target) &&
				!triggerRef?.current?.contains(target)
			) {
				handleClose();
			}
		};

		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, [isOpen, handleClose, triggerRef]);

	// Focus trap and keyboard navigation within menu
	useEffect(() => {
		if (!isOpen || !menuRef.current) return;

		const menu = menuRef.current;
		const buttons = menu.querySelectorAll<HTMLButtonElement>('[data-resource-option]');

		// Focus first button when opened
		if (buttons.length > 0 && !isAnimatingOut) {
			buttons[0]?.focus();
		}

		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Tab') return;

			const currentIndex = Array.from(buttons).findIndex((btn) => btn === document.activeElement);

			if (e.key === 'ArrowDown') {
				e.preventDefault();
				const nextIndex = currentIndex < buttons.length - 1 ? currentIndex + 1 : 0;
				buttons[nextIndex]?.focus();
			} else if (e.key === 'ArrowUp') {
				e.preventDefault();
				const prevIndex = currentIndex > 0 ? currentIndex - 1 : buttons.length - 1;
				buttons[prevIndex]?.focus();
			}
		};

		document.addEventListener('keydown', handleKeyDown);
		return () => document.removeEventListener('keydown', handleKeyDown);
	}, [isOpen, isAnimatingOut]);

	// Keyboard shortcut handling (Alt/Option + letter)
	useEffect(() => {
		if (!isOpen) return;

		const handleKeyDown = (e: KeyboardEvent) => {
			// Only handle Alt+Key combinations (not when Ctrl/Cmd/Shift are pressed)
			if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;

			const key = e.key.toUpperCase();
			const match = RESOURCE_TYPE_METADATA.find((r) => r.shortcut?.toUpperCase() === key);

			if (match) {
				e.preventDefault();
				handleSelect(match.id);
			}
		};

		document.addEventListener('keydown', handleKeyDown);
		return () => document.removeEventListener('keydown', handleKeyDown);
	}, [isOpen, handleSelect]);

	const shouldRender = isOpen || isAnimatingOut;
	if (!shouldRender) return null;

	return (
		<div
			ref={popoverRef}
			className="fixed z-50"
			style={{
				top: position.top,
				left: position.left,
			}}
		>
			<div
				ref={menuRef}
				role="menu"
				aria-label="Create new resource"
				className={`
					w-72 rounded-xl border border-stone-200 bg-white p-2 shadow-lg
					origin-top-left transition-all duration-150 ease-out
					${isAnimatingOut ? 'opacity-0 scale-95 -translate-y-1' : 'opacity-100 scale-100 translate-y-0'}
				`}
			>
				{/* Heavy Resources Section */}
				<div className="px-2 py-1.5">
					<p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-stone-400">
						Resources
					</p>
					<div className="space-y-0.5">
						{RESOURCE_CATEGORIES.heavy.map((resource) => (
							<MenuItem
								key={resource.id}
								resource={resource}
								onClick={() => handleSelect(resource.id)}
							/>
						))}
					</div>
				</div>

				{/* Divider */}
				<div className="my-1.5 h-px bg-stone-100" />

				{/* Canvas-Native Section */}
				<div className="px-2 py-1.5">
					<p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-stone-400">
						On Canvas
					</p>
					<div className="space-y-0.5">
						{RESOURCE_CATEGORIES.canvasNative.map((resource) => (
							<MenuItem
								key={resource.id}
								resource={resource}
								onClick={() => handleSelect(resource.id)}
							/>
						))}
					</div>
				</div>

				{/* Divider */}
				<div className="my-1.5 h-px bg-stone-100" />

				{/* Navigation Section */}
				<div className="px-2 py-1.5">
					<div className="space-y-0.5">
						{RESOURCE_CATEGORIES.navigation.map((resource) => (
							<MenuItem
								key={resource.id}
								resource={resource}
								onClick={() => handleSelect(resource.id)}
							/>
						))}
					</div>
				</div>

				{/* Keyboard hint */}
				<div className="border-t border-stone-100 px-2 pt-2 pb-1">
					<p className="text-[10px] text-stone-400">
						Press{' '}
						<kbd className="rounded bg-stone-100 px-1 py-0.5 font-mono text-stone-500">Alt</kbd> +
						letter to select
					</p>
				</div>
			</div>
		</div>
	);
}

interface MenuItemProps {
	resource: ResourceTypeMetadata;
	onClick: () => void;
}

function MenuItem({ resource, onClick }: MenuItemProps) {
	const Icon = RESOURCE_ICONS[resource.icon];
	const shortcut = getResourceShortcut(resource.id);

	return (
		<button
			type="button"
			role="menuitem"
			data-resource-option={resource.id}
			onClick={onClick}
			className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4d55cc] focus-visible:ring-offset-1"
		>
			<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-stone-50 text-stone-500">
				<Icon className="h-4 w-4" />
			</div>
			<div className="flex min-w-0 flex-1 flex-col">
				<div className="flex items-center justify-between">
					<span className="text-sm font-medium text-stone-700">{resource.label}</span>
					{shortcut && (
						<kbd className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-mono text-stone-400">
							{shortcut}
						</kbd>
					)}
				</div>
				<span className="truncate text-xs text-stone-400">{resource.description}</span>
			</div>
		</button>
	);
}

const RESOURCE_ICONS: Record<ResourceIconType, React.FC<{ className?: string }>> = {
	canvas: CanvasIcon,
	board: BoardIcon,
	prototype: PrototypeIcon,
	document: DocumentIcon,
	'quick-note': QuickNoteIcon,
	'web-embed': WebEmbedIcon,
};

function CanvasIcon({ className }: { className?: string }) {
	return (
		<svg
			className={className}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<rect width="18" height="18" x="3" y="3" rx="2" />
			<path d="M3 9h18" />
			<path d="M9 21V9" />
		</svg>
	);
}

function BoardIcon({ className }: { className?: string }) {
	return (
		<svg
			className={className}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<rect width="18" height="18" x="3" y="3" rx="2" />
			<path d="M8 7v10" />
			<path d="M12 7v10" />
			<path d="M16 7v10" />
		</svg>
	);
}

function PrototypeIcon({ className }: { className?: string }) {
	return (
		<svg
			className={className}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<polygon points="12 2 2 7 12 12 22 7 12 2" />
			<polyline points="2 17 12 22 22 17" />
			<polyline points="2 12 12 17 22 12" />
		</svg>
	);
}

function DocumentIcon({ className }: { className?: string }) {
	return (
		<svg
			className={className}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
			<polyline points="14 2 14 8 20 8" />
			<line x1="16" x2="8" y1="13" y2="13" />
			<line x1="16" x2="8" y1="17" y2="17" />
			<line x1="10" x2="8" y1="9" y2="9" />
		</svg>
	);
}

function QuickNoteIcon({ className }: { className?: string }) {
	return (
		<svg
			className={className}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
			<polyline points="14 2 14 8 20 8" />
			<line x1="16" x2="8" y1="13" y2="13" />
			<line x1="16" x2="8" y1="17" y2="17" />
		</svg>
	);
}

function WebEmbedIcon({ className }: { className?: string }) {
	return (
		<svg
			className={className}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<rect width="20" height="14" x="2" y="3" rx="2" />
			<line x1="8" x2="16" y1="21" y2="21" />
			<line x1="12" x2="12" y1="17" y2="21" />
			<path d="M12 7v6" />
			<path d="M9 10l3-3 3 3" />
		</svg>
	);
}
