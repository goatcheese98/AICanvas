import { create } from 'zustand';
import { createCanvasSlice, type CanvasSlice } from './slices/canvasSlice';
import { createChatSlice, type ChatSlice } from './slices/chatSlice';
import { createUiSlice, type UiSlice } from './slices/uiSlice';

export type AppStore = CanvasSlice & ChatSlice & UiSlice;

export const useAppStore = create<AppStore>()((...a) => ({
	...createCanvasSlice(...a),
	...createChatSlice(...a),
	...createUiSlice(...a),
}));
