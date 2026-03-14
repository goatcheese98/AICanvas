import { getAssistantRunProgressLabel, type AssistantRunProgress } from './run-progress';

export function AIChatRunStatus({
	runProgress,
	isExpanded,
	onToggleExpanded,
}: {
	runProgress: AssistantRunProgress | null;
	isExpanded: boolean;
	onToggleExpanded: () => void;
}) {
	if (!runProgress) {
		return null;
	}

	return (
		<div className="rounded-[12px] border border-stone-200 bg-white px-4 py-3">
			<div className="flex items-center justify-between gap-3">
				<div className="flex items-center gap-3">
					<div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-stone-500">
						Run Status
					</div>
					<button
						type="button"
						onClick={onToggleExpanded}
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
			<div className="mt-1 text-[13px] font-medium text-stone-900">
				{getAssistantRunProgressLabel(runProgress)}
			</div>
			{isExpanded && runProgress.tasks.length > 0 ? (
				<div className="mt-3 space-y-2">
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
				<div className="mt-3 rounded-[10px] border border-stone-200 bg-stone-50 px-3 py-2">
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
