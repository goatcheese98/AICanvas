interface BuildCanvasSafeImagePromptInput {
	request: string;
	mode: 'image' | 'sketch';
}

const BASE_COMPOSITION_RULES = [
	'Generate a single whiteboard-friendly visual asset for composition inside Excalidraw.',
	'MANDATORY composition rules:',
	'- use a square 1:1 composition',
	'- keep the subject centered and sized to occupy roughly 70-85% of the frame',
	'- preserve the full subject silhouette within the frame with no cropped edges',
];

const BASE_BACKGROUND_RULES = [
	'MANDATORY background rules:',
	'- solid pure white background (#FFFFFF)',
	'- no checkerboard pattern, no transparency grid, no paper texture',
	'- no crop marks, no corner markers, and no framing glyphs',
	'- no background objects, no room, no sky, and no scene dressing',
	'- no shadow plane, no glow halo, and no border frame',
	'- keep the subject isolated and centered with consistent white padding',
	'- avoid any artifact or residue touching the outer edges of the image',
];

const BASE_RENDER_RULES = [
	'MANDATORY rendering rules:',
	'- crisp silhouette and edges',
	'- high subject/background separation',
	'- avoid anti-aliased matte or fringe around subject edges',
	'- avoid noisy filler details, repetitive decorative microtextures, and incidental background motifs',
	'Do not include any signature, watermark, caption, label, or text.',
	'- output should still read clearly when scaled down on a canvas',
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
		lines.push('- use a clean whiteboard illustration style with strong contour separation');
		lines.push('- favor clearly segmentable filled regions over soft gradients');
		lines.push('- keep dark outer and inner contour lines continuous and readable');
		lines.push('- shapes should be suitable for later layered vector conversion into editable canvas elements');
		lines.push('- most visible regions should form contained shapes with readable boundaries');
	} else {
		lines.push('Image-specific rules:');
		lines.push('- deliver a clean standalone subject for direct canvas placement and later vectorization');
		lines.push('- keep empty white margins around the subject');
	}

	return lines.join('\n');
}
