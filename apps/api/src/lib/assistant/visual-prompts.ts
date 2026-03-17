interface BuildCanvasSafeImagePromptInput {
	request: string;
	mode: 'image' | 'sketch';
}

const BASE_COMPOSITION_RULES = [
	'Generate a visual asset for placement inside Excalidraw.',
	'MANDATORY composition rules:',
	'- keep the subject sized to occupy roughly 70-85% of the frame',
	'- preserve the full subject silhouette within the frame with no cropped edges',
	'- allow natural proportions — do not force a square or symmetrical composition',
];

const BASE_BACKGROUND_RULES = [
	'MANDATORY background rules:',
	'- solid pure white background (#FFFFFF)',
	'- no checkerboard pattern, no transparency grid, no paper texture',
	'- no crop marks, no corner markers, and no framing glyphs',
	'- no background objects, no room, no sky, and no scene dressing',
	'- no shadow plane, no glow halo, and no border frame',
	'- keep the subject isolated with consistent white padding',
	'- avoid any artifact or residue touching the outer edges of the image',
];

const BASE_RENDER_RULES = [
	'MANDATORY rendering rules:',
	'- crisp silhouette and edges with high subject/background separation',
	'- avoid anti-aliased matte or fringe around subject edges',
	'- avoid noisy filler details, repetitive decorative microtextures, and incidental background motifs',
	'- no signature, watermark, caption, label, or text',
	'- output should read clearly when scaled down on a canvas',
];

export function buildCanvasSafeImagePrompt(input: BuildCanvasSafeImagePromptInput): string {
	const lines = [
		...BASE_COMPOSITION_RULES,
		...BASE_BACKGROUND_RULES,
		...BASE_RENDER_RULES,
		`User request: ${input.request}`,
	];

	if (input.mode === 'sketch') {
		lines.push('Sketch-specific rules:');
		lines.push('- use a clean illustration style with flat or lightly shaded color regions — limited color palette of 3-6 colors is ideal');
		lines.push('- dark contour lines should be continuous, smooth, and flow naturally — avoid choppy or fragmented strokes');
		lines.push('- favor clearly defined, contained regions with readable boundaries for clean vector tracing');
		lines.push('- layer shapes naturally: background fills first, mid-ground details next, foreground outlines last');
		lines.push('- keep inner details (windows, wheels, stripes, labels) as distinct contained shapes rather than blended gradients');
		lines.push('- avoid excessive symmetry — allow natural organic variation in proportions');
	} else {
		lines.push('Image-specific rules:');
		lines.push('- deliver a clean standalone subject for direct canvas placement and later vectorization');
		lines.push('- keep empty white margins around the subject');
	}

	return lines.join('\n');
}
