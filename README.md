# Money Tracking 🧚

A friendly money tracker with six themes for logging day to day on the phone, fully offline, ready to copy into a monthly spreadsheet.

- **Android:** a real app (APK) from this repo's Releases page. It updates itself.
- **iPhone:** a web app you add to the Home Screen. Works offline after the first visit.

Everything you type stays on your phone. Nothing is sent anywhere except requests for exchange rates, the BTC price and the Thai gold price.

---

## Install

### Android

1. On the phone, open **https://github.com/popo54321/Money-Tracking/releases/latest**.
2. Download `MoneyTracking-x.y.z.apk` and open it.
3. Android asks to allow installing from your browser or Files app. Allow it once, then tap **Install**.

**Updating:** it updates itself. From version 1.3.0 the app downloads new versions from the web app's site and switches to them when nothing is open (just opened, or when you leave the app). No reinstall, and your data stays. Only when the Android part itself changes does a banner ask you to tap **Install** (Android always asks for that). To check by hand: **More → Settings → Updates**.

How it works: each build writes `version.json` (the version, the oldest Android app it runs in, and every file with its size). Raise `config.minNativeVersion` in `package.json` whenever `android/` or a Capacitor plugin changes, so older Android apps install the new APK instead. If new files ever fail to start twice, the app goes back to the files it had and stops trying that build.

### iPhone

1. In **Safari**, open **https://popo54321.github.io/Money-Tracking/**.
2. Tap **Share → Add to Home Screen**.
3. Always open it from the Home Screen icon. iPhone keeps the Home Screen app's data separate from Safari tabs.

**Updating:** it updates itself. A new version switches in when the app is opened or left with nothing open, so nothing you are typing is lost.

---

## What it does

| Area | What you get |
|---|---|
| **Entries** | Spend / income / move money with a phone-style calculator (`(120+80)×2`), any currency (converted with live rates), your own categories |
| **Accounts** | Bank, cash, debit, credit card, top-up card, investments, BTC, gold, insurance: add, edit, archive, reorder; BTC and gold sit in their own Wealth preserve group |
| **Set new balance** | Type the new total; choose **just adjust** or **log the difference as income/spending** (for example Interest) |
| **Credit cards** | Statement day, due day, credit limit, paying account, amount still to pay, **Pay now**; everything owed (statement plus spending since) is kept ready in the paying account |
| **Repeating** | Daily / weekly / monthly / yearly (every N); recorded automatically on the day; the next payment is **kept ready** (reserved) in its account |
| **Wealth preserve** | BTC (amount × live price) and Thai gold in baht-weight (ทองบาทละ, live 96.5% bar price), cost, average cost and profit |
| **Summary** | Income and spending by category and group, per month, year or dates, with the change against all of last month (or last year) |
| **Month close** | Opens on the current month (numbers so far), in the year sheet's order, each category with its share of spending or income (and spending as % of income), tap to copy, or export to Excel / CSV; foldable charts of income against spending (6 months) and net worth (12 months) |
| **Budget plan** | Any number of phases, bonus split, leftover-money rule, monthly transfer checklist; can **import a Budget Allocation sheet** from an `.xlsx` workbook |
| **Bill split** | Own orders, shared items split between only the people ticked, service charge, VAT and tip (any %, on the food or the whole bill, rounded up to ฿10–100 if wanted, shown on its own) by share, “treat” someone to the charges, split evenly (food shared by all, drinks only by who had them), one person pays for others (e.g. his wife); one or several payers (by amount or %); fewest payments to settle; add what friends owe you to Who owes me |
| **Travel split** | Any number of travellers, any currencies at trip rates, personal / everyone / some, fewest payments to settle up; add what's owed to Who owes me |
| **Currency converter** | Any amount between any two currencies (and BTC), swap, the same amount in your other currencies and gold, tap to copy; works offline with the last saved rates |
| **Who owes me** | Loans either way, repayments, simple or monthly-compounding interest worked out to today |
| **Saving targets** | Wishlist with price and a monthly saving added by itself on the day you choose; a record only (spending never changes it); can be kept in an account, starting from 0 or from part of what is there; the page shows how each account is split between its targets and What's left |
| **Press and hold** | Hold a category, entry, account, user or Month close row to edit it (entries also offer Duplicate and Delete) |
| **Themes** | Financial (plain and serious), Cute, Fantasy, Dinosaur, Cat and Frog, each in light and dark; pick one in Settings |
| **Remembered notes** | While typing a note, earlier notes that start the same way drop up in a scrolling list (capitals ignored, Coffee = coffee). Tapping one fills in only the words |
| **Splits** | Split an account into parts (Car, Emergency…) plus What's left; budget transfers fill their linked split when ticked and are taken back when unticked; when spending, choose how much comes from each split |
| **Monthly limits** | Optional, per category or group: Home shows what is left and about how much a day |
| **Home** | Fold Scheduled; this month's entries with ‹ › for other months; price strip with BTC, gold and any currencies you watch (add or remove them there or in Settings → Live prices) |
| **Vibration** | A light buzz on each calculator key and on press and hold (Android; switch off in Settings → Theme) |
| **Liquid money** | Tick which accounts are spendable now; Home and Accounts show net worth and the liquid part (bank, cash and cards by default) |
| **Undo** | Every delete shows Undo for a few seconds |
| **Arrange** | Move whole groups (e.g. Credit or Fixed to the top) and items inside them: Categories page, and Accounts → Arrange |
| **Users** | Add as many as you like (User 1, User 2…), each with separate accounts, entries and categories |
| **Backup** | Save a backup file (Drive, email, Files), restore it, export all entries; Android also keeps a daily copy in `Documents/MoneyTracking` |

---

## One-time setup (repository owner)

### 1. Android signing key (needed before the first release)

Android only installs an update over the existing app when both are signed with the same key. The key must stay secret, so it lives in GitHub's encrypted secrets, not in this repo.

In **Settings → Secrets and variables → Actions → New repository secret**, add:

| Name | Value |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | the key file as base64 text |
| `ANDROID_KEYSTORE_PASSWORD` | its password |

Keep a copy of both somewhere safe, such as a password manager. Without them, future updates can't install over the app.

Without these secrets the workflow still builds a test APK (under the run's **Artifacts**) but doesn't publish a release.

### 2. GitHub Pages (for the iPhone web app)

**Settings → Pages → Build and deployment → Source: GitHub Actions.** The web app publishes on each push to `main`.

---

## Releasing a new version

1. Raise `version` in `package.json` (for example `0.1.0` → `0.2.0`).
2. Push.

On `main`, the **Android app** workflow builds a signed APK and publishes release `v0.2.0`. The app's Update button finds it. The **Web app** workflow refreshes the iPhone version from `main`.

## Developing

```bash
npm ci
npm run dev        # http://localhost:5173
npm run check      # type check, formatting check and calculation tests
npm run format     # tidy the code formatting
npm run build      # web app in dist/
npx cap sync android && (cd android && ./gradlew assembleDebug)   # Android APK
```

The code is laid out as follows:

- `src/domain/`: the maths (balances, repeating dates, credit cards, splits, interest, budget, wealth), all with tests.
- `src/db/`: storage on the device (IndexedDB).
- `src/services/`: prices, backup, export, workbook import and updates.
- `src/screens/` and `src/components/`: the screens and shared building blocks.
- `src/styles/`: `themes.css` (colours for every theme), `base.css` (layout), `skins.css` (theme-only touches).
- `src/ui/`: theme definitions (`skins.ts`), icons and the drawn dino and frog mascots.
