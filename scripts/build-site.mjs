// Builds the GitHub Pages site from a bug-hunt run:
//
//   site/index.html            results dashboard (bug matrix)
//   site/a11y.html             every axe scan: clean app vs every bug on
//   site/visual.html           expected / actual / diff for each visual failure, per planted bug
//   site/allure/               Allure report of the clean run, with history trend
//   site/allure-all-bugs/      Allure report of the run with every bug on
//   site/report/, site/report-all-bugs/   Playwright HTML reports
//
// Reads reports/bug-hunt.json and the per-run files in work/ written by scripts/bug-hunt.mjs.
import { spawnSync } from "node:child_process";
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { CATALOG } from "../app/bugs.mjs";

const ROOT = new URL("..", import.meta.url).pathname;
const SITE = `${ROOT}site`;
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const pill = (ok, yes, no) => `<span class="pill ${ok ? "ok" : "bad"}">${ok ? "✓" : "✗"} ${esc(ok ? yes : no)}</span>`;
const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");

const results = JSON.parse(readFileSync(`${ROOT}reports/bug-hunt.json`, "utf8"));
const clean = results.find((r) => r.run === "clean");
const all = results.find((r) => r.run === "all");
const bugs = results.filter((r) => r.run.startsWith("UI-"));
const caught = bugs.filter((r) => r.verdict === "CAUGHT").length;
mkdirSync(SITE, { recursive: true });

// ---------------------------------------------------------------- shared page shell

const CSS = `
:root{color-scheme:light;--bg:#f6f6f4;--card:#fcfcfb;--ink:#0b0b0b;--ink2:#52514e;--muted:#6b6a64;--line:#e4e3df;--accent:#2a78d6;
--ok:#0b7a0b;--okbg:#e3f3e3;--bad:#b42323;--badbg:#fbe7e7;--warn:#8a5a00;--warnbg:#fdf2d8}
@media (prefers-color-scheme:dark){:root:where(:not([data-theme="light"])){color-scheme:dark;--bg:#121211;--card:#1a1a19;--ink:#fff;
--ink2:#c3c2b7;--muted:#9a998f;--line:#2e2e2b;--accent:#3987e5;--ok:#5fd35f;--okbg:#173317;--bad:#ff8a8a;--badbg:#3b1b1b;--warn:#f2c066;--warnbg:#3a2f15}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:1080px;margin:0 auto;padding:24px 16px 72px}h1{font-size:26px;margin:0 0 4px}h2{font-size:18px;margin:36px 0 10px}h3{font-size:15px;margin:20px 0 8px}
nav.top{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 24px}nav.top a{padding:6px 12px;border:1px solid var(--line);border-radius:99px;text-decoration:none;color:var(--ink2);font-size:14px;background:var(--card)}
nav.top a[aria-current=page]{background:var(--ink);color:var(--bg);border-color:var(--ink)}
.sub{color:var(--ink2);max-width:800px;margin:0 0 24px}.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}
.tile{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px 16px}.k{color:var(--ink2);font-size:13px}
.v{font-size:30px;font-weight:650;font-variant-numeric:tabular-nums;margin:4px 0}.s,.m{color:var(--muted);font-size:13px}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:8px 16px;overflow-x:auto}
table{width:100%;border-collapse:collapse;font-size:14px}th,td{text-align:left;padding:10px 8px;border-bottom:1px solid var(--line);vertical-align:top}
th{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}tr:last-child td{border-bottom:0}td.n{text-align:right;font-variant-numeric:tabular-nums}
ul{margin:0;padding-left:16px}.pill{display:inline-block;padding:1px 8px;border-radius:99px;font-size:12px;font-weight:600;white-space:nowrap}
.ok{color:var(--ok);background:var(--okbg)}.bad{color:var(--bad);background:var(--badbg)}.warn{color:var(--warn);background:var(--warnbg)}
a{color:var(--accent)}code{font-size:13px}td:first-child code{white-space:nowrap}
.links{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px}.links a{display:block;background:var(--card);border:1px solid var(--line);
border-radius:10px;padding:12px 14px;text-decoration:none;color:var(--ink)}.links a span{display:block;color:var(--muted);font-size:13px}
.shots{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:8px 0 20px}.shots figure{margin:0;background:var(--card);border:1px solid var(--line);border-radius:8px;padding:8px}
.shots img{width:100%;height:auto;display:block;border-radius:4px;background:#fff}.shots figcaption{font-size:12px;color:var(--muted);margin-top:6px;text-transform:uppercase;letter-spacing:.04em}
@media (max-width:640px){.shots{grid-template-columns:1fr}}
`;

const PAGES = [["index.html", "Results"], ["a11y.html", "Accessibility"], ["visual.html", "Visual diffs"]];
const shell = (file, title, body) => `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${CSS}</style></head><body><main>
<nav class="top" aria-label="Report pages">${PAGES.map(([f, l]) => `<a href="${f}"${f === file ? ' aria-current="page"' : ""}>${l}</a>`).join("")}</nav>
${body}
<p class="m" style="margin-top:32px">Updated ${esc(stamp)} UTC · <a href="https://github.com/byshivam/netbanking-ui-testing">Source on GitHub</a></p>
</main></body></html>`;

// ---------------------------------------------------------------- reading the Playwright JSON reports

function loadRun(run) {
  const f = `${ROOT}work/${run}.json`;
  if (!existsSync(f)) return [];
  const out = [];
  const walk = (suite, path) => {
    const here = suite.title && suite.title !== suite.file ? [...path, suite.title] : path;
    for (const spec of suite.specs || []) {
      for (const t of spec.tests) {
        const last = t.results.at(-1) || {};
        out.push({ file: spec.file, title: spec.title, describe: here.slice(1).join(" › "), project: t.projectName,
          status: t.status === "skipped" ? "skipped" : last.status, attachments: last.attachments || [] });
      }
    }
    for (const child of suite.suites || []) walk(child, here);
  };
  for (const s of JSON.parse(readFileSync(f, "utf8")).suites || []) walk(s, []);
  return out;
}

// ---------------------------------------------------------------- Allure + Playwright reports

const links = [];
function allure(run, dir, label, useHistory) {
  const resultsDir = `${ROOT}work/allure-${run}`;
  if (!existsSync(resultsDir)) return;
  const args = ["allure", "generate", resultsDir, "-o", `${SITE}/${dir}`, "--name", label];
  // the clean run uses allurerc.mjs (history trend); the all-bugs run is generated outside it, without history
  const proc = spawnSync("npx", args, { cwd: useHistory ? ROOT : `${ROOT}work`, stdio: "inherit" });
  if (proc.status === 0) links.push([`${dir}/index.html`, label, useHistory ? "Allure, with run-to-run trend" : "Allure, every planted bug on"]);
}
allure("clean", "allure", "Allure report — clean app", true);
allure("all", "allure-all-bugs", "Allure report — every bug on", false);
for (const [run, dir, label] of [["clean", "report", "Playwright report — clean app"], ["all", "report-all-bugs", "Playwright report — every bug on"]]) {
  if (existsSync(`${ROOT}work/report-${run}/index.html`)) {
    cpSync(`${ROOT}work/report-${run}`, `${SITE}/${dir}`, { recursive: true });
    links.push([`${dir}/index.html`, label, "traces, screenshots, steps"]);
  }
}

// ---------------------------------------------------------------- index.html

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
  clean && ["Clean app", `${clean.passed}/${clean.total - clean.skipped}`, `test runs pass on ${clean.projects.length} browser projects`],
  bugs.length && ["Planted UI bugs caught", `${caught}/${bugs.length}`, caught === bugs.length ? "none escaped" : "a bug escaped"],
  all && ["Every bug on", `${all.failed}`, `of ${all.total - all.skipped} test runs fail`],
  clean && ["Browsers", `${clean.projects.length}`, clean.projects.join(", ")],
].filter(Boolean);
const bugRows = bugs.map((r) => {
  const tests = byLayer(r);
  return `<tr><td><code>${r.run}</code></td>
    <td><strong>${esc(CATALOG[r.run].title)}</strong><div class="m">${esc(CATALOG[r.run].impact)}</div></td>
    <td>${pill(r.verdict === "CAUGHT", "caught", "escaped")}<div class="m">${esc(r.failedLayers.join(", "))}</div></td>
    <td><ul>${tests.slice(0, 4).map((t) => `<li><code>${esc(t.layer)}</code> ${esc(t.name)} <span class="m">(${esc(t.projects.join(", "))})</span></li>`).join("")}
    ${tests.length > 4 ? `<li class="m">… and ${tests.length - 4} more</li>` : ""}</ul></td></tr>`;
}).join("");

writeFileSync(`${SITE}/index.html`, shell("index.html", "NetBanking UI Tests", `
<h1>Arya Bank NetBanking — UI test results</h1>
<p class="sub">Fictional bank, synthetic data. Playwright + TypeScript suite (Page Objects, axe-core WCAG 2.2, visual regression,
network mocking) on desktop and mobile browsers, run once against the clean app and once per planted UI bug.</p>
<div class="tiles">${tiles.map(([k, v, s]) => `<div class="tile"><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div><div class="s">${esc(s)}</div></div>`).join("")}</div>
<h2>Reports</h2>
<div class="links">${links.map(([href, label, note]) => `<a href="${href}">${esc(label)}<span>${esc(note)}</span></a>`).join("") || '<span class="m">No reports in this run.</span>'}</div>
<h2>Planted UI bugs</h2>
<p class="m">A bug counts as caught when at least one test fails with only that bug switched on.</p>
<div class="card"><table><thead><tr><th>Bug</th><th>Defect</th><th>Result</th><th>Tests that caught it</th></tr></thead>
<tbody>${bugRows || '<tr><td colspan="4" class="m">No bug runs yet.</td></tr>'}</tbody></table></div>`));

// ---------------------------------------------------------------- a11y.html

function axeScans(run) {
  return loadRun(run)
    .filter((t) => t.file.includes("a11y") && t.status !== "skipped")
    .flatMap((t) => {
      const a = t.attachments.find((x) => x.name === "axe-violations.json" && x.body);
      if (!a) return [];
      return [{ screen: t.title, project: t.project, violations: JSON.parse(Buffer.from(a.body, "base64").toString("utf8")) }];
    });
}
const IMPACT = { critical: "bad", serious: "bad", moderate: "warn", minor: "warn" };
function a11ySection(run, heading, note) {
  const scans = axeScans(run);
  if (!scans.length) return "";
  const failing = scans.filter((s) => s.violations.length);
  const screens = [...new Set(scans.map((s) => s.screen))];
  const matrix = screens.map((screen) => {
    const row = scans.filter((s) => s.screen === screen);
    const total = row.reduce((n, s) => n + s.violations.length, 0);
    const rules = [...new Set(row.flatMap((s) => s.violations.map((v) => v.rule)))];
    return `<tr><td>${esc(screen)}</td><td>${pill(total === 0, "no violations", `${total} violation${total === 1 ? "" : "s"}`)}</td>
      <td>${rules.map((r) => `<code>${esc(r)}</code>`).join(" ") || '<span class="m">—</span>'}</td>
      <td class="m">${esc(row.map((s) => s.project).join(", "))}</td></tr>`;
  }).join("");
  const seen = new Set();
  const details = failing.flatMap((s) => s.violations.map((v) => ({ ...v, screen: s.screen, project: s.project })))
    .filter((v) => !seen.has(`${v.screen}|${v.rule}`) && seen.add(`${v.screen}|${v.rule}`))
    .map((v) => `<tr><td><code>${esc(v.rule)}</code></td><td><span class="pill ${IMPACT[v.impact] || "warn"}">${esc(v.impact)}</span></td>
      <td>${esc(v.help)}<div class="m">${esc(v.screen)} · ${esc((v.targets || []).join(", "))}</div></td></tr>`).join("");
  return `<h2>${esc(heading)}</h2><p class="m">${esc(note)} ${scans.length} scans, ${failing.length} with violations.</p>
    <div class="card"><table><thead><tr><th>Screen / state</th><th>Result</th><th>Rules broken</th><th>Browsers scanned</th></tr></thead><tbody>${matrix}</tbody></table></div>
    ${details ? `<h3>Violations</h3><div class="card"><table><thead><tr><th>Rule</th><th>Impact</th><th>What to fix</th></tr></thead><tbody>${details}</tbody></table></div>` : ""}`;
}
writeFileSync(`${SITE}/a11y.html`, shell("a11y.html", "Accessibility — NetBanking UI Tests", `
<h1>Accessibility</h1>
<p class="sub">axe-core scans against WCAG 2.0, 2.1 and 2.2 at levels A and AA, on every screen and error state. The clean app must have zero
violations; with every planted bug on, the accessibility bugs (UI-01 unnamed button, UI-02 low contrast) show up here.
Missing form labels (UI-07) are caught by a separate label check, because axe accepts a placeholder as a field's name.</p>
${a11ySection("clean", "Clean app", "Every screen should be clean.")}
${a11ySection("all", "Every planted bug on", "What a release with these defects would ship.")}`));

// ---------------------------------------------------------------- visual.html

const shotsDir = `${SITE}/visual`;
mkdirSync(shotsDir, { recursive: true });
function visualFailures(run) {
  return loadRun(run).filter((t) => t.file.includes("visual") && t.status !== "passed" && t.status !== "skipped").map((t) => {
    const pick = (suffix) => t.attachments.find((a) => a.path && a.name.endsWith(`-${suffix}.png`));
    const files = {};
    for (const kind of ["expected", "actual", "diff"]) {
      const a = pick(kind);
      if (a && existsSync(a.path)) {
        const name = `${run}-${t.project}-${basename(a.path)}`.replace(/[^\w.-]/g, "_");
        copyFileSync(a.path, `${shotsDir}/${name}`);
        files[kind] = `visual/${name}`;
      }
    }
    return { ...t, files };
  }).filter((t) => Object.keys(t.files).length);
}
const visualRuns = [...bugs.map((b) => b.run), "all"].map((run) => [run, visualFailures(run)]).filter(([, f]) => f.length);
const gallery = visualRuns.map(([run, fails]) => `
  <h2>${run === "all" ? "Every bug on" : `${esc(run)} — ${esc(CATALOG[run].title)}`}</h2>
  ${run === "all" ? "" : `<p class="m">${esc(CATALOG[run].impact)}</p>`}
  ${fails.map((t) => `<h3>${esc(t.title)} <span class="m">· ${esc(t.project)}</span></h3>
    <div class="shots">${["expected", "actual", "diff"].map((k) => t.files[k]
      ? `<figure><a href="${t.files[k]}"><img src="${t.files[k]}" alt="${esc(`${t.title}, ${t.project}: ${k}`)}" loading="lazy"></a><figcaption>${k}</figcaption></figure>`
      : "").join("")}</div>`).join("")}`).join("");
writeFileSync(`${SITE}/visual.html`, shell("visual.html", "Visual diffs — NetBanking UI Tests", `
<h1>Visual diffs</h1>
<p class="sub">Screenshots that changed when a planted bug was switched on: the committed baseline, what the browser rendered, and
the pixel diff (changed pixels in red). Baselines are taken in the Playwright Docker image, so fonts and rendering match every run.</p>
${gallery || '<p class="m">No visual differences in this run.</p>'}`));

writeFileSync(`${SITE}/.nojekyll`, "");
console.log(`wrote ${SITE}: index.html, a11y.html, visual.html${links.length ? `, ${links.map(([h]) => h.split("/")[0]).join(", ")}` : ""}`);
