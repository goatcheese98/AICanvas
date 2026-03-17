import { type AssistantRunProgress, getAssistantRunProgressLabel } from './run-progress';

function ChevronIcon({ open }: { open: boolean }) {
	return (
		<svg
			viewBox="0 0 16 16"
			aria-hidden="true"
			className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : 'rotate-0'}`}
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M4.5 6.5 8 10l3.5-3.5" />
		</svg>
	);
}

export function AIChatRunStatus({
	runProgress,
	isExpanded,
	onToggleExpanded,
	variant = 'standalone',
}: {
	runProgress: AssistantRunProgress | null;
	isExpanded: boolean;
	onToggleExpanded: () => void;
	variant?: 'inline-panel' | 'inline-trigger' | 'standalone';
}) {
	if (!runProgress) {
		return null;
	}

	if (variant === 'inline-trigger') {
		return (
			<button
				type="button"
				onClick={onToggleExpanded}
				aria-label={isExpanded ? 'Collapse assistant activity' : 'Expand assistant activity'}
				className="rounded-full border border-stone-200 bg-white p-1.5 text-stone-500 transition-colors hover:border-stone-300 hover:text-stone-900"
			>
				<ChevronIcon open={isExpanded} />
			</button>
		);
	}

	if (variant === 'inline-panel') {
		if (!isExpanded) {
			return null;
		}

		return (
			<div className="rounded-[12px] bg-stone-50 px-3 py-2.5">
				<div className="flex items-center justify-between gap-3">
					<div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">
						{getAssistantRunProgressLabel(runProgress)}
					</div>
					<div
						className={`rounded-full px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] ${
							runProgress.status === 'failed'
								? 'bg-rose-100 text-rose-700'
								: runProgress.status === 'completed'
									? 'bg-emerald-100 text-emerald-700'
									: 'bg-stone-200 text-stone-600'
						}`}
					>
						{runProgress.status}
					</div>
				</div>
				{runProgress.tasks.length > 0 ? (
					<div className="mt-2 space-y-1.5">
						{runProgress.tasks.map((task) => (
							<div
								key={task.id}
								className="flex items-center justify-between gap-3 rounded-[10px] bg-white px-3 py-2 text-[11px]"
							>
								<div className="text-stone-700">{task.title}</div>
								<div
									className={`font-semibold uppercase tracking-[0.14em] ${
										task.status === 'failed'
											? 'text-rose-700'
											: task.status === 'completed'
												? 'text-emerald-700'
												: task.status === 'running'
													? 'text-[#4d55cc]'
													: 'text-stone-500'
									}`}
								>
									{task.status}
								</div>
							</div>
						))}
					</div>
				) : null}
			</div>
		);
	}

	return (
		<div className="mr-auto w-full max-w-[92%] rounded-[14px] border border-stone-200 bg-white px-3.5 py-3 shadow-none">
			<div className="flex items-center justify-between gap-3">
				<div className="flex items-center gap-3">
					<div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-stone-500">
						Assistant Activity
					</div>
					<button
						type="button"
						onClick={onToggleExpanded}
						aria-label={isExpanded ? 'Collapse assistant activity' : 'Expand assistant activity'}
						className="text-[9px] font-semibold uppercase tracking-[0.16em] text-stone-500 transition-colors hover:text-stone-900"
					>
						{isExpanded ? 'Collapse' : 'Expand'}
					</button>
				</div>
				<div
					className={`rounded-full px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] ${
						runProgress.status === 'failed'
							? 'bg-rose-100 text-rose-700'
							: runProgress.status === 'completed'
								? 'bg-emerald-100 text-emerald-700'
								: 'bg-stone-100 text-stone-600'
					}`}
				>
					{runProgress.status}
				</div>
			</div>
			<div className="text-[12px] font-medium text-stone-900">
				{getAssistantRunProgressLabel(runProgress)}
			</div>
			{isExpanded && runProgress.tasks.length > 0 ? (
				<div className="space-y-2">
					{runProgress.tasks.map((task) => (
						<div
							key={task.id}
							className="flex items-center justify-between gap-3 rounded-[10px] bg-stone-50 px-3 py-2 text-[11px]"
						>
							<div className="text-stone-700">{task.title}</div>
							<div
								className={`font-semibold uppercase tracking-[0.14em] ${
									task.status === 'failed'
										? 'text-rose-700'
										: task.status === 'completed'
											? 'text-emerald-700'
											: task.status === 'running'
												? 'text-[#4d55cc]'
												: 'text-stone-500'
								}`}
							>
								{task.status}
							</div>
						</div>
					))}
				</div>
			) : null}
			{isExpanded && runProgress.artifacts.length > 0 ? (
				<div className="rounded-[10px] border border-stone-200 bg-stone-50 px-3 py-2">
					<div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-stone-500">
						Artifacts
					</div>
					<div className="mt-2 flex flex-wrap gap-2">
						{runProgress.artifacts.map((artifact) => (
							<div
								key={artifact.id}
								className="rounded-full border border-stone-200 bg-white px-2 py-1 text-[10px] text-stone-700"
							>
								{artifact.title}
							</div>
						))}
					</div>
				</div>
			) : null}
		</div>
	);
}
