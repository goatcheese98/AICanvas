import * as z from 'zod';

export const sendMessageSchema = z.object({
	message: z.string().min(1).max(10000),
	contextMode: z.enum(['all', 'selected']).default('all'),
	generationMode: z
		.enum(['chat', 'mermaid', 'd2', 'image', 'sketch', 'kanban'])
		.default('chat'),
});

export const assistantSchemas = {
	sendMessage: sendMessageSchema,
} as const;

export type SendMessage = z.infer<typeof sendMessageSchema>;
