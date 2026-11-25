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
    version: '1.29.1',
    date: '2026-11-25',
    title: 'Sharing and tour fixes',
    notes: [
      'Shared accounts: entries written by another person under a second user on their phone now show (and count) on yours.',
      'Sharing many entries at once no longer fails; syncing asks the service fewer questions, so it is quicker.',
      'Erasing your data on a linked phone no longer removes your entries from shared accounts on the other phones.',
      'Will my money be enough?: your own numbers always come back after the tour, even if the app was closed during it. While looking at someone else’s money, its button no longer fills their money into your calculator.',
      'The user switcher’s family list updates straight away after joining or leaving a family.',
    ],
  },
  {
    version: '1.29.0',
    date: '2026-11-25',
    title: 'A tour with example money',
    notes: [
      'How to use now runs on example money (Alex, made up) so every screen is filled in, and goes much deeper: inside an account and a card statement, an entry with money back, limits, payday, every part of a dinner bill split and a trip, a person in Who owes me, each part of the Budget plan, saving targets, investments and Bitcoin, shared accounts and Family view.',
      'Will my money be enough? gets example numbers during the tour, and your own come back after.',
      'Your own money is never touched: the example is read-only, and ending the tour (or “End tour”) brings yours straight back.',
    ],
  },
  {
    version: '1.28.1',
    date: '2026-11-25',
    title: 'Tour of Will my money be enough?',
    notes: [
      'How to use has a new part, 🔭 Will my money be enough?: it walks through the calculator itself, pointing at each box (Pot today, investing, growth, ages, spending), your money today, the life checklist and insurance, your result and adventurer, and every Details section.',
    ],
  },
  {
    version: '1.28.0',
    date: '2026-11-25',
    title: 'Family view',
    notes: [
      'See another phone’s whole money, read-only, like switching user: Family sharing → 👀 See their money, or pick them in the user switcher at the top. Accounts, entries, Summary, Budget plan, targets, investments, Bill split and Trip split are all there; nothing can be changed. “Back to mine” returns to your own.',
      'The family’s owner decides who can see whose money: 👥 Who can see, next to each phone. Everyone can see everyone to start with.',
      'Each phone now sends its data a few minutes after a change, so what others see stays fresh.',
      'Shared accounts are marked in the Accounts list (Shared, or From who). Any phone can share its own accounts and cards, like a spare card for a child.',
      'Fixes: stopping sharing no longer removes the other person’s entries; a shared account must stop sharing before its currency changes; a failed family backup waits before trying again; erasing data on a linked phone no longer brings its shared entries back.',
    ],
  },
  {
    version: '1.27.1',
    date: '2026-11-25',
    title: 'Repayments from the list',
    notes: [
      'Who owes me: holding a person and choosing “💰 Add repayment” now opens the full Paid back sheet, filled with what is owed, so it can go into your money as money back or income.',
    ],
  },
  {
    version: '1.27.0',
    date: '2026-11-25',
    title: 'Shared accounts and family backup',
    notes: [
      'Share an account with your family: open it → ✏️ Edit → Share with family, and tick the phones. It appears on their phones and counts in full in everyone’s net worth.',
      'Everyone sees every entry on a shared account and can add their own. Each person can only change or delete their own entries; others’ show who added them.',
      'Others’ spending on a shared account changes its balance but not your own income, spending or limits.',
      'It keeps itself in step while the app is open (and Sync now in Family sharing). A removed phone loses shared accounts straight away.',
      'Family backup: every linked phone keeps a copy of all its data with the family. Lost a phone? On another phone tap 🆘 Lost next to it, then type the code on the new phone: it gets the old phone’s place, role and data back, and the lost phone is shut out.',
    ],
  },
  {
    version: '1.26.1',
    date: '2026-11-25',
    title: 'A fuller How to use',
    notes: [
      'How to use now covers every part: entries and money back, limits, repeating bills and payday, Bill split, Trip split, Who owes me, Budget plan, Saving targets, Investments, Bitcoin and gold, Family sharing, and backup.',
      'More → How to use asks what you want to learn: the whole tour, or just one part.',
      'Family sharing: tap the invite code itself to copy it.',
    ],
  },
  {
    version: '1.26.0',
    date: '2026-11-25',
    title: 'Family sharing: link phones',
    notes: [
      'Settings → Family sharing: start a family on one phone, then link up to 10 phones with a one-time code (it lasts 15 minutes).',
      'The phone that starts it is the owner: it makes codes and can remove phones. A removed phone loses access straight away.',
      'Each phone has a name so everyone knows who is who. A phone that joined can leave; the owner can end the family.',
      'Nothing is shared yet: choosing accounts to share comes in the next update. Backups never carry this phone’s link.',
    ],
  },
  {
    version: '1.25.3',
    date: '2026-11-25',
    title: 'Scrolling fix',
    notes: [
      'Fixed: after updating a value (or using any pop-up with a calculator inside), the page sometimes stopped scrolling until the app was restarted.',
    ],
  },
  {
    version: '1.25.2',
    date: '2026-11-25',
    title: 'Change an account’s currency',
    notes: [
      'Accounts with entries can now change currency (e.g. Dime from THB to USD): tap Currency in Edit, pick the new one and confirm what it is worth.',
      'Every amount in that account is converted at that rate: starting balance, entries, repeating entries, splits, capital and linked targets.',
      'Other accounts and past totals stay the same, and a safety copy is kept so you can undo it from Settings.',
    ],
  },
  {
    version: '1.25.1',
    date: '2026-11-25',
    title: 'Fill the pot in one tap',
    notes: [
      'Will my money be enough?: a new button at the top puts what Investments & wealth is worth (funds, stocks, BTC and gold) into “Pot today”.',
    ],
  },
  {
    version: '1.25.0',
    date: '2026-11-25',
    title: 'Investments & wealth',
    notes: [
      'Wealth preserve is now Investments & wealth: your funds and stock accounts sit with Bitcoin and gold, with one total at the top.',
      'Each investment account shows what you put in (capital), what it is worth now and the profit. Tap 📈 Value to update what it is worth, and 💰 to set the capital.',
      'Money moved in adds to both capital and value. Dividends and interest count as profit.',
      'Money moved out takes capital out in the same share as value (the average-cost method), so your profit % stays true. Profit that left with it shows as “profit taken out”.',
      'Other accounts, like a unit-linked insurance, can join with “Show in Investments” in Edit.',
    ],
  },
  {
    version: '1.24.0',
    date: '2026-11-25',
    title: 'Overall capital',
    notes: [
      'Wealth preserve: tap “Paid (capital)” to type the total you’ve paid for all your Bitcoin (or all your gold), whatever wallets it sits in.',
      'From then on, money moved in (buying more, budget moves into Bitkub) is added to it by itself. Selling takes off its share.',
      'Moving between your own wallets, like Bitkub to Trezor, doesn’t change it. Profit and average cost follow the new capital.',
    ],
  },
  {
    version: '1.23.6',
    date: '2026-11-25',
    title: 'Budget moves into Bitcoin',
    notes: [
      'Budget plan: “Record ticked” now records moves into an account in another currency, like baht into Bitkub (BTC).',
      'What arrives is worked out at today’s price. Tap the move afterwards to put the exact amount you got.',
      'No more “recorded already” message when a move was really skipped.',
    ],
  },
  {
    version: '1.23.5',
    date: '2026-11-24',
    title: 'Type over amounts',
    notes: [
      'Changing an amount that is already there: the first number you type now replaces it, no need to press C first.',
      'Start with + − × or ÷ instead to add to it, e.g. 500 then + 120. ⌫ still deletes one digit at a time.',
      'The same happens after =: typing a new number starts again.',
    ],
  },
  {
    version: '1.23.4',
    date: '2026-11-18',
    title: 'Balance in Edit',
    notes: [
      'The “Set new balance” button is gone from the account page. Tap ✏️ Edit: the balance now sits at the top, ready to change.',
      'Type the new total and choose if the difference is just a correction, or income or spending, as before.',
      'Cash and top-up cards with other currencies show a balance for each one. Cards show the amount owed.',
    ],
  },
  {
    version: '1.23.3',
    date: '2026-11-16',
    title: 'Trip split',
    notes: [
      'Travel split is now Trip split: for trips, days out and anything you do with a group.',
      'The people on a trip are “People” instead of “Travellers”.',
    ],
  },
  {
    version: '1.23.2',
    date: '2026-11-16',
    title: 'Trip bills on their own days',
    notes: [
      'Travel split: “Log the bills I paid” now logs each bill you paid as its own spending, on the day set on the bill.',
      'Each entry is named after its bill, like “Hotel · Xiamen trip”. Tap one to change its category, card or amount.',
      'Bills with no day go in on the day you log them. Bills already logged are skipped, so logging again only adds new ones.',
    ],
  },
  {
    version: '1.23.1',
    date: '2026-11-16',
    title: 'Clearer payback names',
    notes: [
      'What a friend owes from a bill or trip split now reads “Alex payback for Lunch out” in Who owes me.',
      'Their payback, logged in your money, uses the same name instead of just the bill or trip name.',
    ],
  },
  {
    version: '1.23.0',
    date: '2026-11-16',
    title: 'Money back',
    notes: [
      'Paid for friends, or got a refund? Hold a spending and pick “💸 Got money back”, or tap it and use “＋ Got money back”.',
      'Money back isn’t income: it takes the amount off that spending’s category in the month it arrives, so your limit gets the room back.',
      'If more comes back than you spent that month, the limit is raised for that month only. The next month starts from the limit you set.',
      'Who owes me: a payback can be logged as money back on a category, or as income.',
      'Bill split: “I paid it all” logs the whole bill and adds what friends owe to Who owes me. Their paybacks come off that spending.',
      'Travel split: “Log what I paid” does the same for a trip.',
    ],
  },
  {
    version: '1.22.2',
    date: '2026-11-15',
    title: 'Settle bills and trips',
    notes: [
      'Bill split and Travel split can be marked as settled (on the bill or trip, or press and hold it in the list). Settled ones are hidden until Show settled, like Who owes me.',
    ],
  },
  {
    version: '1.22.1',
    date: '2026-11-15',
    title: 'Plainer debt summaries',
    notes: [
      'Debt summaries show each item as its day, what it was for and the amount; paybacks show as “Paid back” with a minus.',
    ],
  },
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
