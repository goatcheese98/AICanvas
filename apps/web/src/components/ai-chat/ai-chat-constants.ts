export const PANEL_BUTTON =
	'inline-flex h-8 items-center justify-center rounded-[7px] border px-2.5 text-[9px] font-semibold uppercase tracking-[0.18em] transition-colors';

export const PANEL_BUTTON_IDLE =
	'border-stone-300 bg-white text-stone-700 hover:border-[#d7dafd] hover:bg-[#f3f1ff] hover:text-[#4d55cc]';

export const PANEL_BUTTON_ACTIVE =
	'border-[#d7dafd] bg-[#eef0ff] text-[#4d55cc]';

export const PANEL_BUTTON_DANGER =
	'border-stone-300 bg-white text-stone-700 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600';

export const AFFIRMATIVE_PATCH_REPLY =
	/^(?:y|yes|apply|apply it|apply patch|go ahead|do it|do that|confirm|sounds good|sure)\.?$/i;

export const NEGATIVE_PATCH_REPLY =
	/^(?:n|no|don['’]?t apply|do not apply|skip|cancel|not now|leave it)\.?$/i;

export const CHAT_INPUT_MAX_HEIGHT = 136;
