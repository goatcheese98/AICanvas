import type { SvgPoint } from './points';

export type SvgMatrix = [number, number, number, number, number, number];

export const IDENTITY_MATRIX: SvgMatrix = [1, 0, 0, 1, 0, 0];

export function multiplySvgMatrices(a: SvgMatrix, b: SvgMatrix): SvgMatrix {
	return [
		a[0] * b[0] + a[2] * b[1],
		a[1] * b[0] + a[3] * b[1],
		a[0] * b[2] + a[2] * b[3],
		a[1] * b[2] + a[3] * b[3],
		a[0] * b[4] + a[2] * b[5] + a[4],
		a[1] * b[4] + a[3] * b[5] + a[5],
	];
}

export function applySvgMatrix(point: SvgPoint, matrix: SvgMatrix): SvgPoint {
	return {
		x: point.x * matrix[0] + point.y * matrix[2] + matrix[4],
		y: point.x * matrix[1] + point.y * matrix[3] + matrix[5],
	};
}

export function parseSvgTransform(transform: string | null | undefined): SvgMatrix {
	if (!transform) {
		return IDENTITY_MATRIX;
	}

	const entries = transform.match(/[a-zA-Z]+\([^)]*\)/g) ?? [];
	let current = IDENTITY_MATRIX;

	for (const entry of entries) {
		const nameMatch = entry.match(/^([a-zA-Z]+)\(([^)]*)\)$/);
		if (!nameMatch) {
			continue;
		}

		const name = nameMatch[1].toLowerCase();
		const rawArgs = nameMatch[2]
			.split(/[\s,]+/)
			.map((part) => part.trim())
			.filter(Boolean)
			.map((part) => Number(part));
		let next = IDENTITY_MATRIX;

		switch (name) {
			case 'matrix':
				if (rawArgs.length >= 6) {
					next = [rawArgs[0], rawArgs[1], rawArgs[2], rawArgs[3], rawArgs[4], rawArgs[5]];
				}
				break;
			case 'translate':
				next = [1, 0, 0, 1, rawArgs[0] ?? 0, rawArgs[1] ?? 0];
				break;
			case 'scale':
				next = [rawArgs[0] ?? 1, 0, 0, rawArgs[1] ?? rawArgs[0] ?? 1, 0, 0];
				break;
			case 'rotate': {
				const angle = ((rawArgs[0] ?? 0) * Math.PI) / 180;
				const cos = Math.cos(angle);
				const sin = Math.sin(angle);
				if (rawArgs.length >= 3) {
					const [_, cx, cy] = rawArgs;
					next = multiplySvgMatrices(
						multiplySvgMatrices([1, 0, 0, 1, cx, cy], [cos, sin, -sin, cos, 0, 0]),
						[1, 0, 0, 1, -cx, -cy],
					);
				} else {
					next = [cos, sin, -sin, cos, 0, 0];
				}
				break;
			}
			case 'skewx': {
				const angle = ((rawArgs[0] ?? 0) * Math.PI) / 180;
				next = [1, 0, Math.tan(angle), 1, 0, 0];
				break;
			}
			case 'skewy': {
				const angle = ((rawArgs[0] ?? 0) * Math.PI) / 180;
				next = [1, Math.tan(angle), 0, 1, 0, 0];
				break;
			}
		}

		current = multiplySvgMatrices(current, next);
	}

	return current;
}
