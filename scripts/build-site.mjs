// Builds site/index.html for GitHub Pages from reports/bug-hunt.json, and copies
// the Playwright HTML reports of the clean and all-bugs runs next to it.
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { CATALOG } from "../app/bugs.mjs";

const ROOT = new URL("..", import.meta.url).pathname;
const SITE = `${ROOT}site`;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const results = JSON.parse(readFileSync(`${ROOT}reports/bug-hunt.json`, "utf8"));
const clean = results.find((r) => r.run === "clean");
const all = results.find((r) => r.run === "all");
const bugs = results.filter((r) => r.run.startsWith("UI-"));
const caught = bugs.filter((r) => r.verdict === "CAUGHT").length;

mkdirSync(SITE, { recursive: true });
const reports = [];
for (const [run, dir, label] of [["clean", "report", "Playwright report — clean build"], ["all", "report-all-bugs", "Playwright report — every bug on"]]) {
  if (existsSync(`${ROOT}work/report-${run}/index.html`)) {
    cpSync(`${ROOT}work/report-${run}`, `${SITE}/${dir}`, { recursive: true });
    reports.push(`<a href="${dir}/index.html">${esc(label)}</a>`);
  }
}

const pill = (ok, yes, no) => `<span class="pill ${ok ? "ok" : "bad"}">${ok ? "✓" : "✗"} ${esc(ok ? yes : no)}</span>`;
const byLayer = (r) => {
  const seen = new Map();
  for (const t of r.failedTests) {
    const key = `${t.layer}|${t.title}`;
    if (!seen.has(key)) seen.set(key, { ...t, projects: [] });
    seen.get(key).projects.push(t.project);
  }
  return [...seen.values()];
};

const tiles = [
  clean && ["Clean build", `${clean.passed}/${clean.total - clean.skipped}`, `test runs pass on ${clean.projects.length} browser projects`],
  bugs.length && ["Planted UI bugs caught", `${caught}/${bugs.length}`, caught === bugs.length ? "none escaped" : "a bug escaped"],
  all && ["Every bug on", `${all.failed}`, `of ${all.total - all.skipped} test runs fail`],
  clean && ["Browsers", `${clean.projects.length}`, clean.projects.join(", ")],
].filter(Boolean);

const rows = bugs.map((r) => {
  const tests = byLayer(r);
  return `<tr><td><code>${r.run}</code></td>
    <td><strong>${esc(CATALOG[r.run].title)}</strong><div class="m">${esc(CATALOG[r.run].impact)}</div></td>
    <td>${pill(r.verdict === "CAUGHT", "caught", "escaped")}<div class="m">${esc(r.failedLayers.join(", "))}</div></td>
    <td><ul>${tests.slice(0, 4).map((t) => `<li><code>${esc(t.layer)}</code> ${esc(t.name)} <span class="m">(${esc(t.projects.join(", "))})</span></li>`).join("")}
    ${tests.length > 4 ? `<li class="m">… and ${tests.length - 4} more</li>` : ""}</ul></td></tr>`;
}).join("");

const page = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>NetBanking UI Tests</title>
<style>
:root{color-scheme:light;--bg:#f6f6f4;--card:#fcfcfb;--ink:#0b0b0b;--ink2:#52514e;--muted:#6b6a64;--line:#e4e3df;--accent:#2a78d6;
--ok:#0b7a0b;--okbg:#e3f3e3;--bad:#b42323;--badbg:#fbe7e7}
@media (prefers-color-scheme:dark){:root:where(:not([data-theme="light"])){color-scheme:dark;--bg:#121211;--card:#1a1a19;--ink:#fff;
--ink2:#c3c2b7;--muted:#9a998f;--line:#2e2e2b;--accent:#3987e5;--ok:#5fd35f;--okbg:#173317;--bad:#ff8a8a;--badbg:#3b1b1b}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:1040px;margin:0 auto;padding:32px 16px 72px}h1{font-size:26px;margin:0 0 4px}h2{font-size:18px;margin:36px 0 10px}
.sub{color:var(--ink2);max-width:780px;margin:0 0 24px}.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}
.tile{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px 16px}.k{color:var(--ink2);font-size:13px}
.v{font-size:30px;font-weight:650;font-variant-numeric:tabular-nums;margin:4px 0}.s,.m{color:var(--muted);font-size:13px}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:8px 16px;overflow-x:auto}
table{width:100%;border-collapse:collapse;font-size:14px}th,td{text-align:left;padding:10px 8px;border-bottom:1px solid var(--line);vertical-align:top}
th{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}tr:last-child td{border-bottom:0}
ul{margin:0;padding-left:16px}.pill{display:inline-block;padding:1px 8px;border-radius:99px;font-size:12px;font-weight:600;white-space:nowrap}
.ok{color:var(--ok);background:var(--okbg)}.bad{color:var(--bad);background:var(--badbg)}a{color:var(--accent)}code{font-size:13px}td:first-child code{white-space:nowrap}
</style></head><body><main>
<h1>Arya Bank NetBanking — UI test results</h1>
<p class="sub">Fictional bank, synthetic data. Playwright + TypeScript suite (Page Objects, axe-core WCAG 2.2, visual regression,
network mocking) run on desktop and mobile browsers, once against the clean app and once per planted UI bug.
Updated ${esc(new Date().toISOString().slice(0, 16).replace("T", " "))} UTC.</p>
<div class="tiles">${tiles.map(([k, v, s]) => `<div class="tile"><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div><div class="s">${esc(s)}</div></div>`).join("")}</div>
<h2>Planted UI bugs</h2>
<p class="m">A bug counts as caught when at least one test fails with only that bug switched on.</p>
<div class="card"><table><thead><tr><th>Bug</th><th>Defect</th><th>Result</th><th>Tests that caught it</th></tr></thead><tbody>${rows}</tbody></table></div>
<h2>Detailed reports</h2>
<p>${reports.join(" · ") || '<span class="m">Reports not generated in this run.</span>'}</p>
<p class="m"><a href="https://github.com/byshivam/netbanking-ui-testing">Source on GitHub</a></p>
</main></body></html>`;

writeFileSync(`${SITE}/index.html`, page);
writeFileSync(`${SITE}/.nojekyll`, "");
console.log(`wrote ${SITE}/index.html`);
