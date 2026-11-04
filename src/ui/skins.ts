// Themes: colours live in styles.css ([data-skin]); icons and wording live here.
export type Skin = 'financial' | 'cute' | 'fantasy' | 'dino' | 'cat' | 'frog';
import type { MascotKind, Pose } from './Mascot';

export type TileKey =
  | 'convert'
  | 'entries'
  | 'recurring'
  | 'monthClose'
  | 'budget'
  | 'wealth'
  | 'goals'
  | 'bills'
  | 'trips'
  | 'debts'
  | 'categories'
  | 'settings';

export interface SkinDef {
  id: Skin;
  label: string;
  desc: string;
  icon: string;
  /** plain = no emoji pictures; categories and accounts show short labels */
  plain: boolean;
  tabs: { home: string; accounts: string; summary: string; more: string };
  names: { accounts: string; more: string; summary: string; budget: string; goals: string; wealth: string };
  /** decoration in the corner of each screen's top card */
  sparkle: Record<string, string>;
  tiles: Record<TileKey, string>;
  empty: string;
  greeting: string;
  /** drawn mascot used instead of emoji decorations */
  mascot?: MascotKind;
  poses?: Record<string, Pose>;
}

const CUTE: SkinDef = {
  id: 'cute',
  label: 'Cute',
  desc: 'Soft pastels and cheerful icons',
  icon: '🌸',
  plain: false,
  tabs: { home: '🏡', accounts: '👛', summary: '📊', more: '🧁' },
  names: {
    accounts: 'Accounts 👛',
    more: 'More 🧁',
    summary: 'Summary 📊',
    budget: 'Budget plan 🗂️',
    goals: 'Saving targets 🎯',
    wealth: 'Wealth preserve 🪙',
  },
  sparkle: {
    home: '🌸',
    accounts: '💖',
    summary: '🍰',
    wealth: '🏺',
    goals: '🛍️',
    debts: '💌',
    recurring: '🔔',
    budget: '🗂️',
    trips: '🤝',
    bills: '🧮',
  },
  tiles: {
    convert: '💱',
    entries: '🔎',
    recurring: '🔁',
    monthClose: '📋',
    budget: '🗂️',
    wealth: '🪙',
    goals: '🎯',
    bills: '🍽️',
    trips: '🧳',
    debts: '🤝',
    categories: '🏷️',
    settings: '⚙️',
  },
  empty: '🐣',
  greeting: 'Hi',
};

const FANTASY: SkinDef = {
  id: 'fantasy',
  label: 'Fantasy',
  desc: 'Fairy tales, fair folk and fairy dust',
  icon: '🧚',
  plain: false,
  tabs: { home: '🏰', accounts: '💎', summary: '🔮', more: '🍄' },
  names: {
    accounts: 'Treasury 💎',
    more: 'Enchantments 🍄',
    summary: 'Summary 🔮',
    budget: 'Budget spell 📜',
    goals: 'Wishes 🌠',
    wealth: 'Wealth preserve 🐉',
  },
  sparkle: {
    home: '🧚',
    accounts: '👑',
    summary: '🦄',
    wealth: '🐉',
    goals: '🌠',
    debts: '🦉',
    recurring: '🌙',
    budget: '📜',
    trips: '🗺️',
    bills: '🍄',
  },
  tiles: {
    convert: '💱',
    entries: '🔎',
    recurring: '🌙',
    monthClose: '📖',
    budget: '📜',
    wealth: '🐉',
    goals: '🌠',
    bills: '🍄',
    trips: '🗺️',
    debts: '🦉',
    categories: '🦋',
    settings: '🪄',
  },
  empty: '🧚‍♀️',
  greeting: 'Hello',
};

const DINO: SkinDef = {
  id: 'dino',
  label: 'Dinosaur',
  desc: 'Cute dinos, leaves and volcanoes',
  icon: '🦕',
  plain: false,
  tabs: { home: '🌋', accounts: '🥚', summary: '🦴', more: '🌿' },
  names: {
    accounts: 'Egg nest 🥚',
    more: 'Jungle 🌿',
    summary: 'Summary 🦴',
    budget: 'Budget plan 🦖',
    goals: 'Saving targets 🦕',
    wealth: 'Wealth preserve 🪨',
  },
  sparkle: {
    home: '🦕',
    accounts: '🥚',
    summary: '🦖',
    wealth: '🪨',
    goals: '🦕',
    debts: '🦖',
    recurring: '🌙',
    budget: '🦴',
    trips: '🗺️',
    bills: '🍖',
  },
  tiles: {
    convert: '💱',
    entries: '🔎',
    recurring: '🔁',
    monthClose: '🦴',
    budget: '🦖',
    wealth: '🪨',
    goals: '🦕',
    bills: '🍖',
    trips: '🗺️',
    debts: '🐢',
    categories: '🌿',
    settings: '🌋',
  },
  empty: '🦕',
  greeting: 'Rawr,',
  mascot: 'dino',
  poses: {
    home: 'happy',
    accounts: 'coin',
    summary: 'wow',
    wealth: 'coin',
    goals: 'love',
    debts: 'happy',
    recurring: 'sleep',
    budget: 'coin',
    trips: 'happy',
    bills: 'love',
    empty: 'happy',
  },
};

const FROG: SkinDef = {
  id: 'frog',
  label: 'Frog',
  desc: 'Round little frogs on a lily pond',
  icon: '🐸',
  plain: false,
  tabs: { home: '🐸', accounts: '🪷', summary: '🍃', more: '💧' },
  names: {
    accounts: 'Lily pond 🪷',
    more: 'Pond 💧',
    summary: 'Summary 🍃',
    budget: 'Budget plan 🐸',
    goals: 'Saving targets 🌼',
    wealth: 'Wealth preserve 👑',
  },
  sparkle: {},
  tiles: {
    convert: '💱',
    entries: '🔎',
    recurring: '🔁',
    monthClose: '📋',
    budget: '🐸',
    wealth: '👑',
    goals: '🌼',
    bills: '🍰',
    trips: '🧳',
    debts: '🐛',
    categories: '🍃',
    settings: '💧',
  },
  empty: '🐸',
  greeting: 'Ribbit,',
  mascot: 'frog',
  poses: {
    home: 'happy',
    accounts: 'coin',
    summary: 'wow',
    wealth: 'coin',
    goals: 'love',
    debts: 'happy',
    recurring: 'sleep',
    budget: 'coin',
    trips: 'happy',
    bills: 'love',
    empty: 'happy',
  },
};

const CAT: SkinDef = {
  id: 'cat',
  label: 'Cat',
  desc: 'Cosy kitties, paws and yarn',
  icon: '🐱',
  plain: false,
  tabs: { home: '🏠', accounts: '🐟', summary: '🧶', more: '🐾' },
  names: {
    accounts: 'Fish bowl 🐟',
    more: 'More 🐾',
    summary: 'Summary 🧶',
    budget: 'Budget plan 😺',
    goals: 'Saving targets 🐈',
    wealth: 'Wealth preserve 👑',
  },
  sparkle: {
    home: '🐱',
    accounts: '🐟',
    summary: '🧶',
    wealth: '👑',
    goals: '🐈',
    debts: '😼',
    recurring: '🌙',
    budget: '😺',
    trips: '🧳',
    bills: '🍣',
  },
  tiles: {
    convert: '💱',
    entries: '🔎',
    recurring: '🔁',
    monthClose: '📋',
    budget: '😺',
    wealth: '👑',
    goals: '🐈',
    bills: '🍣',
    trips: '🧳',
    debts: '😼',
    categories: '🧶',
    settings: '🐾',
  },
  empty: '🐈',
  greeting: 'Meow,',
};

const FINANCIAL: SkinDef = {
  id: 'financial',
  label: 'Financial',
  desc: 'Calm, clean and serious',
  icon: '▣',
  plain: true,
  tabs: { home: '⌂', accounts: '▤', summary: '▥', more: '⋯' },
  names: {
    accounts: 'Accounts',
    more: 'More',
    summary: 'Summary',
    budget: 'Budget plan',
    goals: 'Saving targets',
    wealth: 'Wealth preserve',
  },
  sparkle: {},
  tiles: {
    convert: '⇄',
    entries: '⌕',
    recurring: '↻',
    monthClose: '≡',
    budget: '◫',
    wealth: '◆',
    goals: '◎',
    bills: '÷',
    trips: '⇄',
    debts: '±',
    categories: '#',
    settings: '⚙',
  },
  empty: '',
  greeting: 'Welcome,',
};

export const SKINS: SkinDef[] = [FINANCIAL, CUTE, FANTASY, DINO, CAT, FROG];

export function getSkin(id: string | undefined): SkinDef {
  return SKINS.find((s) => s.id === id) ?? CUTE;
}

let plainIcons = false;
/** Set by the app when the theme changes; emoji helpers read it. */
export function setPlainIcons(v: boolean): void {
  plainIcons = v;
}
export function isPlainIcons(): boolean {
  return plainIcons;
}
