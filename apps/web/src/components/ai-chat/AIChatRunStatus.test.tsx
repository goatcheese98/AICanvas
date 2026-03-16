import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AIChatRunStatus } from './AIChatRunStatus';

describe('AIChatRunStatus', () => {
	it('renders only an expand icon when the inline variant is collapsed', () => {
		const onToggleExpanded = vi.fn();

	render(
		<AIChatRunStatus
				runProgress={{
					runId: 'run-1',
					status: 'completed',
					tasks: [
						{
							id: 'task-1',
							runId: 'run-1',
							type: 'generate_response',
							title: 'Generate assistant response',
							status: 'completed',
							createdAt: '2026-03-15T20:31:01.000Z',
							updatedAt: '2026-03-15T20:31:02.000Z',
						},
					],
					artifacts: [],
			}}
			isExpanded={false}
			onToggleExpanded={onToggleExpanded}
			variant="inline-trigger"
		/>,
	);

		expect(screen.queryByText('Assistant Activity')).toBeNull();
		expect(screen.queryByText('Run completed')).toBeNull();
		expect(screen.queryByText('Generate assistant response')).toBeNull();
		fireEvent.click(screen.getByRole('button', { name: 'Expand assistant activity' }));
		expect(onToggleExpanded).toHaveBeenCalledTimes(1);
	});
});
