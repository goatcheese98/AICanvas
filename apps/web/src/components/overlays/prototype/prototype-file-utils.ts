interface ValidatePrototypeStudioFilePathOptions {
	value: string;
	existingPaths: string[];
	currentPath?: string;
}

export function normalizePrototypeStudioFilePath(value: string) {
	const trimmed = value.trim();
	if (!trimmed) {
		return '';
	}

	const normalizedSlashes = trimmed.replaceAll('\\', '/').replace(/\/+/g, '/');
	const prefixedPath = normalizedSlashes.startsWith('/')
		? normalizedSlashes
		: `/${normalizedSlashes}`;

	if (prefixedPath === '/') {
		return prefixedPath;
	}

	return prefixedPath.replace(/\/$/, '');
}

export function validatePrototypeStudioFilePath({
	value,
	existingPaths,
	currentPath,
}: ValidatePrototypeStudioFilePathOptions) {
	const normalizedPath = normalizePrototypeStudioFilePath(value);

	if (!normalizedPath || normalizedPath === '/') {
		return 'Enter a file name.';
	}

	if (normalizedPath.includes('..')) {
		return 'Use a path inside this prototype project.';
	}

	if (!/\.[a-z0-9]+$/i.test(normalizedPath)) {
		return 'Include a file extension like .jsx, .css, or .json.';
	}

	if (normalizedPath !== currentPath && existingPaths.includes(normalizedPath)) {
		return 'A file with that name already exists.';
	}

	return null;
}
