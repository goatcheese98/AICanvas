import type { ReactNode } from 'react';

export type ResourceType = 'canvas' | 'board' | 'document' | 'prototype';

export interface ProjectResource {
	id: string;
	type: ResourceType;
	name: string;
	isActive?: boolean;
	icon?: ReactNode;
}

export interface Project {
	id: string;
	name: string;
	resources: ProjectResource[];
}

export interface SidebarFooterState {
	avatarUrl?: string;
	initials: string;
	displayName: string;
	collaborators: { id: string; name: string; avatarUrl?: string }[];
	isCollaborating: boolean;
}
