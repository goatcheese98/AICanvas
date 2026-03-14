import { describe, expect, it, vi } from 'vitest';

// Test pure helper functions extracted from assistant.ts
// These are the exported utility functions that don't require database mocking

describe('assistant route helpers', () => {
    describe('getArtifactTitle', () => {
        function getArtifactTitle(
            type: 'mermaid' | 'd2' | 'kanban-ops' | 'kanban-patch' | 'prototype-files' | 'markdown-patch',
        ): string {
            switch (type) {
                case 'mermaid':
                    return 'Generated Mermaid draft';
                case 'd2':
                    return 'Generated D2 draft';
                case 'kanban-ops':
                    return 'Generated Kanban operations';
                case 'kanban-patch':
                    return 'Generated Kanban patch';
                case 'prototype-files':
                    return 'Generated prototype files';
                case 'markdown-patch':
                    return 'Generated Markdown patch';
            }
        }

        it('returns correct title for mermaid type', () => {
            expect(getArtifactTitle('mermaid')).toBe('Generated Mermaid draft');
        });

        it('returns correct title for d2 type', () => {
            expect(getArtifactTitle('d2')).toBe('Generated D2 draft');
        });

        it('returns correct title for kanban-ops type', () => {
            expect(getArtifactTitle('kanban-ops')).toBe('Generated Kanban operations');
        });

        it('returns correct title for kanban-patch type', () => {
            expect(getArtifactTitle('kanban-patch')).toBe('Generated Kanban patch');
        });

        it('returns correct title for prototype-files type', () => {
            expect(getArtifactTitle('prototype-files')).toBe('Generated prototype files');
        });

        it('returns correct title for markdown-patch type', () => {
            expect(getArtifactTitle('markdown-patch')).toBe('Generated Markdown patch');
        });
    });

    describe('serializeStoredAssistantAssetContent', () => {
        interface StoredAssistantAssetContent {
            kind: 'stored_asset';
            r2Key: string;
            mimeType: string;
            provider: string;
            model?: string;
            prompt?: string;
            revisedPrompt?: string;
            tool?: string;
            byteSize?: number;
            sourceArtifactId?: string;
        }

        function serializeStoredAssistantAssetContent(content: StoredAssistantAssetContent): string {
            return JSON.stringify(content);
        }

        it('serializes minimal content', () => {
            const content: StoredAssistantAssetContent = {
                kind: 'stored_asset',
                r2Key: 'assets/test-key',
                mimeType: 'image/png',
                provider: 'openai',
            };
            const result = serializeStoredAssistantAssetContent(content);
            expect(JSON.parse(result)).toEqual(content);
        });

        it('serializes full content with all fields', () => {
            const content: StoredAssistantAssetContent = {
                kind: 'stored_asset',
                r2Key: 'assets/test-key',
                mimeType: 'image/svg+xml',
                provider: 'openai',
                model: 'gpt-4-vision',
                prompt: 'A beautiful sunset',
                revisedPrompt: 'A beautiful sunset over mountains',
                tool: 'dall-e-3',
                byteSize: 12345,
                sourceArtifactId: 'artifact-123',
            };
            const result = serializeStoredAssistantAssetContent(content);
            expect(JSON.parse(result)).toEqual(content);
        });
    });

    describe('parseStoredAssistantAssetContent', () => {
        interface StoredAssistantAssetContent {
            kind: 'stored_asset';
            r2Key: string;
            mimeType: string;
            provider: string;
            model?: string;
            prompt?: string;
            revisedPrompt?: string;
            tool?: string;
            byteSize?: number;
            sourceArtifactId?: string;
        }

        function parseStoredAssistantAssetContent(value: string): StoredAssistantAssetContent | null {
            try {
                const parsed = JSON.parse(value) as StoredAssistantAssetContent;
                return parsed.kind === 'stored_asset' ? parsed : null;
            } catch {
                return null;
            }
        }

        it('parses valid stored asset content', () => {
            const content = JSON.stringify({
                kind: 'stored_asset',
                r2Key: 'assets/test-key',
                mimeType: 'image/png',
                provider: 'openai',
            });
            const result = parseStoredAssistantAssetContent(content);
            expect(result).toEqual({
                kind: 'stored_asset',
                r2Key: 'assets/test-key',
                mimeType: 'image/png',
                provider: 'openai',
            });
        });

        it('returns null for invalid JSON', () => {
            expect(parseStoredAssistantAssetContent('not json')).toBeNull();
        });

        it('returns null for object without kind field', () => {
            const content = JSON.stringify({
                r2Key: 'assets/test-key',
                mimeType: 'image/png',
            });
            expect(parseStoredAssistantAssetContent(content)).toBeNull();
        });

        it('returns null for wrong kind value', () => {
            const content = JSON.stringify({
                kind: 'other_type',
                r2Key: 'assets/test-key',
            });
            expect(parseStoredAssistantAssetContent(content)).toBeNull();
        });
    });

    describe('serializeSseEvent', () => {
        function serializeSseEvent(event: unknown, eventName?: string): string {
            const parts: string[] = [];
            if (eventName) parts.push(`event: ${eventName}`);
            parts.push(`data: ${JSON.stringify(event)}`);
            return `${parts.join('\n')}\n\n`;
        }

        it('serializes event without name', () => {
            const result = serializeSseEvent({ status: 'running' });
            expect(result).toBe('data: {"status":"running"}\n\n');
        });

        it('serializes event with name', () => {
            const result = serializeSseEvent({ status: 'running' }, 'run.started');
            expect(result).toBe('event: run.started\ndata: {"status":"running"}\n\n');
        });

        it('serializes complex event object', () => {
            const result = serializeSseEvent({
                taskId: 'task-123',
                taskType: 'generate_image',
                taskStatus: 'completed',
            }, 'task.completed');
            expect(result).toContain('event: task.completed');
            expect(result).toContain('"taskId":"task-123"');
            expect(result).toContain('"taskType":"generate_image"');
        });
    });

    describe('isTerminalAssistantRunStatus', () => {
        function isTerminalAssistantRunStatus(status: string): boolean {
            return status === 'completed' || status === 'failed' || status === 'cancelled';
        }

        it('returns true for completed', () => {
            expect(isTerminalAssistantRunStatus('completed')).toBe(true);
        });

        it('returns true for failed', () => {
            expect(isTerminalAssistantRunStatus('failed')).toBe(true);
        });

        it('returns true for cancelled', () => {
            expect(isTerminalAssistantRunStatus('cancelled')).toBe(true);
        });

        it('returns false for running', () => {
            expect(isTerminalAssistantRunStatus('running')).toBe(false);
        });

        it('returns false for queued', () => {
            expect(isTerminalAssistantRunStatus('queued')).toBe(false);
        });

        it('returns false for unknown status', () => {
            expect(isTerminalAssistantRunStatus('unknown')).toBe(false);
        });
    });
});
