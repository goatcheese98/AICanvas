import { useEffect, useMemo, useState } from 'react';
import { normalizePrototypeOverlay } from '@ai-canvas/shared/schemas';
import type { PrototypeOverlayCustomData } from '@ai-canvas/shared/types';
import { PrototypeCodeEditor } from './PrototypeCodeEditor';
import { applyPrototypeStudioCommand, listPrototypeFiles } from './prototype-control';
import {
	normalizePrototypeStudioFilePath,
	validatePrototypeStudioFilePath,
} from './prototype-file-utils';
import { usePrototypePreview } from './prototype-preview-runtime';
import { serializePrototypeState } from './prototype-utils';

function getFileLabel(path: string) {
	if (path.endsWith('.css')) return '#';
	if (
		path.endsWith('.js') ||
		path.endsWith('.jsx') ||
		path.endsWith('.ts') ||
		path.endsWith('.tsx')
	) {
		return '<>';
	}
	if (path.endsWith('.json')) return '{}';
	return '•';
}

function PreviewStatusBadge({
	status,
}: {
	status: 'idle' | 'compiling' | 'running' | 'ready' | 'error';
}) {
	const label =
		status === 'compiling'
			? 'Compiling'
			: status === 'running'
				? 'Loading'
				: status === 'ready'
					? 'Ready'
					: status === 'error'
						? 'Needs attention'
						: 'Idle';
	const tone =
		status === 'ready'
			? 'border-emerald-200 bg-emerald-50 text-emerald-700'
			: status === 'error'
				? 'border-rose-200 bg-rose-50 text-rose-700'
				: 'border-stone-200 bg-stone-50 text-stone-600';

	return (
		<div
			className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${tone}`}
		>
			{label}
		</div>
	);
}

interface PrototypeStudioEditorProps {
	value: PrototypeOverlayCustomData;
	onChange: (nextValue: PrototypeOverlayCustomData) => void;
}

export function PrototypeStudioEditor({ value, onChange }: PrototypeStudioEditorProps) {
	const normalizedValue = useMemo(() => normalizePrototypeOverlay(value), [value]);
	const normalizedSignature = useMemo(
		() => serializePrototypeState(normalizedValue),
		[normalizedValue],
	);
	const [draft, setDraft] = useState<PrototypeOverlayCustomData>(normalizedValue);
	const [showHiddenFiles, setShowHiddenFiles] = useState(false);
	const [fileAction, setFileAction] = useState<'create' | 'rename' | null>(null);
	const [filePathInput, setFilePathInput] = useState('');
	const [fileActionError, setFileActionError] = useState<string | null>(null);
	const [confirmDeletePath, setConfirmDeletePath] = useState<string | null>(null);
	const draftSignature = useMemo(() => serializePrototypeState(draft), [draft]);

	useEffect(() => {
		if (draftSignature === normalizedSignature) {
			return;
		}

		setDraft(normalizedValue);
	}, [draftSignature, normalizedSignature, normalizedValue]);

	const allFiles = useMemo(() => listPrototypeFiles(draft, { includeHidden: true }), [draft]);
	const visibleFiles = useMemo(
		() => listPrototypeFiles(draft, { includeHidden: showHiddenFiles }),
		[draft, showHiddenFiles],
	);
	const hiddenFileCount = allFiles.filter((path) => draft.files[path]?.hidden).length;
	const activeFilePath = visibleFiles.includes(draft.activeFile ?? '')
		? (draft.activeFile ?? visibleFiles[0])
		: visibleFiles[0];
	const activeFile = activeFilePath ? draft.files[activeFilePath] : undefined;
	const preview = usePrototypePreview(draft);

	const applyDraft = (nextValue: PrototypeOverlayCustomData) => {
		if (serializePrototypeState(nextValue) === draftSignature) {
			return;
		}

		setDraft(nextValue);
		onChange(nextValue);
	};

	const cancelFileAction = () => {
		setFileAction(null);
		setFileActionError(null);
		setFilePathInput('');
	};

	const startCreateFile = () => {
		setConfirmDeletePath(null);
		setFileAction('create');
		setFilePathInput('');
		setFileActionError(null);
	};

	const startRenameFile = () => {
		if (!activeFilePath || activeFile?.readOnly) {
			return;
		}

		setConfirmDeletePath(null);
		setFileAction('rename');
		setFilePathInput(activeFilePath);
		setFileActionError(null);
	};

	const submitCreateFile = () => {
		const validationError = validatePrototypeStudioFilePath({
			value: filePathInput,
			existingPaths: allFiles,
		});

		if (validationError) {
			setFileActionError(validationError);
			return;
		}

		const nextPath = normalizePrototypeStudioFilePath(filePathInput);
		applyDraft(
			applyPrototypeStudioCommand(draft, {
				type: 'create_file',
				path: nextPath,
				activate: true,
			}),
		);
		cancelFileAction();
	};

	const submitRenameFile = () => {
		if (!activeFilePath || activeFile?.readOnly) {
			return;
		}

		const validationError = validatePrototypeStudioFilePath({
			value: filePathInput,
			existingPaths: allFiles,
			currentPath: activeFilePath,
		});

		if (validationError) {
			setFileActionError(validationError);
			return;
		}

		applyDraft(
			applyPrototypeStudioCommand(draft, {
				type: 'rename_file',
				from: activeFilePath,
				to: normalizePrototypeStudioFilePath(filePathInput),
			}),
		);
		cancelFileAction();
	};

	const deleteActiveFile = () => {
		if (!activeFilePath || activeFile?.readOnly) {
			return;
		}

		applyDraft(
			applyPrototypeStudioCommand(draft, {
				type: 'delete_file',
				path: activeFilePath,
			}),
		);
		setConfirmDeletePath(null);
		cancelFileAction();
	};

	return (
		<div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[24px] border border-stone-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
			<div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 bg-stone-50/90 px-4 py-3">
				<input
					value={draft.title}
					onChange={(event) =>
						applyDraft(
							applyPrototypeStudioCommand(draft, {
								type: 'set_title',
								title: event.target.value,
							}),
						)
					}
					className="min-w-0 flex-1 rounded-full border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-900 outline-none"
					placeholder="Prototype title"
				/>
				<div className="flex items-center gap-2">
					<div className="rounded-full border border-stone-300 bg-white px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">
						{draft.template}
					</div>
					<PreviewStatusBadge status={preview.status} />
					<button
						type="button"
						onClick={preview.refresh}
						className="rounded-full border border-stone-300 bg-white px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-600"
					>
						Refresh
					</button>
				</div>
			</div>

			<div className="min-h-0 flex-1 bg-[linear-gradient(180deg,rgba(250,250,249,0.9),rgba(245,245,244,0.55))] p-3 sm:p-4">
				<div className="grid h-full min-h-0 gap-3 lg:grid-cols-[minmax(620px,54%)_minmax(0,1fr)]">
					<div className="grid min-h-[620px] min-w-0 overflow-hidden rounded-[22px] border border-stone-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.06)] lg:grid-cols-[172px_minmax(0,1fr)]">
						<div className="min-h-0 border-b border-stone-200 bg-stone-50/85 lg:border-b-0 lg:border-r">
							<div className="border-b border-stone-200 px-3 py-2">
								<div className="flex items-center justify-between gap-2">
									<div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">
										Files
									</div>
									<button
										type="button"
										onClick={startCreateFile}
										className="rounded-full border border-stone-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-600"
									>
										New
									</button>
								</div>
								{hiddenFileCount > 0 ? (
									<button
										type="button"
										onClick={() => setShowHiddenFiles((current) => !current)}
										className="mt-2 rounded-full border border-stone-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500"
									>
										{showHiddenFiles
											? `Hide runtime files (${hiddenFileCount})`
											: `Show runtime files (${hiddenFileCount})`}
									</button>
								) : null}
							</div>
							{fileAction === 'create' ? (
								<div className="border-b border-stone-200 bg-white px-3 py-3">
									<div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-400">
										New file
									</div>
									<input
										value={filePathInput}
										onChange={(event) => {
											setFilePathInput(event.target.value);
											setFileActionError(null);
										}}
										onKeyDown={(event) => {
											if (event.key === 'Enter') {
												event.preventDefault();
												submitCreateFile();
											}
										}}
										className="mt-2 w-full rounded-[12px] border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none"
										placeholder="/components/Card.jsx"
									/>
									{fileActionError ? (
										<div className="mt-2 text-xs text-rose-600">{fileActionError}</div>
									) : null}
									<div className="mt-3 flex items-center justify-end gap-2">
										<button
											type="button"
											onClick={cancelFileAction}
											className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-600"
										>
											Cancel
										</button>
										<button
											type="button"
											onClick={submitCreateFile}
											className="rounded-full bg-stone-900 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white"
										>
											Create
										</button>
									</div>
								</div>
							) : null}
							<div className="min-h-0 space-y-1 overflow-auto p-2">
								{visibleFiles.map((path) => {
									const isActive = activeFilePath === path;
									return (
										<button
											key={path}
											type="button"
											onClick={() =>
												applyDraft(
													applyPrototypeStudioCommand(draft, {
														type: 'set_active_file',
														path,
													}),
												)
											}
											className={`flex w-full items-center gap-2 rounded-[10px] px-2.5 py-2 text-left text-sm transition-colors ${
												isActive
													? 'bg-[#eef0ff] text-[#3f47c5]'
													: 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
											}`}
										>
											<span className="text-[11px]">{getFileLabel(path)}</span>
											<span className="min-w-0 flex-1 truncate">{path.replace(/^\//, '')}</span>
											{draft.files[path]?.hidden ? (
												<span className="rounded-full border border-stone-200 bg-white px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-stone-400">
													Runtime
												</span>
											) : null}
										</button>
									);
								})}
							</div>
						</div>

						<div className="min-h-0 bg-white">
							{activeFilePath && activeFile ? (
								<div className="flex h-full min-h-[620px] flex-col">
									<div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 px-4 py-3">
										<div className="min-w-0">
											<div className="truncate text-sm font-semibold text-stone-900">
												{activeFilePath.replace(/^\//, '')}
											</div>
											<div className="mt-1 flex flex-wrap gap-2">
												{activeFile.hidden ? (
													<div className="rounded-full border border-stone-200 bg-stone-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-500">
														Runtime file
													</div>
												) : null}
												{activeFile.readOnly ? (
													<div className="rounded-full border border-stone-200 bg-stone-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-500">
														Read only
													</div>
												) : null}
											</div>
										</div>
										<div className="flex items-center gap-2">
											<button
												type="button"
												onClick={startRenameFile}
												disabled={Boolean(activeFile.readOnly)}
												className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-600 disabled:cursor-not-allowed disabled:opacity-40"
											>
												Rename
											</button>
											<button
												type="button"
												onClick={() =>
													setConfirmDeletePath((current) =>
														current === activeFilePath ? null : activeFilePath,
													)
												}
												disabled={Boolean(activeFile.readOnly)}
												className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
											>
												Delete
											</button>
										</div>
									</div>
									{fileAction === 'rename' ? (
										<div className="border-b border-stone-200 bg-stone-50/70 px-4 py-3">
											<div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-400">
												Rename file
											</div>
											<input
												value={filePathInput}
												onChange={(event) => {
													setFilePathInput(event.target.value);
													setFileActionError(null);
												}}
												onKeyDown={(event) => {
													if (event.key === 'Enter') {
														event.preventDefault();
														submitRenameFile();
													}
												}}
												className="mt-2 w-full rounded-[12px] border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none"
												placeholder="/components/Card.jsx"
											/>
											{fileActionError ? (
												<div className="mt-2 text-xs text-rose-600">{fileActionError}</div>
											) : null}
											<div className="mt-3 flex items-center justify-end gap-2">
												<button
													type="button"
													onClick={cancelFileAction}
													className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-600"
												>
													Cancel
												</button>
												<button
													type="button"
													onClick={submitRenameFile}
													className="rounded-full bg-stone-900 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white"
												>
													Save name
												</button>
											</div>
										</div>
									) : null}
									{confirmDeletePath === activeFilePath ? (
										<div className="border-b border-rose-200 bg-rose-50/80 px-4 py-3">
											<div className="text-sm text-rose-700">
												Delete{' '}
												<span className="font-semibold">{activeFilePath.replace(/^\//, '')}</span>?
												This file will be removed from the prototype.
											</div>
											<div className="mt-3 flex items-center justify-end gap-2">
												<button
													type="button"
													onClick={() => setConfirmDeletePath(null)}
													className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-600"
												>
													Cancel
												</button>
												<button
													type="button"
													onClick={deleteActiveFile}
													className="rounded-full bg-rose-600 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white"
												>
													Delete file
												</button>
											</div>
										</div>
									) : null}
									<PrototypeCodeEditor
										path={activeFilePath}
										code={activeFile.code}
										readOnly={activeFile.readOnly}
										onChange={(code) =>
											applyDraft(
												applyPrototypeStudioCommand(draft, {
													type: 'write_file',
													path: activeFilePath,
													code,
												}),
											)
										}
									/>
								</div>
							) : (
								<div className="flex h-full min-h-[620px] items-center justify-center text-sm text-stone-500">
									No editable file is available.
								</div>
							)}
						</div>
					</div>

					<div className="grid min-h-[620px] min-w-0 overflow-hidden rounded-[22px] border border-stone-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
						<div className="flex items-center justify-between gap-2 border-b border-stone-200 px-4 py-3">
							<div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">
								Live preview
							</div>
							<div className="text-xs text-stone-500">
								{preview.diagnostics.length > 0
									? `${preview.diagnostics.length} issue${preview.diagnostics.length === 1 ? '' : 's'}`
									: 'No issues'}
							</div>
						</div>

						<div className="min-h-0 bg-stone-50">
							{preview.srcDoc ? (
								<iframe
									key={preview.srcDoc}
									title="Prototype preview"
									srcDoc={preview.srcDoc}
									sandbox="allow-scripts"
									className="h-full min-h-[420px] w-full border-0 bg-white"
								/>
							) : (
								<div className="flex h-full min-h-[420px] items-center justify-center text-sm text-stone-500">
									Preview will appear here after the first compile.
								</div>
							)}
						</div>

						<div className="max-h-56 overflow-auto border-t border-stone-200 bg-stone-50/70 px-4 py-3">
							{preview.diagnostics.length === 0 ? (
								<div className="text-sm text-stone-500">
									The preview runtime is controlled by the studio. AI tools can edit files without
									restarting a sandbox service.
								</div>
							) : (
								<div className="space-y-2">
									{preview.diagnostics.map((diagnostic, index) => (
										<div
											key={`${diagnostic.source}-${diagnostic.path ?? 'global'}-${index}`}
											className="rounded-[16px] border border-stone-200 bg-white px-3 py-2"
										>
											<div className="flex items-center justify-between gap-3">
												<div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-400">
													{diagnostic.source}
												</div>
												{diagnostic.path ? (
													<div className="text-[11px] text-stone-500">
														{diagnostic.path.replace(/^\//, '')}
														{diagnostic.line ? `:${diagnostic.line}` : ''}
													</div>
												) : null}
											</div>
											<div className="mt-1 text-sm leading-5 text-stone-700">
												{diagnostic.message}
											</div>
										</div>
									))}
								</div>
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
