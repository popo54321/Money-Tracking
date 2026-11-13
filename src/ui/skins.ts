// Themes: colours live in styles.css ([data-skin]); icons and wording live here.
export type Skin = 'financial' | 'queenbee' | 'fantasy' | 'dino' | 'wildlife' | 'space';
import type { MascotKind, Pose } from './Mascot';

export type TileKey =
  | 'convert'
  | 'entries'
  | 'recurring'
  | 'monthClose'
  | 'retire'
  | 'guide'
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
  /** a different mascot on some pages (the Financial trio takes turns) */
  cast?: Record<string, MascotKind>;
  poses?: Record<string, Pose>;
}

const QUEENBEE: SkinDef = {
  id: 'queenbee',
  label: 'Queen Bee',
  desc: 'Hot pink, gold and a little attitude',
  icon: '👑',
  plain: false,
  tabs: { home: '👑', accounts: '👛', summary: '💅', more: '✨' },
  names: {
    accounts: 'Accounts 👛',
    more: 'More ✨',
    summary: 'Summary 💅',
    budget: 'Budget plan 📋',
    goals: 'Saving targets 💖',
    wealth: 'Wealth preserve 💎',
  },
  sparkle: {},
  tiles: {
    convert: '💱',
    entries: '🔎',
    recurring: '🔁',
    monthClose: '📋',
    retire: '🔭',
    guide: '📖',
    budget: '📋',
    wealth: '💎',
    goals: '💖',
    bills: '🥂',
    trips: '🧳',
    debts: '💌',
    categories: '🏷️',
    settings: '⚙️',
  },
  empty: '💅',
  greeting: 'Hey,',
  mascot: 'bee',
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
    retire: '🔭',
    guide: '📖',
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
  mascot: 'fairy',
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
    retire: '🔭',
    guide: '📖',
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

const WILDLIFE: SkinDef = {
  id: 'wildlife',
  label: 'Wildlife',
  desc: 'Wild animals in their natural homes',
  icon: '🦁',
  plain: false,
  tabs: { home: '🏕️', accounts: '🪺', summary: '🐾', more: '🌿' },
  names: {
    accounts: 'Accounts 🪺',
    more: 'More 🌿',
    summary: 'Summary 🐾',
    budget: 'Budget plan 🗺️',
    goals: 'Saving targets 🎯',
    wealth: 'Wealth preserve 🪙',
  },
  sparkle: {},
  tiles: {
    convert: '💱',
    entries: '🔎',
    recurring: '🔁',
    monthClose: '📋',
    retire: '🔭',
    guide: '📖',
    budget: '🗺️',
    wealth: '🪙',
    goals: '🎯',
    bills: '🍽️',
    trips: '🧳',
    debts: '🤝',
    categories: '🍃',
    settings: '⚙️',
  },
  empty: '🦊',
  greeting: 'Hello,',
  mascot: 'fox',
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

const SPACE: SkinDef = {
  id: 'space',
  label: 'Space',
  desc: 'Rockets, planets and starlight',
  icon: '🚀',
  plain: false,
  tabs: { home: '🚀', accounts: '🛰️', summary: '🪐', more: '✨' },
  names: {
    accounts: 'Accounts 🛰️',
    more: 'More ✨',
    summary: 'Summary 🪐',
    budget: 'Budget plan 🗺️',
    goals: 'Saving targets 🌟',
    wealth: 'Wealth preserve 💫',
  },
  sparkle: {},
  tiles: {
    convert: '💱',
    entries: '🔎',
    recurring: '🔁',
    monthClose: '📋',
    retire: '🔭',
    guide: '📖',
    budget: '🗺️',
    wealth: '💫',
    goals: '🌟',
    bills: '🍽️',
    trips: '🧳',
    debts: '🤝',
    categories: '🏷️',
    settings: '⚙️',
  },
  empty: '🪐',
  greeting: 'Greetings,',
  mascot: 'astronaut',
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
    retire: '↗',
    guide: '?',
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
  // three round tycoons take turns: the old investor, the rocket boss and the luxury tycoon
  mascot: 'investor',
  cast: {
    accounts: 'tycoon',
    summary: 'rocket',
    wealth: 'tycoon',
    goals: 'rocket',
    debts: 'investor',
    recurring: 'investor',
    budget: 'investor',
    trips: 'rocket',
    bills: 'tycoon',
  },
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

export const SKINS: SkinDef[] = [FINANCIAL, QUEENBEE, FANTASY, DINO, WILDLIFE, SPACE];

/** Themes that were retired, and the theme that took their place. */
const RETIRED: Record<string, Skin> = { cute: 'queenbee', frog: 'wildlife', cat: 'wildlife' };

export function getSkin(id: string | undefined): SkinDef {
  const real = (id && RETIRED[id]) || id;
  return SKINS.find((s) => s.id === real) ?? QUEENBEE;
}

let plainIcons = false;
/** Set by the app when the theme changes; emoji helpers read it. */
export function setPlainIcons(v: boolean): void {
  plainIcons = v;
}
export function isPlainIcons(): boolean {
  return plainIcons;
}
