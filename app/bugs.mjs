// Planted UI bugs. Off by default; switch on with UI_BUGS=UI-01,UI-04 (or "all").
// The server stamps the active ids on <html data-bugs="...">, and the page
// script or stylesheet changes behaviour when it sees them.
//
// scripts/bug-hunt.mjs runs the whole suite once per bug and checks it fails.

export const CATALOG = {
  "UI-01": { title: "Confirm button has no accessible name", impact: "Icon-only Confirm on the transfer review; a screen reader announces just \"button\"." },
  "UI-02": { title: "Login error text fails contrast", impact: "Light grey error message on white (about 1.9:1); hard to read for low-vision users." },
  "UI-03": { title: "Paise dropped from the amount", impact: "1500.75 is sent as 1500: the customer pays a different amount than they typed." },
  "UI-04": { title: "Mobile layout overflow", impact: "Below 600px the account cards are fixed at 520px wide; the page scrolls sideways and Transfer is pushed off-screen." },
  "UI-05": { title: "Double submit on Confirm", impact: "Confirm stays enabled and each click sends a new request: a double tap pays twice." },
  "UI-06": { title: "Failed transfer shown as success", impact: "When the transfer API errors or the network drops, the page still says \"Transfer successful\"." },
  "UI-07": { title: "Beneficiary form has no labels", impact: "Inputs use placeholder text only; screen readers can't name the fields." },
  "UI-08": { title: "Logout keeps the session", impact: "Logout only redirects; the session cookie stays valid and /dashboard opens again." },
  "UI-09": { title: "Statement uses a Chromium-only API", impact: "navigator.userAgentData is undefined in Firefox and Safari, so the statement never loads there." },
};

export function activeBugs(raw) {
  const value = (raw || "none").trim();
  if (["", "none", "off", "0"].includes(value.toLowerCase())) return new Set();
  if (value.toLowerCase() === "all") return new Set(Object.keys(CATALOG));
  const ids = value.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
  const unknown = ids.filter((id) => !CATALOG[id]);
  if (unknown.length) throw new Error(`Unknown UI bug id(s): ${unknown.join(", ")}`);
  return new Set(ids);
}
