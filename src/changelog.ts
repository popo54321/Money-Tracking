// What changed in each version, newest first. Shown after an update ("What's new") and in Settings → Update
// history. Every release adds its entry here (a test checks the current version has one).

export interface ChangeEntry {
  version: string;
  /** release day (YYYY-MM-DD) */
  date: string;
  title: string;
  notes: string[];
}

export const CHANGELOG: ChangeEntry[] = [
  {
    version: '1.22.0',
    date: '2026-11-15',
    title: 'Paybacks as income, and debt summaries',
    notes: [
      'Who owes me: when someone pays you back, it can also be logged as income: choose the account it came into and the category.',
      'Changing or deleting that payback changes or deletes its income entry too.',
      'Each person has a Copy summary: what they owe, each line with its day and note, and what is still owed.',
      'Summary for everyone copies all open debts at once, ready for a group chat.',
    ],
  },
  {
    version: '1.21.3',
    date: '2026-11-15',
    title: 'Split in detail from Edit bill',
    notes: [
      'On a trip, tapping a bill to edit it now has a “Split this bill in detail” button (and “Open its bill split” once it is split).',
    ],
  },
  {
    version: '1.21.2',
    date: '2026-11-15',
    title: 'Service charge and VAT apart',
    notes: [
      'Bill split shows the service charge and VAT as separate amounts (with their %), and the tip only when there is one.',
      'The shared bill summary lists food, service, VAT and tip amounts.',
    ],
  },
  {
    version: '1.21.1',
    date: '2026-11-15',
    title: 'Data kept safe on iPhone',
    notes: [
      'The app asks the phone to keep its data for good. Settings → Backup shows whether it is protected.',
      'If the browser may clear the data, the backup reminder comes after 3 days instead of 7.',
      'Spreadsheet export: notes starting with = + - or @ stay as text in Excel.',
    ],
  },
  {
    version: '1.21.0',
    date: '2026-11-15',
    title: 'Trip bills in detail, and more accurate cards',
    notes: [
      'On a trip, press and hold a bill → Split this bill in detail: it becomes a bill split paid by you, and is settled there instead of in the trip (it can be counted in the trip again).',
      'Instalment plans still to pay count as card debt: on the card’s page, in available credit and in net worth. The last payment makes the total exact.',
      'A saving target kept in an account uses that account’s currency.',
      'Budget plan: Record ticked records each transfer once a month.',
      'Bill split: Log my share pays from the matching currency of a cash purse or top-up card.',
      'Payday pauses if its account is deleted, and its categories can’t be deleted.',
      'A card with a statement day needs its due day too, so money can be set aside.',
    ],
  },
  {
    version: '1.20.0',
    date: '2026-11-15',
    title: 'Safer numbers',
    notes: [
      'Move fees have their own hidden Move fee category; a fee opens its move, and turning a move into spending or income removes its fee.',
      'Editing an entry keeps the value it had on the day; entries for earlier days use that day’s rate.',
      'Payday lines moved into an account in another currency arrive converted.',
      'Deleting an account that has moves with others: remove it and keep their balances, or delete it with its moves (it says exactly what changes).',
      'Duplicate keeps the currency and wallet.',
      'Switching a paused payday or repeating entry back on asks before recording the ones missed.',
      'Recording pay more than 10 days early asks first.',
      'Restore and Erase ask twice and keep a copy for 7 days, with Undo in Settings.',
      'An older app version won’t open data saved by a newer one.',
    ],
  },
  {
    version: '1.19.1',
    date: '2026-11-15',
    title: 'Update check',
    notes: [
      'A small release to try the update screens: the download bar with its percentage, “Updating…”, and this note.',
      'Nothing else changes.',
    ],
  },
  {
    version: '1.19.0',
    date: '2026-11-15',
    title: 'What’s new and update history',
    notes: [
      'After an update, a note shows what is new in that version.',
      'Settings → Update history lists every version back to the first one.',
    ],
  },
  {
    version: '1.18.1',
    date: '2026-11-15',
    title: 'Clearer updates',
    notes: [
      'While a new version downloads, a bar at the top shows a spinning circle and how far it has got.',
      'Switching to the new version shows “Updating…” for a moment instead of a sudden blink.',
      'After the restart, a note says which version you are on now.',
    ],
  },
  {
    version: '1.18.0',
    date: '2026-11-15',
    title: 'Several currencies in one account',
    notes: [
      'Cash and top-up cards (like a travel card) can hold other currencies, each with its own balance.',
      'When logging, cash and top-up cards that don’t hold the currency you typed are greyed out.',
      'Move money into a chosen currency, or exchange between two currencies of the same account, typing the exact amount you got.',
      'Moves have a Fee box (0 unless you type one), saved as spending in a Fees category.',
      'Removing a currency that still holds money asks twice, with the buttons on opposite sides.',
    ],
  },
  {
    version: '1.17.1',
    date: '2026-11-15',
    title: 'Your own account groups',
    notes: [
      'Add, rename and remove account groups with ✏️ Edit groups on the account form.',
      'New users start with a plain list: Bank, Cash, Credit, Investments, Assets and Insurance.',
      'Month close lists accounts in your own group order.',
    ],
  },
  {
    version: '1.17.0',
    date: '2026-11-14',
    title: 'Quarterly and yearly limits',
    notes: [
      'Spending limits can start again each month, each quarter or each year, for a category or a whole group.',
      'Home shows each limit’s period, and for quarters and years about how much a month is left.',
    ],
  },
  {
    version: '1.16.3',
    date: '2026-11-13',
    title: 'Easier logging order',
    notes: ['A new entry asks for the account, note, date and repeat first, and the category list comes last.'],
  },
  {
    version: '1.16.2',
    date: '2026-11-13',
    title: 'Record pay early',
    notes: ['“Pay arrived? Record it now” is always on Home’s payday card and the Payday page.'],
  },
  {
    version: '1.16.1',
    date: '2026-11-13',
    title: 'Extra paid into a card',
    notes: [
      'Paying more into a card than you owe leaves extra to spend: the limit plus the extra.',
      'The extra counts as free money.',
    ],
  },
  {
    version: '1.16.0',
    date: '2026-11-13',
    title: 'Instalment plans and card debt',
    notes: [
      'Card spending can be paid in instalments: type the full price and the months, and each payment records itself until it is paid off.',
      'A card’s page shows its instalment plans with payments made and what is left.',
      'Log card debt from a card’s page: it is tracked with interest and also shows in Debts.',
    ],
  },
  {
    version: '1.15.2',
    date: '2026-11-13',
    title: 'Card statements',
    notes: [
      'Card spending after the statement day goes on the next statement, due the month after.',
      'A card’s page shows what has been spent since the last statement.',
    ],
  },
  {
    version: '1.15.1',
    date: '2026-11-13',
    title: 'Small bills: same month',
    notes: ['Small bills can be set aside from the start of the month they are due.'],
  },
  {
    version: '1.15.0',
    date: '2026-11-13',
    title: 'Card bills and small bills',
    notes: [
      'Bills paid by card are set aside in the card’s paying bank account, never on the card.',
      'Small yearly bills can be set aside just before they are due, 1 to 3 months ahead.',
    ],
  },
  {
    version: '1.14.4',
    date: '2026-11-13',
    title: 'Financial theme first',
    notes: ['A new install opens in the Financial theme.'],
  },
  {
    version: '1.14.3',
    date: '2026-11-13',
    title: 'New mascots',
    notes: [
      'A round fairy for Fantasy, and three round tycoons taking turns in Financial.',
      'The theme picker shows each theme’s mascot.',
    ],
  },
  {
    version: '1.14.2',
    date: '2026-11-12',
    title: 'Install steps and pressed buttons',
    notes: ['The How to use tour shows how to install the app on your phone.', 'Buttons turn darker for a moment when pressed.'],
  },
  {
    version: '1.14.1',
    date: '2026-11-12',
    title: 'A tour that points',
    notes: ['How to use now points at the real buttons and says where to tap.'],
  },
  {
    version: '1.14.0',
    date: '2026-11-12',
    title: 'Six themes',
    notes: [
      'Financial, Queen Bee, Fantasy, Dinosaur, Wildlife and Space, with drawn mascots.',
      'The retirement calculator follows your theme.',
      'A How to use guide for new users.',
    ],
  },
  {
    version: '1.13.0',
    date: '2026-11-12',
    title: 'Will my money be enough?',
    notes: ['The retirement calculator is built in (More), and works offline.'],
  },
  {
    version: '1.12.0',
    date: '2026-11-12',
    title: 'Yearly bills build up',
    notes: ['Bills that come less often than monthly are set aside a little each month, or all at once if you prefer.'],
  },
  {
    version: '1.11.0',
    date: '2026-11-12',
    title: 'Payday',
    notes: [
      'Set your payday once: full salary, take-home and what is taken off are recorded by themselves.',
      'Pay came early? Record it with one tap.',
    ],
  },
  {
    version: '1.10.3',
    date: '2026-11-12',
    title: 'Retirement calculator link',
    notes: ['More has a big button for the retirement calculator.'],
  },
  {
    version: '1.10.2',
    date: '2026-11-12',
    title: 'Tidier Home',
    notes: ['Home shows overdue card payments at the top and what is coming up under each limit.'],
  },
  {
    version: '1.10.1',
    date: '2026-11-12',
    title: 'Bills you can trust',
    notes: ['A warning when a repeating bill’s next date looks wrong.', 'Card charges show when they must be paid.'],
  },
  {
    version: '1.10.0',
    date: '2026-11-12',
    title: 'One true Free',
    notes: ['Each account counts money in one order: bills, then splits, then saving targets; what is left is Free.'],
  },
  {
    version: '1.9.2',
    date: '2026-11-12',
    title: 'Everything scheduled on Home',
    notes: ['Home lists every payment in the next 31 days, on any account.', 'Limits count what is still to come this month.'],
  },
  {
    version: '1.9.1',
    date: '2026-11-10',
    title: 'Free in red',
    notes: ['Free money shows in red when it is below zero.'],
  },
  {
    version: '1.9.0',
    date: '2026-11-10',
    title: 'Saving targets that stay down',
    notes: ['When an account drops below its targets, the lower amounts are kept, with Put back for mistakes.'],
  },
  {
    version: '1.8.2',
    date: '2026-11-10',
    title: 'Saving targets add up',
    notes: ['Lowered saving targets add up to exactly what the account holds.'],
  },
  {
    version: '1.8.1',
    date: '2026-11-10',
    title: 'Saving targets when money leaves',
    notes: ['A clear rule for which targets go down first when an account goes down.'],
  },
  {
    version: '1.8.0',
    date: '2026-11-09',
    title: 'Card debt kept ready and liquid money',
    notes: [
      'What you owe on a card is kept ready in its paying account.',
      'Liquid money (money you can spend now) next to net worth.',
      'Bill split: tip on its own, with rounding.',
    ],
  },
  {
    version: '1.7.2',
    date: '2026-11-06',
    title: 'Saving targets show the account',
    notes: ['Each saving target shows its account’s balance.'],
  },
  {
    version: '1.7.1',
    date: '2026-11-05',
    title: 'Tip by percentage',
    notes: ['Bill split can add a tip as a percentage.'],
  },
  {
    version: '1.7.0',
    date: '2026-11-05',
    title: 'Vibrate when typing',
    notes: ['On Android, the keypad gives a light buzz on each tap (can be turned off in Settings).'],
  },
  {
    version: '1.6.2',
    date: '2026-11-04',
    title: 'Shares in month close',
    notes: ['Month close shows each category’s share of spending and income.'],
  },
  {
    version: '1.6.1',
    date: '2026-11-04',
    title: 'Neater More',
    notes: ['The More page tiles line up in even groups.'],
  },
  {
    version: '1.6.0',
    date: '2026-11-04',
    title: 'Currency converter',
    notes: ['A currency converter in More, using the latest rates.'],
  },
  {
    version: '1.5.2',
    date: '2026-11-04',
    title: 'Two small gaps filled',
    notes: ['Choose which currencies to watch in Settings, and link a saving target to a split of an account.'],
  },
  {
    version: '1.5.1',
    date: '2026-11-04',
    title: 'Android update fix',
    notes: ['Fixed: an Android update could delete the files it was running from.'],
  },
  {
    version: '1.5.0',
    date: '2026-11-04',
    title: 'Splits, limits, undo and charts',
    notes: [
      'Split an account into parts (Car, Emergency…) to know what each part is for.',
      'Monthly spending limits with about how much is left per day.',
      'Undo after deleting, charts in month close, and a tidier Home.',
    ],
  },
  {
    version: '1.4.1',
    date: '2026-11-03',
    title: 'Remembered notes',
    notes: ['Notes you typed before appear in a scrolling list as you type.'],
  },
  {
    version: '1.4.0',
    date: '2026-11-03',
    title: 'Notes and a Cash group',
    notes: ['The app remembers your notes, and cash has its own group.'],
  },
  {
    version: '1.3.0',
    date: '2026-11-03',
    title: 'Updates by themselves',
    notes: ['New versions install themselves.', 'Plain buttons look tappable.'],
  },
  {
    version: '1.2.0',
    date: '2026-11-03',
    title: 'Arrange and split by item',
    notes: [
      'Arrange account and category groups in your own order.',
      'Bill split: split evenly by item, and pay for someone else.',
    ],
  },
  {
    version: '1.1.1',
    date: '2026-11-03',
    title: 'Press and hold everywhere',
    notes: ['Press and hold a row for quick actions, and pop-ups are never hidden behind the tab bar.'],
  },
  {
    version: '1.1.0',
    date: '2026-11-03',
    title: 'Bill split and Who owes me',
    notes: ['A bill can have several payers.', 'Who owes me: money lent or borrowed, with interest worked out for you.'],
  },
  {
    version: '1.0.2',
    date: '2026-11-03',
    title: 'Repeating entries fix',
    notes: ['Fixed: repeating entries starting in the future were recorded straight away.'],
  },
  {
    version: '1.0.1',
    date: '2026-11-03',
    title: 'Cleaner cards',
    notes: ['Removed the decorative corner icons.'],
  },
  {
    version: '1.0.0',
    date: '2026-11-03',
    title: 'Version 1.0',
    notes: ['A full tidy-up, easier-to-read themes and the final keypad.'],
  },
  {
    version: '0.5.0',
    date: '2026-11-03',
    title: 'Press and hold to edit',
    notes: ['Press and hold to edit, a familiar calculator keypad, and every setting visible.'],
  },
  {
    version: '0.4.0',
    date: '2026-11-03',
    title: 'Mascots',
    notes: ['Dinosaur and frog mascots, a frog theme and a cleaner layout.'],
  },
  {
    version: '0.3.0',
    date: '2026-11-03',
    title: 'Five themes',
    notes: ['Choose a theme: Financial, Cute, Fantasy, Dinosaur or Cat.'],
  },
  {
    version: '0.2.0',
    date: '2026-11-03',
    title: 'The first version',
    notes: [
      'Money Tracking for Android and iPhone, working fully offline.',
      'Accounts, cards and cash; spending, income and moves with a calculator keypad; several currencies with live rates.',
      'Repeating bills, summaries, budget plan, bill split, travel split, backups and any number of users.',
    ],
  },
];

/** Entries newer than `since` up to and including `upTo` (newest first). */
export function changesBetween(since: string, upTo: string, cmp: (a: string, b: string) => number): ChangeEntry[] {
  return CHANGELOG.filter((e) => cmp(e.version, since) > 0 && cmp(e.version, upTo) <= 0);
}
