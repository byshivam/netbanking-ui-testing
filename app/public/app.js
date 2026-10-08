// Shared page code for Arya Bank NetBanking (fictional).

export const BUGS = new Set((document.documentElement.dataset.bugs || "").split(" ").filter(Boolean));

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "125000.50" -> "₹1,25,000.50" (Indian digit grouping, done by hand so every browser prints the same). */
export function inr(amount) {
  const [rupees, paise = "00"] = String(amount).split(".");
  const neg = rupees.startsWith("-");
  const digits = rupees.replace("-", "");
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${neg ? "-" : ""}₹${rest ? `${rest},` : ""}${last3}.${paise.padEnd(2, "0").slice(0, 2)}`;
}

/** "2026-10-08" -> "08 Oct 2026" */
export function longDate(iso) {
  const [y, m, d] = iso.split("-");
  return `${d} ${MONTHS[Number(m) - 1]} ${y}`;
}

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.error?.message || `Request failed (${status})`);
    this.status = status;
    this.code = body?.error?.code;
    this.body = body;
  }
}

export async function api(path, { method = "GET", body, headers = {} } = {}) {
  const res = await fetch(path, {
    method,
    headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
    credentials: "same-origin",
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

export const $ = (sel, root = document) => root.querySelector(sel);

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? "" : v);
  }
  for (const child of children.flat()) {
    if (child !== undefined && child !== null && child !== false) node.append(child);
  }
  return node;
}

const NAV = [
  ["/dashboard", "Dashboard"],
  ["/transfer", "Send money"],
  ["/beneficiaries", "Beneficiaries"],
  ["/statement", "Statement"],
];

/** Checks the session, draws the header and returns the customer. Redirects to login if needed. */
export async function bootstrap() {
  let me;
  try {
    me = await api("/api/me");
  } catch (err) {
    if (err.status === 401) {
      location.replace(`/login?next=${encodeURIComponent(location.pathname)}`);
      return new Promise(() => {}); // never resolves; we're leaving
    }
    throw err;
  }
  const header = $("#site-header");
  header.replaceChildren(
    el("div", { class: "bar" },
      el("a", { class: "brand", href: "/dashboard" },
        el("span", { class: "logo", "aria-hidden": "true" }, "A"),
        el("span", {}, el("strong", {}, "Arya Bank"), " ", el("span", { class: "brand-sub" }, "NetBanking"))),
      el("div", { class: "who" },
        el("span", { class: "who-name", "data-testid": "customer-name" }, me.name),
        el("button", { class: "btn ghost", type: "button", id: "logout", onclick: logout }, "Log out"))),
    el("nav", { "aria-label": "Main" },
      el("ul", {}, NAV.map(([href, label]) =>
        el("li", {}, el("a", { href, "aria-current": location.pathname === href ? "page" : undefined }, label))))),
  );
  return me;
}

async function logout() {
  if (!BUGS.has("UI-08")) {
    try {
      await api("/api/logout", { method: "POST" });
    } catch {
      /* already logged out */
    }
  }
  location.assign("/login");
}

export function showError(container, message, retry) {
  container.replaceChildren(
    el("div", { class: "alert error", role: "alert" },
      el("p", {}, message),
      retry ? el("button", { class: "btn", type: "button", onclick: retry }, "Retry") : null),
  );
}
