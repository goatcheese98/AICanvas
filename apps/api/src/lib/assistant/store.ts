/**
 * Assistant Store Module
 *
 * This module provides data access operations for assistant-related entities:
 * - Threads: Conversation threads
 * - Runs: Individual assistant runs within threads
 * - Tasks: Sub-tasks within runs
 * - Artifacts: Generated content from tasks
 *
 * The implementation has been refactored into focused sub-modules under `store/`:
 * - parsing.ts: JSON parsing helpers
 * - transforms.ts: Row-to-object transformers
 * - thread-repository.ts: Thread CRUD operations
 * - run-repository.ts: Run CRUD operations
 * - task-repository.ts: Task CRUD operations
 * - artifact-repository.ts: Artifact CRUD operations
 *
 * This file re-exports all functions for backward compatibility.
 */

// Re-export all parsing helpers
export {
	logParseFailure,
	parseContextSnapshot,
	parseEventData,
	parseMessage,
	parseMessageHistory,
	parsePrototypeContext,
	parseStringArray,
	parseTaskInput,
	parseTaskOutput,
} from './store/parsing';

// Re-export all transformers
export {
	buildThreadMessages,
	normalizeThreadTitle,
	summarizeAssistantThreadTitle,
	toAssistantArtifactRecord,
	toAssistantRun,
	toAssistantRunEvent,
	toAssistantTask,
	toAssistantThread,
	toUserMessage,
} from './store/transforms';

// Re-export all thread operations
export {
	createAssistantThreadRecord,
	deleteAssistantThreadRecord,
	getAssistantThreadRecord,
	listAssistantThreadsRecord,
	updateAssistantThreadRecord,
} from './store/thread-repository';

// Re-export all run operations
export {
	appendAssistantRunEventRecord,
	createAssistantRunRecord,
	getAssistantRunRecord,
	listAssistantRunEventsRecord,
	listAssistantRunsByThreadRecord,
	updateAssistantRunRecord,
} from './store/run-repository';

// Re-export all task operations
export {
	createAssistantTaskRecord,
	getAssistantTaskRecord,
	getNextQueuedAssistantTaskRecord,
	listAssistantTasksRecord,
	updateAssistantTaskRecord,
} from './store/task-repository';

// Re-export all artifact operations
export {
	createAssistantArtifactRecord,
	listAssistantArtifactsByTaskRecord,
	listAssistantArtifactsRecord,
} from './store/artifact-repository';
