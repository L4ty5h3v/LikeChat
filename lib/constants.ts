// Константы приложения

export const ACTIVITY_LABELS = {
  like: 'Лайк',
  recast: 'Рекаст',
  comment: 'Комментарий',
} as const;

export const ACTIVITY_ICONS = {
  like: '❤️',
  recast: '🔄',
  comment: '💬',
} as const;

export const TOTAL_TASKS = 10;
export const TOKEN_PRICE = 0.1;

export const COLORS = {
  primary: '#D61C4E',
  success: '#28A745',
  warning: '#FFC107',
  background: '#FFFFFF',
} as const;

export const ROUTES = {
  home: '/',
  tasks: '/tasks',
  buyToken: '/buyToken',
  submit: '/submit',
  chat: '/chat',
} as const;

