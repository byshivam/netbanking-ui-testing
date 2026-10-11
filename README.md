# netbanking-ui-testing

Playwright + TypeScript test suite for a fictional **Arya Bank** net banking web app, with planted UI bugs the suite has to catch.

The app is built in this repo (plain HTML/JS + a small Node server, no framework) so every layer is under control: data, network, layout, accessibility. Same fictional bank as [payments-api-testing](https://github.com/byshivam/payments-api-testing), [banking-data-quality](https://github.com/byshivam/banking-data-quality) and [banking-rag-eval](https://github.com/byshivam/banking-rag-eval). All data is synthetic.

**Live dashboard and Playwright report:** https://byshivam.github.io/netbanking-ui-testing/

| Layer | How | What it proves |
|---|---|---|
| E2E | Playwright, Page Object Model, role/label locators | Login, lockout, session, transfer with paise, validation, beneficiaries, statement filters |
| Accessibility | `@axe-core/playwright` (WCAG 2.0–2.2 A/AA) + custom checks | No violations on any screen or error state; every field has a real label; a transfer works keyboard-only |
| Visual regression | `toHaveScreenshot` in the Playwright Docker image | Login, dashboard, transfer review and statement look the same, desktop and mobile |
| Cross-browser & mobile | Chromium, Firefox, WebKit, Pixel 7, iPhone 14 | Same behaviour everywhere; no sideways scrolling; 44px tap targets |
| Network | `page.route` | Server 500, dropped connection, slow API, retries that must not pay twice |

## Results

<!-- RESULTS:START -->
_Last run: 2026-10-11 01:07 UTC_

**Clean build:** 325/325 test runs pass across 5 browser projects (chromium, firefox, webkit, mobile-chrome, mobile-safari); 3 skipped by design.  
**Planted UI bugs caught:** 9/9.  
**Release candidate with every bug on:** 105 of 325 tests fail.  

| Bug | What it does | Result | Caught by | Browsers | Failing tests |
|---|---|---|---|---|---|
| UI-01 | Confirm button has no accessible name | ✅ caught | Accessibility, Visual, Network, E2E | chromium, firefox, mobile-chrome | 30 |
| UI-02 | Login error text fails contrast | ✅ caught | Accessibility | chromium, firefox, mobile-chrome | 3 |
| UI-03 | Paise dropped from the amount | ✅ caught | Accessibility, E2E | chromium, firefox, mobile-chrome | 8 |
| UI-04 | Mobile layout overflow | ✅ caught | Visual, Responsive, E2E | mobile-chrome | 4 |
| UI-05 | Double submit on Confirm | ✅ caught | Network, E2E | chromium, firefox, mobile-chrome | 9 |
| UI-06 | Failed transfer shown as success | ✅ caught | Network, E2E | chromium, firefox, mobile-chrome | 12 |
| UI-07 | Beneficiary form has no labels | ✅ caught | Accessibility, E2E | chromium, firefox, mobile-chrome | 12 |
| UI-08 | Logout keeps the session | ✅ caught | E2E | chromium, firefox, mobile-chrome | 3 |
| UI-09 | Statement uses a Chromium-only API | ✅ caught | Accessibility, Network, E2E | firefox | 8 |

<details><summary>Which tests caught which bug</summary>

**UI-01 — Confirm button has no accessible name.** Icon-only Confirm on the transfer review; a screen reader announces just "button".

- `Accessibility` Accessibility (WCAG 2.2 AA) › transfer review step _(chromium, firefox, mobile-chrome)_
- `Accessibility` Accessibility (WCAG 2.2 AA) › a transfer can be completed with the keyboard only _(chromium, firefox)_
- `E2E` Statement › a new transfer shows up in the statement _(chromium, firefox, mobile-chrome)_
- `E2E` Send money › transfer with paise: review, confirm, and the exact amount leaves the account _(chromium, firefox, mobile-chrome)_
- `E2E` Send money › insufficient funds: clear error and no money moves _(chromium, firefox, mobile-chrome)_
- `E2E` Send money › double-clicking Confirm sends the money once _(chromium, firefox, mobile-chrome)_
- … and 5 more

**UI-02 — Login error text fails contrast.** Light grey error message on white (about 1.9:1); hard to read for low-vision users.

- `Accessibility` Accessibility (WCAG 2.2 AA) › login page showing an error _(chromium, firefox, mobile-chrome)_

**UI-03 — Paise dropped from the amount.** 1500.75 is sent as 1500: the customer pays a different amount than they typed.

- `Accessibility` Accessibility (WCAG 2.2 AA) › a transfer can be completed with the keyboard only _(chromium, firefox)_
- `E2E` Statement › a new transfer shows up in the statement _(chromium, firefox, mobile-chrome)_
- `E2E` Send money › transfer with paise: review, confirm, and the exact amount leaves the account _(chromium, firefox, mobile-chrome)_

**UI-04 — Mobile layout overflow.** Below 600px the account cards are fixed at 520px wide; the page scrolls sideways and Transfer is pushed off-screen.

- `E2E` Dashboard › quick action "Download statement" opens the right page _(mobile-chrome)_
- `Responsive` Responsive layout › /dashboard has no sideways scrolling _(mobile-chrome)_
- `Responsive` Responsive layout › dashboard quick actions are fully on screen _(mobile-chrome)_
- `Visual` Visual regression › dashboard _(mobile-chrome)_

**UI-05 — Double submit on Confirm.** Confirm stays enabled and each click sends a new request: a double tap pays twice.

- `E2E` Send money › double-clicking Confirm sends the money once _(chromium, firefox, mobile-chrome)_
- `E2E` Send money › Confirm is disabled while the transfer is being sent _(chromium, firefox, mobile-chrome)_
- `Network` Slow and failing network › retry after a failure uses the same idempotency key, so the money moves once _(chromium, firefox, mobile-chrome)_

**UI-06 — Failed transfer shown as success.** When the transfer API errors or the network drops, the page still says "Transfer successful".

- `E2E` Send money › insufficient funds: clear error and no money moves _(chromium, firefox, mobile-chrome)_
- `Network` Slow and failing network › transfer API returns 500: error shown, no success screen, no money moves _(chromium, firefox, mobile-chrome)_
- `Network` Slow and failing network › network drops during transfer: customer is told nothing was sent _(chromium, firefox, mobile-chrome)_
- `Network` Slow and failing network › retry after a failure uses the same idempotency key, so the money moves once _(chromium, firefox, mobile-chrome)_

**UI-07 — Beneficiary form has no labels.** Inputs use placeholder text only; screen readers can't name the fields.

- `Accessibility` Accessibility (WCAG 2.2 AA) › every form field has a visible label (placeholders are not labels) _(chromium, firefox, mobile-chrome)_
- `E2E` Beneficiaries › add a beneficiary using the labelled form, then pay them _(chromium, firefox, mobile-chrome)_
- `E2E` Beneficiaries › invalid account number and IFSC are flagged on the right fields _(chromium, firefox, mobile-chrome)_
- `E2E` Beneficiaries › an existing beneficiary can't be added twice _(chromium, firefox, mobile-chrome)_

**UI-08 — Logout keeps the session.** Logout only redirects; the session cookie stays valid and /dashboard opens again.

- `E2E` Login and session › logout ends the session: the dashboard no longer opens _(chromium, firefox, mobile-chrome)_

**UI-09 — Statement uses a Chromium-only API.** navigator.userAgentData is undefined in Firefox and Safari, so the statement never loads there.

- `Accessibility` Accessibility (WCAG 2.2 AA) › statement _(firefox)_
- `E2E` Statement › default view: salary account from 1 Sep to today _(firefox)_
- `E2E` Statement › September only: right rows and totals _(firefox)_
- `E2E` Statement › range boundaries are inclusive _(firefox)_
- `E2E` Statement › a period with no transactions shows an empty state _(firefox)_
- `E2E` Statement › From after To is rejected _(firefox)_
- … and 2 more

</details>
<!-- RESULTS:END -->

## Planted UI bugs

The server stamps active bugs on `<html data-bugs="...">` (`UI_BUGS=UI-03,UI-05`). `scripts/bug-hunt.mjs` reruns the suite once per bug; a bug that no test catches "escapes" and CI goes red.

| Bug | Defect | Expected to be caught by |
|---|---|---|
| UI-01 | Confirm button is icon-only, no accessible name | axe, role-based locators |
| UI-02 | Login error text fails colour contrast | axe |
| UI-03 | Paise dropped: 1500.75 is sent as 1500 | E2E balance check |
| UI-04 | Fixed-width cards overflow on phones | Responsive checks, mobile screenshot |
| UI-05 | Confirm stays enabled; a double tap pays twice | E2E double-click, network test |
| UI-06 | Failed or dropped transfer shown as "successful" | Network mocking |
| UI-07 | Beneficiary form uses placeholders instead of labels | Label check, `getByLabel` |
| UI-08 | Logout leaves the session valid | E2E session test |
| UI-09 | Statement uses `navigator.userAgentData` (Chromium-only) | Firefox and WebKit runs |

UI-09 is the reason the suite runs on more than one browser: it passes every Chromium test.

## Reporting

The nightly run publishes everything to GitHub Pages:

| Page | What it shows |
|---|---|
| **Results** | Bug matrix: which tests caught each planted bug, in which browsers |
| **Allure report (clean app)** | Every test with steps, screenshots, traces and axe output, grouped by layer; **history trend** of pass rate and duration across nightly runs (kept in `reports/allure-history.jsonl`) |
| **Allure report (every bug on)** | The same suite against a release candidate with all nine defects |
| **Accessibility** | Every axe scan by screen and browser: zero violations on the clean app, and the rules each planted bug breaks |
| **Visual diffs** | Baseline, actual and pixel-diff images for every screenshot a planted bug changed |
| **Playwright reports** | Native HTML reports with trace viewer for the clean and all-bugs runs |

## A real bug the suite found

The first mobile run failed axe's `scrollable-region-focusable` rule on the dashboard and statement: the transaction tables scroll sideways on a phone, but a keyboard user couldn't reach that scroll area. It wasn't a planted bug. The fix (`tabindex="0"`, `role="region"` and a label on the table wrapper) is in the app now.

## Project layout

```
app/
  server.mjs            Node server: pages + JSON API, in-memory synthetic data, frozen date 08 Oct 2026
  bugs.mjs              planted bug catalogue
  public/               login, dashboard, transfer, beneficiaries, statement (HTML + app.js + styles.css)
tests/
  pages/pages.ts        Page Objects
  fixtures.ts           fresh customer per test (POST /api/_test/customers) and API login
  e2e/                  login, dashboard, transfer, beneficiaries, statement
  a11y/                 axe scans, label check, keyboard-only transfer
  visual/               screenshots (+ committed baselines)
  mobile/               overflow and tap-target checks
  network/              mocked failures, slowness and retries
scripts/bug-hunt.mjs    clean + per-bug runs, README results
scripts/build-site.mjs  Pages site: results, Allure, accessibility, visual diffs
allurerc.mjs            Allure 3 settings (history file, report name)
```

## Run it locally

```bash
npm ci
npx playwright install --with-deps
npm start                                   # app on http://localhost:4173 (demo login AB10001 / Arya@2026)
npx playwright test                         # all five browser projects
npx playwright test --project=chromium      # one browser
UI_BUGS=UI-03 npx playwright test           # watch a planted bug get caught
npx playwright show-report
```

Visual baselines are created in CI inside the Playwright Docker image, so screenshots taken on another OS will differ. Run visual tests locally in the same image, or skip them with `--grep-invert @visual`.

## Design choices

- **A fresh customer per test.** Tests create their own customer through a test hook, so they never share balances and can run fully parallel in any order.
- **Role and label locators, not CSS ids.** If a button loses its accessible name, the test can't find it, just like a screen-reader user.
- **No retries.** A planted bug must fail every time; a flaky test gets fixed, not retried.
- **Frozen date and seeded data.** The app's "today" is 08 Oct 2026, so statements and screenshots are stable.

## CI

`.github/workflows/ui-tests.yml` runs in the official Playwright Docker image.

- **Every push and PR (~5 min):** type check, then the full suite against the clean app on all five browser projects.
- **Daily at 03:37 IST and on manual runs:** the full bug hunt (clean app, each planted bug, every bug on), then the dashboard and Playwright report go to GitHub Pages and the Results section above is refreshed.

Visual baselines are created on the first run and committed; re-create them with the `update_snapshots` option of a manual run after an intended UI change.
