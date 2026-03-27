import type { ReactNode } from 'react';

export type ClassValue = string | number | boolean | undefined | null | Record<string, boolean> | ClassValue[];

/**
 * Simple utility for conditionally joining class names.
 * Replaces clsx/cn for internal shell components.
 */
export function cn(...inputs: ClassValue[]): string {
	const classes: string[] = [];

	for (const input of inputs) {
		if (!input) continue;

		if (typeof input === 'string' || typeof input === 'number') {
			classes.push(String(input));
		} else if (typeof input === 'object') {
			if (Array.isArray(input)) {
				classes.push(cn(...input));
			} else {
				for (const [key, value] of Object.entries(input)) {
					if (value) classes.push(key);
				}
			}
		}
	}

	return classes.join(' ');
}

/**
 * Type for icon components
 */
export type IconComponent = () => ReactNode;
