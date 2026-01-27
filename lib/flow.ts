export type FlowStep =
  | 'home'
  | 'tasks'
  | 'buyToken'
  | 'submit'
  | 'success';

const STORAGE_KEY = 'likechat:flow';

export type FlowState = {
  step: FlowStep;
  updatedAt: number;
};

function safeParse(json: string | null): any {
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function getFlowState(): FlowState | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  const parsed = safeParse(raw);
  if (!parsed || typeof parsed !== 'object') return null;
  if (typeof parsed.step !== 'string') return null;
  if (typeof parsed.updatedAt !== 'number') return null;
  return parsed as FlowState;
}

export function setFlowStep(step: FlowStep): void {
  if (typeof window === 'undefined') return;
  const state: FlowState = { step, updatedAt: Date.now() };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function clearFlow(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export function stepToRoute(step: FlowStep): string {
  switch (step) {
    case 'tasks':
      return '/tasks';
    case 'buyToken':
      return '/buyToken';
    case 'submit':
      return '/submit';
    case 'success':
      return '/submit'; // success живет как модалка на /submit
    case 'home':
    default:
      return '/';
  }
}

