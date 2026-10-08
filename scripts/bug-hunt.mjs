// Runs the whole Playwright suite against the app once clean and once per planted bug.
//
//   node scripts/bug-hunt.mjs                    # all projects (CI)
//   PW_PROJECTS=chromium,mobile-chrome node scripts/bug-hunt.mjs
//   node scripts/bug-hunt.mjs --update-readme
//
// clean build -> every test passes; each bug -> at least one test fails ("caught").
// Writes reports/bug-hunt.json, reports/BUG_HUNT.md and the README results block.

import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { CATALOG } from "../app/bugs.mjs";

const ROOT = new URL("..", import.meta.url).pathname;
const REPORTS = `${ROOT}reports`;
const README = `${ROOT}README.md`;
const START = "<!-- RESULTS:START -->";
const END = "<!-- RESULTS:END -->";
const args = process.argv.slice(2);
const runs = (args.find((a) => a.startsWith("--runs="))?.slice(7) || ["clean", ...Object.keys(CATALOG), "all"].join(","))
  .split(",").filter(Boolean);
// Projects for the clean and all-bugs runs (default: every project in the config) and,
// optionally, a smaller set for the single-bug runs to keep CI time down.
const projects = (process.env.PW_PROJECTS || "").split(",").filter(Boolean);
const bugProjects = (process.env.PW_BUG_PROJECTS || "").split(",").filter(Boolean);

const LAYERS = [
  ["a11y", "Accessibility"], ["visual", "Visual"], ["network", "Network"], ["mobile", "Responsive"], ["e2e", "E2E"],
];

function layerOf(file) {
  for (const [dir, name] of LAYERS) if (file.includes(`${dir}/`)) return name;
  return "Other";
}

function collect(suite, file, out, path = []) {
  const here = suite.title && suite.title !== file ? [...path, suite.title] : path;
  for (const spec of suite.specs || []) {
    for (const t of spec.tests) {
      const last = t.results.at(-1) || {};
      out.push({
        title: [...here, spec.title].join(" › "),
        name: spec.title,
        file,
        layer: layerOf(file),
        project: t.projectName,
        status: t.status === "skipped" ? "skipped" : last.status === "passed" ? "passed" : "failed",
        error: (last.error?.message || "").replace(/\u001b\[[0-9;]*m/g, "").split("\n")[0].slice(0, 200),
      });
    }
  }
  for (const child of suite.suites || []) collect(child, file, out, here);
}

function runOnce(run, port) {
  mkdirSync(`${ROOT}work`, { recursive: true });
  const json = `${ROOT}work/${run}.json`;
  const env = {
    ...process.env, UI_BUGS: run === "clean" ? "none" : run, PORT: String(port),
    PW_JSON_FILE: json, PW_HTML_DIR: `${ROOT}work/report-${run}`,
    PW_ALLURE_DIR: `${ROOT}work/allure-${run}`, PW_OUTPUT_DIR: `${ROOT}work/output-${run}`,
  };
  const started = Date.now();
  const list = run === "clean" || run === "all" ? projects : bugProjects.length ? bugProjects : projects;
  const cli = ["playwright", "test", ...list.map((p) => `--project=${p}`)];
  const proc = spawnSync("npx", cli, { cwd: ROOT, env, stdio: ["ignore", "ignore", "pipe"], encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  writeFileSync(`${ROOT}work/${run}.log`, proc.stderr || "");
  const tests = [];
  if (existsSync(json)) {
    const report = JSON.parse(readFileSync(json, "utf8"));
    for (const suite of report.suites || []) collect(suite, suite.file || suite.title, tests);
  }
  const failed = tests.filter((t) => t.status === "failed");
  return {
    run, exitCode: proc.status, durationS: Math.round((Date.now() - started) / 100) / 10,
    total: tests.length, passed: tests.filter((t) => t.status === "passed").length,
    skipped: tests.filter((t) => t.status === "skipped").length, failed: failed.length,
    failedLayers: LAYERS.map(([, n]) => n).filter((n) => failed.some((t) => t.layer === n)),
    failedProjects: [...new Set(failed.map((t) => t.project))],
    projects: [...new Set(tests.map((t) => t.project))],
    failedTests: failed,
  };
}

function verdict(r) {
  if (r.total === 0) return "ERROR";
  if (r.run === "clean") return r.failed === 0 ? "PASS" : "FALSE ALARM";
  return r.failed > 0 ? "CAUGHT" : "ESCAPED";
}

function uniqueTests(failed) {
  const seen = new Map();
  for (const t of failed) {
    const key = `${t.layer}|${t.title}`;
    if (!seen.has(key)) seen.set(key, { ...t, projects: [] });
    seen.get(key).projects.push(t.project);
  }
  return [...seen.values()];
}

function markdown(results) {
  const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
  const clean = results.find((r) => r.run === "clean");
  const all = results.find((r) => r.run === "all");
  const bugs = results.filter((r) => r.run.startsWith("UI-"));
  const lines = [`_Last run: ${stamp} UTC_\n`];
  if (clean) lines.push(`**Clean build:** ${clean.passed}/${clean.total - clean.skipped} test runs pass across ${clean.projects.length} browser projects (${clean.projects.join(", ")}); ${clean.skipped} skipped by design.  `);
  if (bugs.length) lines.push(`**Planted UI bugs caught:** ${bugs.filter((r) => verdict(r) === "CAUGHT").length}/${bugs.length}.  `);
  if (all) lines.push(`**Release candidate with every bug on:** ${all.failed} of ${all.total - all.skipped} tests fail.  `);
  lines.push("");
  if (bugs.length) {
    lines.push("| Bug | What it does | Result | Caught by | Browsers | Failing tests |");
    lines.push("|---|---|---|---|---|---|");
    for (const r of bugs) {
      const v = verdict(r);
      const mark = v === "CAUGHT" ? "✅ caught" : v === "ESCAPED" ? "❌ escaped" : "⚠️ error";
      lines.push(`| ${r.run} | ${CATALOG[r.run].title} | ${mark} | ${r.failedLayers.join(", ") || "—"} | ${r.failedProjects.join(", ") || "—"} | ${r.failed} |`);
    }
    lines.push("", "<details><summary>Which tests caught which bug</summary>\n");
    for (const r of bugs) {
      lines.push(`**${r.run} — ${CATALOG[r.run].title}.** ${CATALOG[r.run].impact}\n`);
      const uniq = uniqueTests(r.failedTests);
      for (const t of uniq.slice(0, 6)) lines.push(`- \`${t.layer}\` ${t.title} _(${t.projects.join(", ")})_`);
      if (uniq.length > 6) lines.push(`- … and ${uniq.length - 6} more`);
      lines.push("");
    }
    lines.push("</details>");
  }
  return lines.join("\n");
}

const results = [];
let port = 4300;
for (const run of runs) {
  process.stdout.write(`▶ ${run} ... `);
  const r = runOnce(run, port++);
  r.verdict = verdict(r);
  console.log(`${r.verdict}: ${r.passed} passed, ${r.failed} failed, ${r.skipped} skipped in ${r.durationS}s ${r.failedLayers.join(", ")}`);
  results.push(r);
}

mkdirSync(REPORTS, { recursive: true });
writeFileSync(`${REPORTS}/bug-hunt.json`, JSON.stringify(results, null, 2));
const block = markdown(results);
writeFileSync(`${REPORTS}/BUG_HUNT.md`, `# Bug hunt\n\n${block}\n`);
if (args.includes("--update-readme") && existsSync(README)) {
  const text = readFileSync(README, "utf8");
  if (text.includes(START) && text.includes(END)) {
    const [head, rest] = text.split(START);
    const tail = rest.split(END)[1];
    writeFileSync(README, `${head}${START}\n${block}\n${END}${tail}`);
  }
}
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## UI bug hunt\n\n${block}\n`);

// In GitHub Actions, surface what went wrong as annotations on the run page.
if (process.env.GITHUB_ACTIONS) {
  for (const r of results) {
    if (r.verdict === "FALSE ALARM") {
      for (const t of r.failedTests.slice(0, 10)) {
        console.log(`::error title=clean app failure (${t.project})::${t.title} — ${t.error}`);
      }
    } else if (r.verdict === "ESCAPED") {
      console.log(`::error title=${r.run} escaped::No test failed with ${r.run} switched on.`);
    } else if (r.verdict === "ERROR") {
      console.log(`::error title=${r.run} run error::No test results were produced; see work/${r.run}.log.`);
    }
  }
}

const bad = results.filter((r) => ["ERROR", "FALSE ALARM", "ESCAPED"].includes(r.verdict)).map((r) => r.run);
if (bad.length) {
  console.log(`✗ Problems in: ${bad.join(", ")}`);
  process.exit(1);
}
console.log("✓ Clean build passes and every planted bug was caught.");
