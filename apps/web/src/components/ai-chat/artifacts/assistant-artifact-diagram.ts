import type { AssistantArtifact } from '@ai-canvas/shared/types';
import { extractCodeBlock, normalizeLineEndings } from './assistant-artifact-text';

interface DiagramArtifactSource {
	language: 'mermaid' | 'd2';
	code: string;
}

function normalizeDiagramCode(code: string): string {
	return normalizeLineEndings(code)
		.split('\n')
		.map((line) => line.trimEnd())
		.join('\n')
		.trim();
}

export function getDiagramArtifactSource(
	artifact: AssistantArtifact,
): DiagramArtifactSource | null {
	if (artifact.type === 'mermaid' || artifact.type === 'd2') {
		return {
			language: artifact.type,
			code: normalizeDiagramCode(artifact.content),
		};
	}

	if (artifact.type !== 'markdown') {
		return null;
	}

	const mermaidCode = extractCodeBlock(artifact.content, 'mermaid');
	if (mermaidCode) {
		return {
			language: 'mermaid',
			code: normalizeDiagramCode(mermaidCode),
		};
	}

	const d2Code = extractCodeBlock(artifact.content, 'd2');
	if (d2Code) {
		return {
			language: 'd2',
			code: normalizeDiagramCode(d2Code),
		};
	}

	return null;
}

export function filterVisibleArtifacts(artifacts: AssistantArtifact[]): AssistantArtifact[] {
	const nativeDiagramLanguages = new Set(
		artifacts.flatMap((artifact) =>
			artifact.type === 'mermaid' || artifact.type === 'd2' ? [artifact.type] : [],
		),
	);
	const nativeDiagramKeys = new Set(
		artifacts.flatMap((artifact) => {
			if (artifact.type !== 'mermaid' && artifact.type !== 'd2') {
				return [];
			}

			const diagram = getDiagramArtifactSource(artifact);
			return diagram ? [`${diagram.language}:${diagram.code}`] : [];
		}),
	);
	const seenDiagramKeys = new Set<string>();

	return artifacts.filter((artifact) => {
		if (artifact.type === 'layout-plan') {
			return false;
		}

		const diagram = getDiagramArtifactSource(artifact);
		if (!diagram) {
			return true;
		}

		const key = `${diagram.language}:${diagram.code}`;
		if (
			artifact.type === 'markdown' &&
			(nativeDiagramLanguages.has(diagram.language) || nativeDiagramKeys.has(key))
		) {
			return false;
		}

		if (seenDiagramKeys.has(key)) {
			return false;
		}

		seenDiagramKeys.add(key);
		return true;
	});
}
