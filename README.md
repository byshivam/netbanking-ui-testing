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
_Results appear here after the first scheduled or manual CI run._
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
scripts/build-site.mjs  dashboard for GitHub Pages
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

`.github/workflows/ui-tests.yml` runs in the official Playwright Docker image on every push and PR, and daily at 03:37 IST: type check, bug hunt (all five projects for the clean and all-bugs runs; Chromium, Firefox and Pixel 7 for single-bug runs), dashboard and Playwright report to GitHub Pages. Visual baselines are created on the first run and committed; re-create them with the `update_snapshots` option of a manual run after an intended UI change.
