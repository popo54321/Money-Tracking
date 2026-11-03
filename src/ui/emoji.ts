// Cute default icons for categories and accounts (can be changed per category).
import type { AccountType, Category } from '../domain/types';
import { isPlainIcons } from './skins';

function initials(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return '•';
  return (words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[1][0]).toUpperCase();
}

const CATEGORY_EMOJI: Record<string, string> = {
  salary: '💰',
  'investing dividend': '📈',
  'commission money': '🤝',
  'investing income': '📊',
  'company provident': '🏦',
  payback: '🔁',
  gifts: '🎁',
  interest: '🌼',
  other: '✨',
  breakfast: '🥐',
  lunch: '🍜',
  dinner: '🍲',
  delivery: '🛵',
  groceries: '🛒',
  household: '🏠',
  transportation: '🚇',
  games: '🎮',
  books: '📚',
  qiqi: '💕',
  socialise: '🥂',
  'treating people': '🍻',
  movies: '🎬',
  clothes: '👗',
  'luxury lifestyle': '💎',
  'health & body care': '🧴',
  workout: '🏋️',
  'personal development': '🌱',
  'work expense': '💼',
  tax: '🧾',
  travel: '✈️',
  'large purchase 1': '🛍️',
  'large purchase 2': '📦',
  'large purchase': '🛍️',
  spotify: '🎧',
  adobe: '🎨',
  'youtube premium': '📺',
  'line man vip': '🛵',
  gemini: '♊',
  discord: '💬',
  'shopee vip': '🧡',
  'health insurance': '🩺',
  claude: '🤖',
  'tax & social security': '🏛️',
  insurance: '🛡️',
  subscriptions: '🔔',
  bills: '💡',
  coffee: '☕',
  snacks: '🍡',
  pets: '🐾',
  rent: '🔑',
  phone: '📱',
  internet: '🌐',
  electricity: '⚡',
  water: '💧',
  fuel: '⛽',
  parking: '🅿️',
};

const GROUP_EMOJI: Record<string, string> = {
  Income: '💰',
  'Eating Out': '🍽️',
  Discretionary: '🎀',
  Infrequent: '🗓️',
  Fixed: '🔁',
};

export function categoryEmoji(c: Pick<Category, 'name' | 'group' | 'emoji'> | null | undefined): string {
  if (!c) return isPlainIcons() ? '?' : '❔';
  if (isPlainIcons()) return initials(c.name);
  if (c.emoji) return c.emoji;
  return CATEGORY_EMOJI[c.name.trim().toLowerCase()] ?? GROUP_EMOJI[c.group] ?? '🏷️';
}

export function groupEmoji(group: string): string {
  if (isPlainIcons()) return '';
  return GROUP_EMOJI[group] ?? '🏷️';
}

const ACCOUNT_EMOJI: Record<AccountType, string> = {
  bank: '🏦',
  cash: '💵',
  debit: '💳',
  credit: '💳',
  topup: '🎫',
  investment: '📈',
  crypto: '🪙',
  units: '🥇',
  insurance: '🛡️',
  other: '👛',
};

const ACCOUNT_SHORT: Record<AccountType, string> = {
  bank: 'BK',
  cash: 'CA',
  debit: 'DB',
  credit: 'CC',
  topup: 'TU',
  investment: 'IN',
  crypto: '₿',
  units: 'AU',
  insurance: 'IS',
  other: 'OT',
};

export function accountEmoji(type: AccountType): string {
  if (isPlainIcons()) return ACCOUNT_SHORT[type] ?? '•';
  return ACCOUNT_EMOJI[type] ?? '👛';
}

const COLOURS = ['pink', 'mint', 'lav', 'peach', 'butter', 'sky'] as const;
export type Pastel = (typeof COLOURS)[number];

export function accountColour(type: AccountType): Pastel {
  switch (type) {
    case 'bank':
      return 'sky';
    case 'cash':
      return 'mint';
    case 'debit':
      return 'lav';
    case 'credit':
      return 'pink';
    case 'topup':
      return 'peach';
    case 'investment':
      return 'mint';
    case 'crypto':
      return 'butter';
    case 'units':
      return 'butter';
    case 'insurance':
      return 'lav';
    default:
      return 'peach';
  }
}

export function groupColour(group: string): Pastel {
  switch (group) {
    case 'Eating Out':
      return 'peach';
    case 'Discretionary':
      return 'pink';
    case 'Infrequent':
      return 'sky';
    case 'Fixed':
      return 'lav';
    case 'Income':
      return 'mint';
    default:
      return 'butter';
  }
}

/** Stable pastel for a name (people in bill and travel split). */
export function nameColour(name: string): Pastel {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return COLOURS[h % COLOURS.length];
}

export const EMOJI_CHOICES = [
  '🍜',
  '🍲',
  '🥐',
  '🍣',
  '🍕',
  '🍔',
  '☕',
  '🧋',
  '🍰',
  '🍡',
  '🛒',
  '🏠',
  '🚇',
  '🚕',
  '⛽',
  '✈️',
  '🏨',
  '🎮',
  '📚',
  '🎬',
  '🎧',
  '📺',
  '👗',
  '👟',
  '💄',
  '🧴',
  '💊',
  '🩺',
  '🏋️',
  '🌱',
  '💼',
  '🧾',
  '🏛️',
  '💡',
  '📱',
  '🌐',
  '🎁',
  '💕',
  '🥂',
  '🐾',
  '👶',
  '🎓',
  '🚗',
  '🛍️',
  '💎',
  '🎨',
  '🤖',
  '💰',
  '📈',
  '📊',
  '🏦',
  '🔁',
  '🌼',
  '✨',
  '🎀',
  '🧸',
  '🌸',
  '🍀',
  '⭐',
  '🌙',
  '🐻',
  '🐰',
  '🐱',
  '🐶',
  '🐼',
  '🦊',
  '🐥',
  '🐳',
  '📷',
  '💻',
  '⌚',
  '🎸',
  '🏝️',
  '🪙',
  '🥇',
];
