// Arya Bank NetBanking (fictional) — the web app under test.
//
// A small Node server with no dependencies: it serves the pages in app/public
// and a JSON API backed by in-memory data. Everything is synthetic.
//
//   node app/server.mjs                     # http://localhost:4173
//   UI_BUGS=UI-03,UI-05 node app/server.mjs # with planted bugs (see app/bugs.mjs)
//
// Test hooks (POST /api/_test/customers) are on unless TEST_HOOKS=0.

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { activeBugs } from "./bugs.mjs";

const PORT = Number(process.env.PORT || 4173);
const PUBLIC = fileURLToPath(new URL("./public/", import.meta.url));
const BUGS = activeBugs(process.env.UI_BUGS);
const TEST_HOOKS = process.env.TEST_HOOKS !== "0";
const TODAY = "2026-10-08"; // frozen so statements and screenshots are stable
const TRANSFER_LIMIT = 10_000_000; // ₹1,00,000 in paise
const MAX_ATTEMPTS = 3;

// ---------------------------------------------------------------- seed data

const SEED_ACCOUNTS = [
  { accountNumber: "ACC-100201", type: "SAVINGS", nickname: "Salary account", balance: 12_500_050 },
  { accountNumber: "ACC-100202", type: "CURRENT", nickname: "Business account", balance: 4_825_000 },
];
const SEED_BENEFICIARIES = [
  { id: "BEN-1", name: "Ravi Iyer", accountNumber: "ACC-200311", ifsc: "ARYB0000004" },
  { id: "BEN-2", name: "Meera Nair", accountNumber: "ACC-200312", ifsc: "ARYB0000007" },
];
// [date, account, direction, paise, description]
const SEED_TXNS = [
  ["2026-09-01", "ACC-100201", "CREDIT", 8_500_000, "Salary September"],
  ["2026-09-03", "ACC-100201", "DEBIT", 1_800_000, "Rent — UPI"],
  ["2026-09-07", "ACC-100201", "DEBIT", 245_075, "Electricity bill"],
  ["2026-09-12", "ACC-100201", "DEBIT", 129_900, "Groceries — POS"],
  ["2026-09-15", "ACC-100202", "CREDIT", 2_500_000, "Invoice 0921 received"],
  ["2026-09-18", "ACC-100201", "DEBIT", 500_000, "Transfer to Ravi Iyer"],
  ["2026-09-22", "ACC-100202", "DEBIT", 675_050, "Office supplies"],
  ["2026-09-26", "ACC-100201", "CREDIT", 120_000, "Cashback"],
  ["2026-09-30", "ACC-100201", "DEBIT", 99_900, "Mobile recharge"],
  ["2026-10-01", "ACC-100201", "CREDIT", 8_500_000, "Salary October"],
  ["2026-10-02", "ACC-100201", "DEBIT", 1_800_000, "Rent — UPI"],
  ["2026-10-04", "ACC-100202", "CREDIT", 1_250_000, "Invoice 1003 received"],
  ["2026-10-05", "ACC-100201", "DEBIT", 350_025, "Insurance premium"],
  ["2026-10-06", "ACC-100201", "DEBIT", 74_950, "Restaurant — POS"],
  ["2026-10-07", "ACC-100202", "DEBIT", 1_000_000, "GST payment"],
];

const customers = new Map(); // customerId -> customer
const sessions = new Map(); // sid -> customerId
let customerSeq = 10000;
let txnSeq = 1000;

function newCustomer(name, password) {
  customerSeq += 1;
  const id = `AB${customerSeq}`;
  const customer = {
    id,
    name,
    password,
    failedAttempts: 0,
    locked: false,
    accounts: SEED_ACCOUNTS.map((a) => ({ ...a })),
    beneficiaries: SEED_BENEFICIARIES.map((b) => ({ ...b })),
    transactions: SEED_TXNS.map(([date, account, direction, amount, description], i) => ({
      id: `TXN${String(i + 1).padStart(6, "0")}`, date, account, direction, amount, description,
    })),
    idempotency: new Map(),
    benSeq: 2,
  };
  customers.set(id, customer);
  return customer;
}

newCustomer("Asha Verma", "Arya@2026"); // AB10001, the demo login

// ---------------------------------------------------------------- helpers

const money = (paise) => `${Math.trunc(paise / 100)}.${String(Math.abs(paise) % 100).padStart(2, "0")}`;

function toPaise(text) {
  if (typeof text !== "string" || !/^\d{1,9}(\.\d{1,2})?$/.test(text)) return null;
  const [r, f = ""] = text.split(".");
  return Number(r) * 100 + Number((f + "00").slice(0, 2));
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers });
  res.end(body === undefined ? "" : JSON.stringify(body));
}
const fail = (res, status, code, message, extra = {}) => send(res, status, { error: { code, message, ...extra } });

async function readJson(req) {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function sessionCustomer(req) {
  const sid = /(?:^|;\s*)sid=([^;]+)/.exec(req.headers.cookie || "")?.[1];
  const id = sid && sessions.get(sid);
  return id ? customers.get(id) : null;
}

const accountJson = (a) => ({ ...a, balance: money(a.balance) });
const txnJson = (t) => ({ ...t, amount: money(t.amount) });

// ---------------------------------------------------------------- API

async function api(req, res, url) {
  const path = url.pathname;
  const method = req.method;

  if (method === "POST" && path === "/api/login") {
    const body = await readJson(req);
    const customer = customers.get(String(body?.customerId || "").trim().toUpperCase());
    if (customer?.locked) return fail(res, 423, "LOCKED", "Too many failed attempts. Your login is locked.");
    if (!customer || customer.password !== body?.password) {
      if (customer) {
        customer.failedAttempts += 1;
        if (customer.failedAttempts >= MAX_ATTEMPTS) {
          customer.locked = true;
          return fail(res, 423, "LOCKED", "Too many failed attempts. Your login is locked.");
        }
      }
      const attemptsLeft = customer ? MAX_ATTEMPTS - customer.failedAttempts : undefined;
      return fail(res, 401, "INVALID_CREDENTIALS", "Customer ID or password is incorrect.", { attemptsLeft });
    }
    customer.failedAttempts = 0;
    const sid = randomUUID();
    sessions.set(sid, customer.id);
    return send(res, 200, { customerId: customer.id, name: customer.name },
      { "Set-Cookie": `sid=${sid}; Path=/; HttpOnly; SameSite=Lax` });
  }

  if (method === "POST" && path === "/api/logout") {
    const sid = /(?:^|;\s*)sid=([^;]+)/.exec(req.headers.cookie || "")?.[1];
    if (sid) sessions.delete(sid);
    return send(res, 204, undefined, { "Set-Cookie": "sid=; Path=/; Max-Age=0" });
  }

  if (TEST_HOOKS && method === "POST" && path === "/api/_test/customers") {
    const body = (await readJson(req)) || {};
    const c = newCustomer(body.name || "Test Customer", body.password || "Test@2026");
    return send(res, 201, { customerId: c.id, password: c.password, name: c.name });
  }

  const customer = sessionCustomer(req);
  if (!customer) return fail(res, 401, "NOT_LOGGED_IN", "Please log in.");

  if (method === "GET" && path === "/api/me") return send(res, 200, { customerId: customer.id, name: customer.name });

  if (method === "GET" && path === "/api/accounts") return send(res, 200, { accounts: customer.accounts.map(accountJson) });

  if (method === "GET" && path === "/api/beneficiaries") return send(res, 200, { beneficiaries: customer.beneficiaries });

  if (method === "POST" && path === "/api/beneficiaries") {
    const body = await readJson(req);
    const name = String(body?.name || "").trim();
    const accountNumber = String(body?.accountNumber || "").trim().toUpperCase();
    const ifsc = String(body?.ifsc || "").trim().toUpperCase();
    const errors = {};
    if (name.length < 2 || name.length > 50) errors.name = "Enter the name as it appears on the account.";
    if (!/^ACC-\d{6}$/.test(accountNumber)) errors.accountNumber = "Account number looks like ACC-123456.";
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) errors.ifsc = "IFSC is 11 characters, like ARYB0000004.";
    if (customer.beneficiaries.some((b) => b.accountNumber === accountNumber)) errors.accountNumber = "This account is already a beneficiary.";
    if (Object.keys(errors).length) return fail(res, 422, "VALIDATION_ERROR", "Please fix the highlighted fields.", { fields: errors });
    customer.benSeq += 1;
    const ben = { id: `BEN-${customer.benSeq}`, name, accountNumber, ifsc };
    customer.beneficiaries.push(ben);
    return send(res, 201, ben);
  }

  const benMatch = /^\/api\/beneficiaries\/([\w-]+)$/.exec(path);
  if (method === "DELETE" && benMatch) {
    const before = customer.beneficiaries.length;
    customer.beneficiaries = customer.beneficiaries.filter((b) => b.id !== benMatch[1]);
    return before === customer.beneficiaries.length
      ? fail(res, 404, "NOT_FOUND", "Beneficiary not found.")
      : send(res, 204);
  }

  if (method === "GET" && path === "/api/transactions") {
    const account = url.searchParams.get("account");
    const from = url.searchParams.get("from") || "0000-00-00";
    const to = url.searchParams.get("to") || "9999-99-99";
    const rows = customer.transactions
      .filter((t) => (!account || t.account === account) && t.date >= from && t.date <= to)
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id.localeCompare(a.id)));
    return send(res, 200, { transactions: rows.map(txnJson) });
  }

  if (method === "POST" && path === "/api/transfers") {
    const body = await readJson(req);
    const key = req.headers["idempotency-key"];
    if (!key) return fail(res, 400, "MISSING_IDEMPOTENCY_KEY", "Idempotency-Key header is required.");
    if (customer.idempotency.has(key)) return send(res, 200, customer.idempotency.get(key), { "Idempotent-Replayed": "true" });
    const from = customer.accounts.find((a) => a.accountNumber === body?.fromAccount);
    const ben = customer.beneficiaries.find((b) => b.id === body?.beneficiaryId);
    const paise = toPaise(body?.amount);
    if (!from) return fail(res, 422, "UNKNOWN_ACCOUNT", "Choose an account to pay from.");
    if (!ben) return fail(res, 422, "UNKNOWN_BENEFICIARY", "Choose who to pay.");
    if (paise === null || paise <= 0) return fail(res, 422, "INVALID_AMOUNT", "Enter an amount like 1500.75.");
    if (paise > TRANSFER_LIMIT) return fail(res, 422, "LIMIT_EXCEEDED", "The limit per transfer is ₹1,00,000.");
    if (paise > from.balance) return fail(res, 422, "INSUFFICIENT_FUNDS", "Not enough balance in this account.");
    from.balance -= paise;
    txnSeq += 1;
    const transferId = `TRF${txnSeq}`;
    const remarks = String(body?.remarks || "").slice(0, 40);
    customer.transactions.push({
      id: transferId, date: TODAY, account: from.accountNumber, direction: "DEBIT", amount: paise,
      description: `Transfer to ${ben.name}${remarks ? ` — ${remarks}` : ""}`,
    });
    const result = {
      transferId, status: "COMPLETED", amount: money(paise), fromAccount: from.accountNumber,
      beneficiary: { id: ben.id, name: ben.name, accountNumber: ben.accountNumber }, date: TODAY,
      balanceAfter: money(from.balance),
    };
    customer.idempotency.set(key, result);
    return send(res, 201, result);
  }

  return fail(res, 404, "NOT_FOUND", "No such endpoint.");
}

// ---------------------------------------------------------------- pages

const PAGES = { "/": "login.html", "/login": "login.html", "/dashboard": "dashboard.html", "/transfer": "transfer.html",
  "/beneficiaries": "beneficiaries.html", "/statement": "statement.html" };
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript",
  ".svg": "image/svg+xml", ".ico": "image/x-icon" };

async function page(req, res, url) {
  const file = PAGES[url.pathname] || normalize(url.pathname).replace(/^(\.\.[/\\])+/, "").slice(1);
  try {
    let body = await readFile(join(PUBLIC, file));
    const type = TYPES[extname(file)] || "application/octet-stream";
    if (type.startsWith("text/html")) {
      body = body.toString().replace("<html lang=\"en\">", `<html lang="en" data-bugs="${[...BUGS].join(" ")}">`);
    }
    res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" });
    res.end(body);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  }
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname.startsWith("/api/")) await api(req, res, url);
    else await page(req, res, url);
  } catch (err) {
    console.error(err);
    fail(res, 500, "SERVER_ERROR", "Something went wrong.");
  }
}).listen(PORT, () => {
  console.log(`Arya Bank NetBanking on http://localhost:${PORT}  planted bugs: ${[...BUGS].join(", ") || "none"}`);
});
