# Bug hunt

_Last run: 2026-10-09 02:11 UTC_

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
