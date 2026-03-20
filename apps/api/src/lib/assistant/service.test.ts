import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateAssistantResponse, resolveGenerationMode } from './service';

const originalFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = originalFetch;
	vi.restoreAllMocks();
});

describe('assistant service', () => {
	it('returns a chat response', async () => {
		const result = await generateAssistantResponse({
			message: 'help me scope this canvas',
			contextMode: 'all',
			generationMode: 'chat',
		});

		expect(result.message.role).toBe('assistant');
		expect(result.message.generationMode).toBe('chat');
		expect(result.message.content).toContain('whole-canvas');
	});

	it('returns reversible markdown patch artifacts for selected markdown edit requests', async () => {
		const result = await generateAssistantResponse({
			message:
				'I unfortunately do not have beef chuck or brisket. Can you adjust the list accordingly?',
			contextMode: 'selected',
			contextSnapshot: {
				canvasId: 'canvas-1',
				totalElementCount: 1,
				selectedElementIds: ['note-1'],
				selectedElementCount: 1,
				selectedOverlayTypes: ['markdown'],
				selectionSummary: [
					{
						id: 'note-1',
						elementType: 'rectangle',
						overlayType: 'markdown',
						label: 'Notes',
					},
				],
				selectedContexts: [
					{
						kind: 'markdown',
						id: 'note-1',
						priority: 1,
						elementType: 'rectangle',
						overlayType: 'markdown',
						label: 'Notes',
						markdown: {
							type: 'markdown',
							title: 'Notes',
							content: [
								'## Protein',
								'',
								'- [ ] Beef chuck',
								'- [ ] Brisket',
								'- [ ] Chicken thighs',
								'',
								'## Toppings',
								'',
								'- [ ] Jalapenos',
							].join('\n'),
						},
					},
				],
			},
		});

		const patch = JSON.parse(String(result.message.artifacts?.[0]?.content)) as {
			next: { content: string };
		};
		expect(result.message.artifacts?.[0]).toMatchObject({ type: 'markdown-patch' });
		expect(result.message.content).toContain('Prepared reversible selection edits.');
		expect(result.message.artifacts?.[0]?.content).toContain('"kind": "markdown_patch"');
		expect(patch.next.content).not.toContain('Beef chuck');
		expect(patch.next.content).not.toContain('Brisket');
		expect(patch.next.content).toContain('Chicken thighs');
	});

	it('removes a named markdown section instead of parroting the prompt', async () => {
		const result = await generateAssistantResponse({
			message: 'Great. Can you actually remove the protein section from the grocery list?',
			contextMode: 'selected',
			contextSnapshot: {
				canvasId: 'canvas-1',
				totalElementCount: 1,
				selectedElementIds: ['note-1'],
				selectedElementCount: 1,
				selectedOverlayTypes: ['markdown'],
				selectionSummary: [
					{
						id: 'note-1',
						elementType: 'rectangle',
						overlayType: 'markdown',
						label: 'Notes',
					},
				],
				selectedContexts: [
					{
						kind: 'markdown',
						id: 'note-1',
						priority: 1,
						elementType: 'rectangle',
						overlayType: 'markdown',
						label: 'Notes',
						markdown: {
							type: 'markdown',
							title: 'Notes',
							content: [
								'## Protein',
								'',
								'- [ ] Chicken thighs',
								'',
								'## Toppings',
								'',
								'- [ ] Jalapenos',
							].join('\n'),
						},
					},
				],
			},
		});

		const patch = JSON.parse(String(result.message.artifacts?.[0]?.content)) as {
			next: { content: string };
		};
		expect(patch.next.content).not.toContain('## Protein');
		expect(patch.next.content).toContain('## Toppings');
		expect(patch.next.content).not.toContain('Great. Can you actually remove');
	});

	it('uses Anthropic to rewrite selected markdown when a valid full document is returned', async () => {
		const fetchMock = vi.fn(
			async () =>
				new Response(
					JSON.stringify({
						content: [
							{
								type: 'text',
								text: ['```markdown', '## Toppings', '', '- [ ] Jalapenos', '```'].join('\n'),
							},
						],
					}),
					{ status: 200, headers: { 'Content-Type': 'application/json' } },
				),
		);
		globalThis.fetch = fetchMock as typeof fetch;

		const result = await generateAssistantResponse({
			message: 'remove the protein section',
			contextMode: 'selected',
			contextSnapshot: {
				canvasId: 'canvas-1',
				totalElementCount: 1,
				selectedElementIds: ['note-1'],
				selectedElementCount: 1,
				selectedOverlayTypes: ['markdown'],
				selectionSummary: [
					{
						id: 'note-1',
						elementType: 'rectangle',
						overlayType: 'markdown',
						label: 'Notes',
					},
				],
				selectedContexts: [
					{
						kind: 'markdown',
						id: 'note-1',
						priority: 1,
						elementType: 'rectangle',
						overlayType: 'markdown',
						label: 'Notes',
						markdown: {
							type: 'markdown',
							title: 'Notes',
							content: [
								'## Protein',
								'',
								'- [ ] Chicken thighs',
								'',
								'## Toppings',
								'',
								'- [ ] Jalapenos',
							].join('\n'),
						},
					},
				],
			},
			bindings: {
				DB: {} as D1Database,
				R2: {} as R2Bucket,
				CLERK_SECRET_KEY: 'clerk',
				ANTHROPIC_API_KEY: 'anthropic',
				ENVIRONMENT: 'test',
			},
		});

		const patch = JSON.parse(String(result.message.artifacts?.[0]?.content)) as {
			next: { content: string };
		};
		expect(patch.next.content).toBe('## Toppings\n\n- [ ] Jalapenos');
		expect(result.message.artifacts?.[0]?.content).toContain('Rewrites the selected markdown note');
	});

	it('falls back from Anthropic markdown rewrite when the model parrots the prompt', async () => {
		const fetchMock = vi.fn(
			async () =>
				new Response(
					JSON.stringify({
						content: [
							{
								type: 'text',
								text: [
									'```markdown',
									'- Great. Can you actually remove the protein section from the grocery list?',
									'```',
								].join('\n'),
							},
						],
					}),
					{ status: 200, headers: { 'Content-Type': 'application/json' } },
				),
		);
		globalThis.fetch = fetchMock as typeof fetch;

		const result = await generateAssistantResponse({
			message: 'Great. Can you actually remove the protein section from the grocery list?',
			contextMode: 'selected',
			contextSnapshot: {
				canvasId: 'canvas-1',
				totalElementCount: 1,
				selectedElementIds: ['note-1'],
				selectedElementCount: 1,
				selectedOverlayTypes: ['markdown'],
				selectionSummary: [
					{
						id: 'note-1',
						elementType: 'rectangle',
						overlayType: 'markdown',
						label: 'Notes',
					},
				],
				selectedContexts: [
					{
						kind: 'markdown',
						id: 'note-1',
						priority: 1,
						elementType: 'rectangle',
						overlayType: 'markdown',
						label: 'Notes',
						markdown: {
							type: 'markdown',
							title: 'Notes',
							content: [
								'## Protein',
								'',
								'- [ ] Chicken thighs',
								'',
								'## Toppings',
								'',
								'- [ ] Jalapenos',
							].join('\n'),
						},
					},
				],
			},
			bindings: {
				DB: {} as D1Database,
				R2: {} as R2Bucket,
				CLERK_SECRET_KEY: 'clerk',
				ANTHROPIC_API_KEY: 'anthropic',
				ENVIRONMENT: 'test',
			},
		});

		const patch = JSON.parse(String(result.message.artifacts?.[0]?.content)) as {
			next: { content: string };
		};
		expect(patch.next.content).toContain('## Toppings');
		expect(patch.next.content).not.toContain('Great. Can you actually remove');
	});

	it('returns reversible kanban patch artifacts for selected kanban edit requests', async () => {
		const result = await generateAssistantResponse({
			message: 'add a QA follow-up task',
			contextMode: 'selected',
			generationMode: 'kanban',
			contextSnapshot: {
				canvasId: 'canvas-1',
				totalElementCount: 1,
				selectedElementIds: ['board-1'],
				selectedElementCount: 1,
				selectedOverlayTypes: ['kanban'],
				selectionSummary: [
					{
						id: 'board-1',
						elementType: 'rectangle',
						overlayType: 'kanban',
						label: 'Launch board',
					},
				],
				selectedContexts: [
					{
						kind: 'kanban',
						id: 'board-1',
						priority: 2,
						elementType: 'rectangle',
						overlayType: 'kanban',
						label: 'Launch board',
						kanban: {
							type: 'kanban',
							title: 'Launch board',
							columns: [{ id: 'todo', title: 'To Do', cards: [] }],
							bgTheme: 'parchment',
							fontId: 'excalifont',
							fontSize: 13,
						},
						kanbanSummary: {
							title: 'Launch board',
							columnCount: 1,
							cardCount: 0,
							emptyColumnCount: 1,
							cardsWithDescriptions: 0,
							overdueCardCount: 0,
							completedChecklistItemCount: 0,
							totalChecklistItemCount: 0,
							priorityCounts: { low: 0, medium: 0, high: 0 },
							labels: [],
							columns: [{ id: 'todo', title: 'To Do', cardCount: 0, cards: [] }],
						},
					},
				],
			},
		});

		expect(result.message.generationMode).toBe('kanban');
		expect(result.message.artifacts?.[0]).toMatchObject({ type: 'kanban-patch' });
		expect(result.message.artifacts?.[0]?.content).toContain('"kind": "kanban_patch"');
	});

	it('returns Mermaid artifacts for Mermaid mode', async () => {
		const result = await generateAssistantResponse({
			message: 'design auth flow',
			contextMode: 'selected',
			generationMode: 'mermaid',
		});

		expect(result.message.artifacts?.[0]).toMatchObject({ type: 'mermaid' });
		expect(result.message.content).toContain('```mermaid');
	});

	it('returns D2 artifacts for d2 mode', async () => {
		const result = await generateAssistantResponse({
			message: 'service dependencies',
			contextMode: 'all',
			generationMode: 'd2',
		});

		expect(result.message.artifacts?.[0]).toMatchObject({ type: 'd2' });
		expect(result.message.content).toContain('```d2');
	});

	it('returns kanban operations for kanban mode', async () => {
		const result = await generateAssistantResponse({
			message: 'plan launch tasks',
			contextMode: 'all',
			generationMode: 'kanban',
		});

		expect(result.message.artifacts?.[0]).toMatchObject({ type: 'kanban-ops' });
		expect(result.message.content).toContain('```json');
	});

	it('returns a loud failure message when prototype mode has no AI payload', async () => {
		const result = await generateAssistantResponse({
			message: 'build a prototype landing page for prompt workflows',
			contextMode: 'selected',
			generationMode: 'prototype',
		});

		expect(result.message.generationMode).toBe('prototype');
		expect(result.message.artifacts).toEqual([]);
		expect(result.message.content).toContain('Prototype generation requires a valid AI-authored');
	});

	it('passes through valid Anthropic prototype files', async () => {
		const fetchMock = vi.fn(
			async () =>
				new Response(
					JSON.stringify({
						content: [
							{
								type: 'text',
								text: [
									'```json',
									JSON.stringify(
										{
											title: 'PromptVault Landing',
											template: 'react',
											activeFile: '/App.jsx',
											files: {
												'/index.jsx': {
													code: "import { createRoot } from 'react-dom/client';",
													hidden: true,
												},
												'/App.jsx': {
													code: 'export default function App() { return <main>PromptVault</main>; }',
												},
												'/styles.css': { code: 'main { color: #111827; }' },
											},
										},
										null,
										2,
									),
									'```',
								].join('\n'),
							},
						],
					}),
					{ status: 200, headers: { 'Content-Type': 'application/json' } },
				),
		);
		globalThis.fetch = fetchMock as typeof fetch;

		const result = await generateAssistantResponse({
			message: 'build a prototype landing page for prompt workflows',
			contextMode: 'selected',
			generationMode: 'prototype',
			bindings: {
				DB: {} as D1Database,
				R2: {} as R2Bucket,
				CLERK_SECRET_KEY: 'clerk',
				ANTHROPIC_API_KEY: 'anthropic',
				ENVIRONMENT: 'test',
			},
		});

		expect(result.message.artifacts?.[0]).toMatchObject({ type: 'prototype-files' });
		expect(result.message.content).toContain('Prepared prototype files');
		expect(result.message.artifacts?.[0]?.content).toContain('PromptVault Landing');
		expect(result.message.artifacts?.[0]?.content).toContain('/index.jsx');
		expect(result.message.artifacts?.[0]?.content).toContain('PromptVault');
	});

	it('repairs invalid prototype output on a follow-up attempt', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						content: [
							{
								type: 'text',
								text: [
									'```json',
									JSON.stringify(
										{
											title: 'Prototype',
											template: 'react',
											activeFile: '/App.jsx',
											files: {
												'/App.jsx': {
													code: 'export default function App() { return <main>Broken first pass</main>; }',
												},
											},
										},
										null,
										2,
									),
									'```',
								].join('\n'),
							},
						],
					}),
					{ status: 200, headers: { 'Content-Type': 'application/json' } },
				),
			)
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						content: [
							{
								type: 'text',
								text: [
									'```json',
									JSON.stringify(
										{
											title: 'Prototype',
											template: 'react',
											activeFile: '/App.jsx',
											files: {
												'/index.jsx': {
													code: "import { createRoot } from 'react-dom/client';",
													hidden: true,
												},
												'/App.jsx': {
													code: 'export default function App() { return <main>Recovered second pass</main>; }',
												},
											},
										},
										null,
										2,
									),
									'```',
								].join('\n'),
							},
						],
					}),
					{ status: 200, headers: { 'Content-Type': 'application/json' } },
				),
			);
		globalThis.fetch = fetchMock as typeof fetch;

		const result = await generateAssistantResponse({
			message: 'build a prototype landing page for prompt workflows',
			contextMode: 'selected',
			generationMode: 'prototype',
			bindings: {
				DB: {} as D1Database,
				R2: {} as R2Bucket,
				CLERK_SECRET_KEY: 'clerk',
				ANTHROPIC_API_KEY: 'anthropic',
				ENVIRONMENT: 'test',
			},
		});

		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(result.message.artifacts?.[0]).toMatchObject({ type: 'prototype-files' });
		expect(result.message.content).toContain('Validation passes: 2');
		expect(result.message.artifacts?.[0]?.content).toContain('Recovered second pass');
	});

	it('returns updated prototype files for selected prototype edit requests', async () => {
		const fetchMock = vi.fn(
			async () =>
				new Response(
					JSON.stringify({
						content: [
							{
								type: 'text',
								text: [
									'```json',
									JSON.stringify(
										{
											title: 'Tetris Game',
											template: 'react',
											activeFile: '/App.jsx',
											files: {
												'/index.jsx': {
													code: "import { createRoot } from 'react-dom/client';",
													hidden: true,
												},
												'/App.jsx': {
													code: 'export default function App() { return <main>Updated game-board</main>; }',
												},
												'/styles.css': { code: 'body { margin: 0; }' },
											},
										},
										null,
										2,
									),
									'```',
								].join('\n'),
							},
						],
					}),
					{ status: 200, headers: { 'Content-Type': 'application/json' } },
				),
		);
		globalThis.fetch = fetchMock as typeof fetch;

		const result = await generateAssistantResponse({
			message: 'Can you actually turn this into an actual working demo?',
			generationMode: 'prototype',
			contextMode: 'selected',
			prototypeContext: {
				type: 'prototype',
				title: 'Tetris Game',
				template: 'react',
				activeFile: '/App.jsx',
				files: {
					'/index.jsx': {
						code: "import { createRoot } from 'react-dom/client';",
						hidden: true,
					},
					'/App.jsx': {
						code: 'export default function App() { return <main>Original game-board</main>; }',
					},
					'/styles.css': { code: 'body { margin: 0; }' },
				},
			},
			contextSnapshot: {
				canvasId: 'canvas-1',
				totalElementCount: 1,
				selectedElementIds: ['prototype-1'],
				selectedElementCount: 1,
				selectedOverlayTypes: ['prototype'],
				selectionSummary: [
					{
						id: 'prototype-1',
						elementType: 'rectangle',
						overlayType: 'prototype',
						label: 'Tetris Game',
					},
				],
				selectedContexts: [
					{
						kind: 'prototype',
						id: 'prototype-1',
						priority: 1,
						elementType: 'rectangle',
						overlayType: 'prototype',
						label: 'Tetris Game',
						prototype: {
							title: 'Tetris Game',
							template: 'react',
							activeFile: '/App.jsx',
							filePaths: ['/App.jsx', '/index.jsx', '/styles.css'],
							dependencies: [],
						},
					},
				],
			},
			bindings: {
				DB: {} as D1Database,
				R2: {} as R2Bucket,
				CLERK_SECRET_KEY: 'clerk',
				ANTHROPIC_API_KEY: 'anthropic',
				ENVIRONMENT: 'test',
			},
		});

		expect(result.message.generationMode).toBe('prototype');
		expect(result.message.content).toContain('Prepared prototype files');
		expect(result.message.artifacts?.[0]).toMatchObject({ type: 'prototype-files' });
		expect(result.message.artifacts?.[0]?.content).toContain('"title": "Tetris Game"');
		expect(result.message.artifacts?.[0]?.content).toContain('Updated game-board');
	});

	it('infers a structured mode from a freeform request', async () => {
		expect(
			resolveGenerationMode({
				message: 'turn this selection into kanban tasks',
				contextMode: 'selected',
			}),
		).toBe('kanban');

		expect(
			resolveGenerationMode({
				message: 'build a prototype dashboard for this canvas',
				contextMode: 'selected',
			}),
		).toBe('prototype');

		expect(
			resolveGenerationMode({
				message: 'Create the propotype in Vanilla',
				contextMode: 'selected',
				prototypeContext: {
					type: 'prototype',
					title: 'Prototype',
					template: 'react',
					files: {},
					activeFile: '/App.jsx',
				},
			}),
		).toBe('prototype');

			expect(
				resolveGenerationMode({
					message: 'Can you rebuild this into an actual working demo?',
					contextMode: 'selected',
					prototypeContext: {
						type: 'prototype',
					title: 'Tetris Game',
					template: 'react',
					files: {},
					activeFile: '/App.jsx',
				},
			}),
		).toBe('prototype');

		expect(
			resolveGenerationMode({
				message: 'Can you create an image of a beautiful landing page?',
				contextMode: 'selected',
			}),
		).toBe('image');

		expect(
			resolveGenerationMode({
				message: 'Create a vectorizable mascot logo for this idea',
				contextMode: 'selected',
			}),
		).toBe('svg');

		expect(
			resolveGenerationMode({
				message: 'creat an image of dog',
				contextMode: 'selected',
			}),
		).toBe('image');

		const result = await generateAssistantResponse({
			message: 'diagram the auth flow for this canvas',
			contextMode: 'all',
		});

		expect(result.message.generationMode).toBe('mermaid');
		expect(result.message.content).toContain('```mermaid');
	});

	it('inherits the last diagram mode for follow-up edit requests', () => {
		expect(
			resolveGenerationMode({
				message: 'One of the arrows seems to be facing in a weird direction. Please fix.',
				contextMode: 'selected',
				history: [
					{
						id: 'assistant-1',
						role: 'assistant',
						content: '```d2\na -> b\n```',
						generationMode: 'd2',
						artifacts: [{ type: 'd2', content: 'a -> b' }],
						createdAt: new Date().toISOString(),
					},
				],
			}),
		).toBe('d2');
	});

	it('keeps image follow-ups on the image generation path', () => {
		expect(
			resolveGenerationMode({
				message: 'I would like there to be a better background for this',
				contextMode: 'selected',
				history: [
					{
						id: 'assistant-image-1',
						role: 'assistant',
						content: 'Generated image preview',
						generationMode: 'image',
						artifacts: [
							{
								type: 'image',
								content: JSON.stringify({
									kind: 'stored_asset',
									r2Key: 'assistant-assets/run-1/pelican.png',
									mimeType: 'image/png',
									provider: 'cloudflare',
									prompt:
										'Create a polished image for: Can you create an image of a pelican riding a bicycle?',
								}),
							},
						],
						createdAt: new Date().toISOString(),
					},
				],
			}),
		).toBe('image');

		expect(
			resolveGenerationMode({
				message: "Let's do it with a beach boardwalk combo.",
				contextMode: 'selected',
				history: [
					{
						id: 'assistant-image-1',
						role: 'assistant',
						content: 'Generated image preview',
						generationMode: 'image',
						artifacts: [
							{
								type: 'image',
								content: JSON.stringify({
									kind: 'stored_asset',
									r2Key: 'assistant-assets/run-1/pelican.png',
									mimeType: 'image/png',
									provider: 'cloudflare',
									prompt:
										'Create a polished image for: Can you create an image of a pelican riding a bicycle?',
								}),
							},
						],
						createdAt: new Date().toISOString(),
					},
				],
			}),
		).toBe('image');
	});

	it('keeps svg follow-ups on the svg path', () => {
		expect(
			resolveGenerationMode({
				message: 'make the ears bigger and simplify the shapes',
				contextMode: 'selected',
				history: [
					{
						id: 'assistant-svg-1',
						role: 'assistant',
						content: [
							'Prepared an SVG illustration draft.',
							'',
							'```svg',
							'<svg></svg>',
							'```',
						].join('\n'),
						generationMode: 'svg',
						createdAt: new Date().toISOString(),
					},
				],
			}),
		).toBe('svg');
	});

	it('builds diagram edit prompts from the previous diagram source', async () => {
		const fetchMock = vi.fn(
			async () =>
				new Response(
					JSON.stringify({
						content: [
							{
								type: 'text',
								text: '```d2\na -> c\n```',
							},
						],
					}),
					{ status: 200, headers: { 'Content-Type': 'application/json' } },
				),
		);
		globalThis.fetch = fetchMock as typeof fetch;

		const result = await generateAssistantResponse({
			message: 'Okay, can you render it?',
			contextMode: 'selected',
			history: [
				{
					id: 'assistant-1',
					role: 'assistant',
					content: 'Generated a D2 diagram draft:\n\n```d2\na -> b\n```',
					generationMode: 'd2',
					artifacts: [{ type: 'd2', content: 'a -> b' }],
					createdAt: new Date().toISOString(),
				},
			],
			bindings: {
				DB: {} as D1Database,
				R2: {} as R2Bucket,
				CLERK_SECRET_KEY: 'clerk',
				ANTHROPIC_API_KEY: 'anthropic',
				ENVIRONMENT: 'test',
			},
		});

		expect(result.message.generationMode).toBe('d2');
		expect(result.message.artifacts?.[0]).toMatchObject({ type: 'd2', content: 'a -> c' });

		const init = (fetchMock.mock.calls.at(0) as unknown[] | undefined)?.at(1) as
			| RequestInit
			| undefined;
		const body = JSON.parse(String(init?.body));
		expect(body.messages.at(-1)?.content).toContain('Current D2 source:');
		expect(body.messages.at(-1)?.content).toContain('The app renders D2 directly.');
		expect(body.messages.at(-1)?.content).not.toContain('D2 Online Editor');
	});

	it('uses Anthropic for chat mode when bindings are configured', async () => {
		const fetchMock = vi.fn(
			async () =>
				new Response(
					JSON.stringify({
						content: [
							{
								type: 'text',
								text: 'This is an Anthropic-generated response.',
							},
						],
					}),
					{ status: 200, headers: { 'Content-Type': 'application/json' } },
				),
		);
		globalThis.fetch = fetchMock as typeof fetch;

		const result = await generateAssistantResponse({
			message: 'help me scope this canvas',
			contextMode: 'all',
			generationMode: 'chat',
			bindings: {
				DB: {} as D1Database,
				R2: {} as R2Bucket,
				CLERK_SECRET_KEY: 'clerk',
				ANTHROPIC_API_KEY: 'anthropic',
				ENVIRONMENT: 'test',
			},
		});

		expect(result.message.content).toBe('This is an Anthropic-generated response.');
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('passes recent conversation history to Anthropic', async () => {
		const fetchMock = vi.fn(
			async () =>
				new Response(
					JSON.stringify({
						content: [
							{
								type: 'text',
								text: 'Follow-up response.',
							},
						],
					}),
					{ status: 200, headers: { 'Content-Type': 'application/json' } },
				),
		);
		globalThis.fetch = fetchMock as typeof fetch;

		await generateAssistantResponse({
			message: 'Continue from the earlier response',
			contextMode: 'none',
			generationMode: 'chat',
			history: [
				{
					id: 'user-1',
					role: 'user',
					content: 'Draft a resume summary',
					createdAt: new Date().toISOString(),
				},
				{
					id: 'assistant-1',
					role: 'assistant',
					content: 'Here is the earlier response.',
					createdAt: new Date().toISOString(),
				},
			],
			bindings: {
				DB: {} as D1Database,
				R2: {} as R2Bucket,
				CLERK_SECRET_KEY: 'clerk',
				ANTHROPIC_API_KEY: 'anthropic',
				ENVIRONMENT: 'test',
			},
		});

		const init = (fetchMock.mock.calls.at(0) as unknown[] | undefined)?.at(1) as
			| RequestInit
			| undefined;
		expect(JSON.parse(String(init?.body))).toMatchObject({
			messages: [
				{ role: 'user', content: 'Draft a resume summary' },
				{ role: 'assistant', content: 'Here is the earlier response.' },
				{ role: 'user', content: 'Continue from the earlier response' },
			],
		});
	});

	it('returns a loud failure message when Anthropic returns an incomplete prototype payload', async () => {
		const fetchMock = vi.fn(
			async () =>
				new Response(
					JSON.stringify({
						content: [
							{
								type: 'text',
								text: [
									'```json',
									JSON.stringify(
										{
											title: 'Incomplete Prototype',
											template: 'react',
											files: {
												'/App.jsx': {
													code: 'export default function App() { return <main>Broken</main>; }',
												},
											},
										},
										null,
										2,
									),
									'```',
								].join('\n'),
							},
						],
					}),
					{ status: 200, headers: { 'Content-Type': 'application/json' } },
				),
		);
		globalThis.fetch = fetchMock as typeof fetch;

		const result = await generateAssistantResponse({
			message: 'Create a prototype calculator app',
			contextMode: 'selected',
			generationMode: 'prototype',
			bindings: {
				DB: {} as D1Database,
				R2: {} as R2Bucket,
				CLERK_SECRET_KEY: 'clerk',
				ANTHROPIC_API_KEY: 'anthropic',
				ENVIRONMENT: 'test',
			},
		});

		expect(fetchMock).toHaveBeenCalledTimes(3);
		expect(result.message.artifacts).toEqual([]);
		expect(result.message.content).toContain('Prototype generation failed validation after 3 attempts.');
		expect(result.message.content).toContain('Missing prototype entry file /index.jsx.');
	});
});
