/* =====================================================================
   Admissions CRM UI. Talks to the backend only through the `Api` object.
   ===================================================================== */
(function () {
"use strict";
const { $, $$, esc, sod, addDays, dayDiff, parse, fmtDate, fmtDay, fmtShort, fmtDateTime, isoDay, initials, avColor, MON } = U;
const { STATUSES, OPEN } = Model;
const CONFIRMED = CONFIG.CONFIRM_STATUS;
const SCOL = { "New": "#2563eb", "No Response": "#64748b", "Counseling Scheduled": "#7c3aed", "Counseling done": "#0d9488", "Confirmed": "#047857", "Dropped": "#b91c1c" };
const PALETTE = ["#2563eb", "#0d9488", "#f59e0b", "#7c3aed", "#e11d48", "#0891b2", "#65a30d", "#b45309"];

/* ---------- state ---------- */
const state = {
  user: { name: "user", role: "counselor" },
  enquiries: [],
  fees: [],
  loading: true,
  tab: "dashboard",
  dash: { kind: "all", from: "", to: "" },
  table: { q: "", course: "All", source: "All", counselor: "All", status: "All", dateKind: "all", from: "", to: "", sort: { key: "createdAt", dir: "desc" }, page: 1, size: CONFIG.PAGE_SIZE || 10 },
  edit: null
};

/* ---------- icons ---------- */
const ICONS = {
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  plus: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
  table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 10v10"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  userCheck: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="m16 11 2 2 4-4"/>',
  userX: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="m17 8 5 5M22 8l-5 5"/>',
  award: '<circle cx="12" cy="9" r="6"/><path d="m8.5 14-1.5 7 5-3 5 3-1.5-7"/><path d="m9.5 9 2 2 3-3.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  filter: '<path d="M3 5h18l-7 8v6l-4 2v-8z"/>',
  download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  chevL: '<path d="m15 6-6 6 6 6"/>',
  chevR: '<path d="m9 6 6 6-6 6"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m6 6 1 15h10l1-15"/>',
  send: '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
  shieldCheck: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v4"/>',
  chart: '<path d="M3 3v18h18"/><path d="m7 15 4-5 3 3 5-7"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>',
  fee: '<path d="M2 8h20v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="3"/><path d="M2 8V6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  translate: '<path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/>'
};
const icon = (n, s) => '<svg width="' + (s || 18) + '" height="' + (s || 18) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[n] + "</svg>";
function hydrateIcons(root) { $$("[data-icon]", root).forEach(el => { if (!el.firstChild) el.innerHTML = icon(el.dataset.icon, el.dataset.size); }); }

/* ---------- small UI helpers ---------- */
function toast(msg, isErr) {
  const t = document.createElement("div");
  t.className = "toast" + (isErr ? " err" : ""); t.textContent = msg;
  $("#toasts").appendChild(t);
  setTimeout(() => { t.style.opacity = "0"; t.style.transition = "opacity .3s"; setTimeout(() => t.remove(), 300); }, 3400);
}
let cfResolve = null;
function confirmDialog(o) {
  return new Promise(res => {
    cfResolve = res;
    $("#cfTitle").textContent = o.title; $("#cfMsg").textContent = o.message;
    const ok = $("#cfOk"); ok.textContent = o.confirmText || "Confirm";
    ok.className = "btn " + (o.danger ? "danger-solid" : (o.success ? "success" : "primary"));
    $("#cfOverlay").hidden = false;
    setTimeout(() => $("#cfCancel").focus(), 20);
  });
}
function closeConfirm(v) { $("#cfOverlay").hidden = true; if (cfResolve) { const r = cfResolve; cfResolve = null; r(v); } }
const slug = s => String(s).toLowerCase().replace(/[^a-z]/g, "");
const pill = s => '<span class="pill s-' + slug(s) + '">' + esc(s) + "</span>";
const isPendingFU = e => OPEN.indexOf(e.status) > -1 && !!parse(e.followUpDate);
const canConfirm = e => OPEN.indexOf(e.status) > -1;
const isNet = err => /Failed to fetch|NetworkError|Load failed/i.test(err && err.message);

/* ---------- date ranges ---------- */
function rangeOf(kind, from, to) {
  const today = sod(new Date());
  if (kind === "today") return { start: today, end: addDays(today, 1) };
  if (kind === "yesterday") return { start: addDays(today, -1), end: today };
  if (kind === "week") { const s = addDays(today, -((today.getDay() + 6) % 7)); return { start: s, end: addDays(s, 7) }; }
  if (kind === "month") return { start: new Date(today.getFullYear(), today.getMonth(), 1), end: new Date(today.getFullYear(), today.getMonth() + 1, 1) };
  if (kind === "lastmonth") return { start: new Date(today.getFullYear(), today.getMonth() - 1, 1), end: new Date(today.getFullYear(), today.getMonth(), 1) };
  if (kind === "custom") { const f = U.localDate(from), t = U.localDate(to); return { start: f, end: t ? addDays(t, 1) : null }; }
  return { start: null, end: null };
}
function inRange(e, r) {
  if (!r.start && !r.end) return true;
  const d = parse(e.createdAt); if (!d) return false;
  return (!r.start || d >= r.start) && (!r.end || d < r.end);
}
const dashRange = () => rangeOf(state.dash.kind, state.dash.from, state.dash.to);

function buckets(list, r, kind) {
  const tomorrow = addDays(sod(new Date()), 1);
  if (kind === "today") {
    const c = Array(24).fill(0);
    list.forEach(e => { const d = parse(e.createdAt); if (d) c[d.getHours()]++; });
    return c.map((v, h) => { const l = (h % 12 || 12) + (h < 12 ? " AM" : " PM"); return { v, label: l, full: l }; });
  }
  let start = r.start;
  if (!start) { const ds = list.map(e => parse(e.createdAt)).filter(Boolean); start = ds.length ? sod(new Date(Math.min.apply(null, ds))) : addDays(tomorrow, -30); }
  let end = r.end && r.end < tomorrow ? r.end : tomorrow;
  if (end <= start) end = addDays(start, 1);
  const span = dayDiff(start, end), weekly = span > 62, n = weekly ? Math.ceil(span / 7) : span;
  const c = Array(n).fill(0);
  list.forEach(e => { const d = parse(e.createdAt); if (!d) return; const i = Math.floor(dayDiff(start, d) / (weekly ? 7 : 1)); if (i >= 0 && i < n) c[i]++; });
  return c.map((v, i) => {
    const d = addDays(start, i * (weekly ? 7 : 1));
    return { v, label: fmtShort(d), full: weekly ? "Week of " + fmtShort(d) : d.getDate() + " " + MON[d.getMonth()] + " " + d.getFullYear() };
  });
}

/* =====================================================================
   Dashboard rendering
   ===================================================================== */
function renderStats() {
  const host = $("#stats");
  if (state.loading) { host.innerHTML = '<div class="card skel" style="height:128px"></div>'.repeat(5); return; }
  const r = dashRange(), list = state.enquiries.filter(e => inRange(e, r)), today = sod(new Date());
  const total = list.length;
  const open = list.filter(e => OPEN.indexOf(e.status) > -1);
  const active = open.filter(e => e.assignedTo).length;
  const dropped = list.filter(e => e.status === "Dropped").length;
  const conv = list.filter(e => e.status === "Confirmed").length;
  const inCounseling = list.filter(e => e.status === "Counseling Scheduled" || e.status === "Counseling done").length;
  const pend = open.filter(isPendingFU);
  const overdue = pend.filter(e => { const d = parse(e.followUpDate); return d && sod(d) < today; }).length;

  let totalSub = "All enquiries in this period";
  if (r.start && r.end) {
    const len = dayDiff(r.start, r.end), prev = state.enquiries.filter(e => inRange(e, { start: addDays(r.start, -len), end: r.start })).length;
    if (prev > 0) {
      const pct = Math.round((total - prev) / prev * 100);
      totalSub = '<span class="trend ' + (pct > 0 ? "up" : pct < 0 ? "down" : "flat") + '">' + (pct > 0 ? "▲ " : pct < 0 ? "▼ " : "") + Math.abs(pct) + '%</span> vs previous period';
    }
  }
  const cards = [
    { k: "Total enquiries", v: total, ico: "users", sub: totalSub },
    { k: "Active / assigned", v: active, ico: "userCheck", sub: open.length ? "of " + open.length + " open leads" : "No open leads" },
    { k: "Dropped", v: dropped, ico: "userX", sub: total ? Math.round(dropped / total * 100) + "% of enquiries" : "No enquiries yet" },
    { k: "Confirmed admissions", v: conv, ico: "award", sub: inCounseling + " in counseling" + (total ? " · " + (Math.round(conv / total * 1000) / 10) + "% conversion" : "") },
    { k: "Pending follow-ups", v: pend.length, ico: "clock", sub: overdue ? '<span class="overdue">' + overdue + " overdue</span>" : "None overdue" }
  ];
  host.innerHTML = cards.map(c => '<div class="card stat"><div class="stat-top"><span class="stat-ico">' + icon(c.ico, 20) + '</span><span class="stat-label">' + c.k + '</span></div><div class="stat-val">' + c.v + '</div><div class="stat-sub">' + c.sub + "</div></div>").join("");
}

const COLS = [
  { k: "name", l: "Student", sort: true }, { k: "course", l: "Course", sort: true }, { k: "phone", l: "Phone" },
  { k: "source", l: "Source", sort: true }, { k: "status", l: "Status", sort: true }, { k: "assignedTo", l: "Counselor", sort: true },
  { k: "followUpDate", l: "Follow-up", sort: true }, { k: "createdAt", l: "Created", sort: true }, { k: "_a", l: "Action" }
];
function followCell(e) {
  if (OPEN.indexOf(e.status) === -1) return '<span class="muted">–</span>';
  const d = parse(e.followUpDate); if (!d) return '<span class="muted">Not set</span>';
  const diff = dayDiff(new Date(), d);
  return diff < 0 ? '<span class="overdue" title="Overdue">' + fmtDay(d) + "</span>" : fmtDay(d);
}
function actionsHtml(e) {
  let h = '<div class="acts"><button class="btn sm" type="button" data-open="' + esc(e.id) + '">' + icon("edit", 15) + "Edit lead</button>";
  if (isPendingFU(e)) h += '<button class="btn sm ok icon" type="button" data-confirm="' + esc(e.id) + '" title="Confirm admission" aria-label="Confirm admission for ' + esc(e.name) + '">' + icon("check", 16) + "</button>";
  return h + "</div>";
}
function rowHtml(e) {
  return '<tr><td><button class="person" type="button" data-open="' + esc(e.id) + '"><span class="av" style="background:' + avColor(e.name) + '">' + esc(initials(e.name)) + '</span><span><b>' + esc(e.name || "Unnamed") + "</b><small>" + esc(e.city || e.email || "") + "</small></span></button></td>" +
    "<td>" + esc(e.course || "–") + "</td><td>" + esc(e.phone) + "</td><td>" + esc(e.source || "–") + "</td><td>" + pill(e.status) + "</td>" +
    "<td>" + (e.assignedTo ? esc(e.assignedTo) : '<span class="muted">Unassigned</span>') + "</td><td>" + followCell(e) + "</td><td>" + fmtDay(e.createdAt) + "</td><td>" + actionsHtml(e) + "</td></tr>";
}
const emptyBox = (ico, title, msg, btn) => '<div class="empty"><div class="ei">' + icon(ico, 24) + "</div><b>" + title + "</b>" + msg + (btn || "") + "</div>";

function renderRecent() {
  const host = $("#recentBody");
  if (state.loading) { host.innerHTML = '<div style="padding:18px 22px"><div class="skel" style="height:240px"></div></div>'; return; }
  const rows = state.enquiries.slice().sort((a, b) => (+parse(b.createdAt) || 0) - (+parse(a.createdAt) || 0)).slice(0, 8);
  if (!rows.length) { host.innerHTML = emptyBox("inbox", "No enquiries yet", "New leads will appear here.", '<br><button class="btn primary" data-tab-go="new" type="button">Add an enquiry</button>'); return; }
  host.innerHTML = "<table><thead><tr>" + COLS.map(c => "<th scope=\"col\">" + c.l + "</th>").join("") + "</tr></thead><tbody>" + rows.map(rowHtml).join("") + "</tbody></table>";
}

/** Clicking a chart bar/segment jumps to the table pre-filtered to that value. */
function drillIntoTable(patch) {
  const t = state.table;
  Object.assign(t, { q: "", course: "All", source: "All", counselor: "All", status: "All", page: 1 }, patch);
  t.dateKind = state.dash.kind; t.from = state.dash.from; t.to = state.dash.to;
  $("#tq").value = "";
  $("#tDate").value = t.dateKind; $("#tCustom").hidden = t.dateKind !== "custom";
  $("#tFrom").value = t.from; $("#tTo").value = t.to;
  renderFilterOptions(); renderTable();
  setTab("table");
  toast("Filtered by " + Object.values(patch)[0]);
}
function renderCharts() {
  const l = $("#lineChart"), b = $("#barChart"), wl = $("#workloadChart"), st = $("#statusChart"), src = $("#sourceChart");
  const all = [l, b, wl, st, src];
  if (state.loading) { all.forEach(h => { h.onmousemove = null; h.innerHTML = '<div class="skel" style="height:280px"></div>'; }); return; }
  const r = dashRange(), list = state.enquiries.filter(e => inRange(e, r));
  const labels = { all: "All Time", today: "Today", yesterday: "Yesterday", week: "This Week", month: "This Month", lastmonth: "Last Month", custom: "Custom Range" };
  $("#trendSub").textContent = "New enquiries · " + labels[state.dash.kind];

  Charts.line(l, buckets(list, r, state.dash.kind), { aria: "Inquiry trends" });

  const byCourse = {}; list.forEach(e => { const c = e.course || "Other"; byCourse[c] = (byCourse[c] || 0) + 1; });
  Charts.bar(b, Object.keys(byCourse).map(k => ({ name: k, v: byCourse[k] })).sort((a, c) => c.v - a.v), { aria: "Enquiries by course", emptyTitle: "No enquiries in this period", scrollable: true, onClick: name => drillIntoTable({ course: name }) });

  const byStaff = {}; list.forEach(e => { if (e.assignedTo) byStaff[e.assignedTo] = (byStaff[e.assignedTo] || 0) + 1; });
  const wlItems = Object.keys(byStaff).map(k => ({ name: k, v: byStaff[k] })).sort((a, c) => c.v - a.v);
  Charts.bar(wl, wlItems, { aria: "Counselor workload", emptyTitle: "No leads assigned yet", emptyMsg: "Assign a counselor to a lead to see workload.", rotateLabels: false, unit: " leads", onClick: name => drillIntoTable({ counselor: name }) });

  const byStatus = {}; STATUSES.forEach(s2 => byStatus[s2] = 0); list.forEach(e => { byStatus[e.status] = (byStatus[e.status] || 0) + 1; });
  Charts.bar(st, STATUSES.map(s2 => ({ name: s2, v: byStatus[s2], color: SCOL[s2] })), { aria: "Lead status overview", emptyTitle: "No enquiries in this period", onClick: name => drillIntoTable({ status: name }) });

  const bySource = {}; list.forEach(e => { const s2 = e.source || "Other"; bySource[s2] = (bySource[s2] || 0) + 1; });
  const srcItems = Object.keys(bySource).map((k, i) => ({ name: k, v: bySource[k], color: PALETTE[i % PALETTE.length] })).sort((a, c) => c.v - a.v);
  Charts.donut(src, srcItems, { aria: "Leads by source", centerLabel: "leads", emptyTitle: "No enquiries in this period", onClick: name => drillIntoTable({ source: name }) });

  all.forEach(hydrateIcons);
}

/* =====================================================================
   Enquiries table + filters
   ===================================================================== */
const uniq = f => { const s = new Set(); state.enquiries.forEach(e => { if (e[f]) s.add(e[f]); }); return Array.from(s).sort((a, b) => a.localeCompare(b)); };
const counselorList = () => { const s = new Set((CONFIG.COUNSELORS || [])); uniq("assignedTo").forEach(v => s.add(v)); if (state.user && state.user.name) s.add(state.user.name); return Array.from(s).sort((a, b) => a.localeCompare(b)); };
function setOptions(sel, allLabel, values, cur) {
  sel.innerHTML = '<option value="All">' + allLabel + "</option>" + values.map(v => "<option>" + esc(v) + "</option>").join("");
  sel.value = (cur === "All" || values.indexOf(cur) > -1) ? cur : "All";
}
function renderFilterOptions() {
  const t = state.table;
  setOptions($("#tCourse"), "All courses", uniq("course"), t.course); t.course = $("#tCourse").value;
  setOptions($("#tSource"), "All sources", uniq("source"), t.source); t.source = $("#tSource").value;
  setOptions($("#tCounselor"), "All counselors", counselorList(), t.counselor); t.counselor = $("#tCounselor").value;
  setOptions($("#tStatus"), "All statuses", STATUSES, t.status); t.status = $("#tStatus").value;
}
function activeFilterCount() { const t = state.table; return (t.course !== "All") + (t.source !== "All") + (t.counselor !== "All") + (t.status !== "All") + (t.dateKind !== "all"); }

function tableRows() {
  const t = state.table, q = t.q.toLowerCase().split(/\s+/).filter(Boolean), r = rangeOf(t.dateKind, t.from, t.to);
  const rows = state.enquiries.filter(e => {
    if (t.course !== "All" && e.course !== t.course) return false;
    if (t.source !== "All" && e.source !== t.source) return false;
    if (t.counselor !== "All" && e.assignedTo !== t.counselor) return false;
    if (t.status !== "All" && e.status !== t.status) return false;
    if (!inRange(e, r)) return false;
    const hay = (e.name + " " + e.phone + " " + e.email).toLowerCase();
    return q.every(w => hay.indexOf(w) > -1);
  });
  const k = t.sort.key, dir = t.sort.dir === "asc" ? 1 : -1;
  rows.sort((a, b) => {
    let x = a[k], y = b[k];
    if (k === "status") { x = STATUSES.indexOf(x); y = STATUSES.indexOf(y); }
    else if (k === "createdAt" || k === "followUpDate") { const inf = dir > 0 ? Infinity : -Infinity; x = parse(x) ? +parse(x) : inf; y = parse(y) ? +parse(y) : inf; }
    else { x = String(x || "").toLowerCase(); y = String(y || "").toLowerCase(); }
    return x < y ? -dir : x > y ? dir : 0;
  });
  return rows;
}

function renderTable() {
  const t = state.table;
  $("#thead").innerHTML = COLS.map(c => {
    const on = t.sort.key === c.k, aria = on ? (t.sort.dir === "asc" ? "ascending" : "descending") : "none";
    return '<th scope="col" aria-sort="' + aria + '">' + (c.sort ? '<button type="button" data-sort="' + c.k + '">' + c.l + ' <span class="arr">' + (on && t.sort.dir === "asc" ? "▲" : "▼") + "</span></button>" : c.l) + "</th>";
  }).join("");
  const body = $("#tbody"), pager = $("#pager");
  const fc = activeFilterCount(); const badge = $("#fCount"); badge.textContent = fc; badge.hidden = !fc;
  if (state.loading) { body.innerHTML = '<tr><td colspan="9"><div class="skel" style="height:260px"></div></td></tr>'; pager.innerHTML = ""; return; }
  const rows = tableRows(), size = t.size, pages = Math.max(1, Math.ceil(rows.length / size));
  if (t.page > pages) t.page = pages;
  const from = (t.page - 1) * size, view = rows.slice(from, from + size);
  if (view.length) body.innerHTML = view.map(rowHtml).join("");
  else {
    const none = !state.enquiries.length;
    body.innerHTML = '<tr><td colspan="9">' + (none
      ? emptyBox("inbox", "No enquiries yet", "Add your first lead to get started.", '<br><button class="btn primary" data-tab-go="new" type="button">Add an enquiry</button>')
      : emptyBox("search", "No enquiries match", "Try a different search or clear the filters.", '<br><button class="btn" data-clear-filters type="button">Clear filters</button>')) + "</td></tr>";
  }
  pager.innerHTML = '<span>' + (rows.length ? "Showing " + (from + 1) + "–" + (from + view.length) + " of " + rows.length : "0 results") + '</span>' +
    '<div class="btns"><span class="rows">Rows per page <select class="select" id="pSize" aria-label="Rows per page">' + [10, 25, 50].map(n => '<option' + (n === size ? " selected" : "") + ">" + n + "</option>").join("") + "</select></span>" +
    '<button class="btn sm" type="button" data-page="-1"' + (t.page <= 1 ? " disabled" : "") + '>Previous</button><span>Page ' + t.page + " of " + pages + '</span><button class="btn sm" type="button" data-page="1"' + (t.page >= pages ? " disabled" : "") + ">Next</button></div>";
}

/* ---------- filter drawer (mobile) ---------- */
function openFilters() { $("#filters").classList.add("open"); $("#fScrim").hidden = false; $("#fToggle").setAttribute("aria-expanded", "true"); }
function closeFilters() { $("#filters").classList.remove("open"); $("#fScrim").hidden = true; $("#fToggle").setAttribute("aria-expanded", "false"); }
function clearFilters() {
  const t = state.table; Object.assign(t, { q: "", course: "All", source: "All", counselor: "All", status: "All", dateKind: "all", from: "", to: "", page: 1 });
  $("#tq").value = ""; $("#tDate").value = "all"; $("#tFrom").value = ""; $("#tTo").value = ""; $("#tCustom").hidden = true;
  renderFilterOptions(); renderTable();
}

/* =====================================================================
   Fees
   ===================================================================== */
function fillFeeForm() {
  fillSelect($("#fee-mode"), Model.FEE_MODES, $("#fee-mode").value || Model.FEE_MODES[0]);
  if (!$("#fee-date").value) $("#fee-date").value = isoDay(new Date());
  populateFeeEnquiryOptions("");
}
function populateFeeEnquiryOptions(q) {
  const sel = $("#fee-enquiry"), cur = sel.value;
  const needle = q.trim().toLowerCase();
  const rows = state.enquiries
    .filter(e => !needle || (e.name + " " + e.phone).toLowerCase().indexOf(needle) > -1)
    .sort((a, b) => (+parse(b.createdAt) || 0) - (+parse(a.createdAt) || 0))
    .slice(0, 50);
  sel.innerHTML = rows.length
    ? rows.map(e => '<option value="' + esc(e.id) + '">' + esc(e.name) + " — " + esc(e.phone) + (e.course ? " — " + esc(e.course) : "") + "</option>").join("")
    : '<option value="">No matching leads</option>';
  if (rows.some(e => String(e.id) === String(cur))) sel.value = cur;
}
function feeStudentName(fee) {
  if (fee.studentName) return fee.studentName;
  const e = state.enquiries.find(x => String(x.id) === String(fee.enquiryId));
  return e ? e.name : "Unknown lead";
}
function renderFeeStats() {
  const host = $("#feeStats");
  if (state.loading) { host.innerHTML = '<div class="card skel" style="height:118px"></div>'.repeat(3); return; }
  const fees = state.fees, today = sod(new Date());
  const total = fees.reduce((s, f) => s + (f.amount || 0), 0);
  const monthFees = fees.filter(f => { const d = parse(f.paymentDate); return d && d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth(); });
  const monthTotal = monthFees.reduce((s, f) => s + (f.amount || 0), 0);
  const cards = [
    { k: "Total collected", v: "₹" + total.toLocaleString("en-IN"), ico: "award", sub: fees.length + (fees.length === 1 ? " payment recorded" : " payments recorded") },
    { k: "Collected this month", v: "₹" + monthTotal.toLocaleString("en-IN"), ico: "clock", sub: monthFees.length + (monthFees.length === 1 ? " payment" : " payments") + " this month" },
    { k: "Average payment", v: "₹" + (fees.length ? Math.round(total / fees.length).toLocaleString("en-IN") : "0"), ico: "users", sub: "Across all recorded payments" }
  ];
  host.innerHTML = cards.map(c => '<div class="card stat"><div class="stat-top"><span class="stat-ico">' + icon(c.ico, 20) + '</span><span class="stat-label">' + c.k + '</span></div><div class="stat-val">' + c.v + '</div><div class="stat-sub">' + c.sub + "</div></div>").join("");
  hydrateIcons(host);
}
function renderFeeTable() {
  const body = $("#feeBody");
  if (state.loading) { body.innerHTML = '<tr><td colspan="7"><div class="skel" style="height:160px"></div></td></tr>'; return; }
  const rows = state.fees.slice().sort((a, b) => (+parse(b.paymentDate) || 0) - (+parse(a.paymentDate) || 0));
  body.innerHTML = rows.length ? rows.map(f => (
    "<tr><td>" + esc(feeStudentName(f)) + "</td><td>₹" + (f.amount || 0).toLocaleString("en-IN") + "</td><td>" + esc(f.mode) + "</td><td>" + fmtDate(f.paymentDate) + "</td><td>" +
    (f.receivedBy ? esc(f.receivedBy) : '<span class="muted">–</span>') + "</td><td>" + (f.notes ? esc(f.notes) : '<span class="muted">–</span>') +
    '</td><td><button class="btn sm danger" type="button" data-fee-delete="' + esc(f.id) + '">' + icon("trash", 14) + "Delete</button></td></tr>"
  )).join("") : '<tr><td colspan="7">' + emptyBox("fee", "No payments recorded yet", "Record your first fee payment above.") + "</td></tr>";
  hydrateIcons(body);
  renderReceiptOptions();
}
function setFeeTab(name) {
  ["dashboard", "payment", "history", "receipt"].forEach(tab => {
    $("#feePanel-" + tab).hidden = tab !== name;
    $("#feeTab-" + tab).setAttribute("aria-selected", String(tab === name));
  });
  if (name === "receipt") renderReceiptOptions();
}
function renderReceiptOptions() {
  const select = $("#receiptPayment"), current = select.value;
  const rows = state.fees.slice().sort((a, b) => (+parse(b.paymentDate) || 0) - (+parse(a.paymentDate) || 0));
  select.innerHTML = rows.length
    ? rows.map(fee => '<option value="' + esc(fee.id) + '">' + esc(feeStudentName(fee) + " — ₹" + Number(fee.amount || 0).toLocaleString("en-IN") + " — " + fmtDate(fee.paymentDate)) + "</option>").join("")
    : '<option value="">No payments available</option>';
  if (rows.some(fee => String(fee.id) === String(current))) select.value = current;
}
async function issueReceipt() {
  const fee = state.fees.find(row => String(row.id) === String($("#receiptPayment").value));
  if (!fee) { toast("Select a recorded payment first.", true); return; }
  const receipt = window.open("", "_blank", "width=800,height=700");
  if (!receipt) { toast("Allow pop-ups to print the receipt.", true); return; }
  let receiptNo = "LBSTI-" + new Date().getFullYear() + "-" + String(fee.id).padStart(6, "0");
  try {
    const issued = await Api.receipts.issue(fee.id);
    if (issued && issued.receiptNumber) receiptNo = issued.receiptNumber;
  } catch (err) {
    receipt.close();
    if (err.code === 401) return showLogin(err.message);
    toast(err.message, true);
    return;
  }
  const enquiry = state.enquiries.find(row => String(row.id) === String(fee.enquiryId)) || {};
  const fields = [
    ["Receipt number", receiptNo], ["Student name", feeStudentName(fee)], ["Course", enquiry.course || "–"],
    ["Payment date", fmtDate(fee.paymentDate)], ["Amount paid", "₹" + Number(fee.amount || 0).toLocaleString("en-IN")],
    ["Payment mode", fee.mode || "–"], ["Counselor", fee.receivedBy || enquiry.assignedTo || "–"], ["Remarks", fee.notes || "–"]
  ];
  receipt.document.write('<!doctype html><html><head><meta charset="utf-8"><title>' + esc(receiptNo) + '</title><style>body{font:15px Arial,sans-serif;color:#182238;margin:40px auto;max-width:720px;padding:24px}header{border-bottom:2px solid #173a80;padding-bottom:18px;margin-bottom:22px}h1{font-size:22px;color:#173a80}dl{display:grid;grid-template-columns:1fr 1fr;gap:0 24px}dl div{padding:13px 0;border-bottom:1px solid #e4e7ec}dt{font-size:12px;color:#667085;margin-bottom:5px}dd{margin:0;font-weight:700}button{margin-top:24px;padding:10px 16px;border:0;background:#173a80;color:#fff;border-radius:6px;cursor:pointer}@media print{button{display:none}}</style></head><body><header><h1>' + esc(CONFIG.ORG.fullName) + '</h1><p>Fee payment receipt</p></header><dl>' + fields.map(field => '<div><dt>' + esc(field[0]) + '</dt><dd>' + esc(field[1]) + '</dd></div>').join("") + '</dl><button onclick="window.print()">Print / Save as PDF</button></body></html>');
  receipt.document.close();
}
async function submitFee(ev) {
  ev.preventDefault();
  const form = ev.target;
  const enquiryId = $("#fee-enquiry").value, amount = parseFloat($("#fee-amount").value);
  let ok = true;
  const setErr = (fieldId, msg) => { const f = $(fieldId).closest(".fld"); f.classList.toggle("bad", !!msg); const er = $(".err", f); if (er) er.textContent = msg || ""; if (msg) ok = false; };
  setErr("#fee-enquiry-search", !enquiryId ? "Search and pick a student." : "");
  setErr("#fee-amount", !(amount > 0) ? "Enter a valid amount." : "");
  if (!ok) return;
  const payload = { enquiryId, amount, paymentDate: $("#fee-date").value, mode: $("#fee-mode").value, notes: $("#fee-notes").value.trim() };
  const btn = $("#feeSubmit"); btn.disabled = true; btn.textContent = "Saving…";
  try {
    const created = await Api.fees.create(payload);
    if (created && created.id != null) state.fees.push(Object.assign({ createdAt: new Date().toISOString() }, payload, created));
    else state.fees = await Api.fees.list();
    form.reset(); $$("#feeForm .fld.bad").forEach(f => { f.classList.remove("bad"); const er = $(".err", f); if (er) er.textContent = ""; });
    $("#fee-enquiry-search").value = "";
    fillFeeForm();
    toast("Payment recorded successfully.");
    renderFeeStats(); renderFeeTable();
  } catch (err) {
    if (err.code === 401) return showLogin(err.message);
    toast(err.message, true);
  } finally { btn.disabled = false; btn.textContent = "Save payment"; }
}
async function deleteFee(id) {
  const ok = await confirmDialog({ title: "Delete this payment?", message: "This removes the payment record permanently.", confirmText: "Delete payment", danger: true });
  if (!ok) return;
  try {
    await Api.fees.remove(id);
    state.fees = state.fees.filter(f => String(f.id) !== String(id));
    toast("Payment deleted"); renderFeeStats(); renderFeeTable();
  } catch (err) {
    if (err.code === 401) return showLogin(err.message);
    toast(err.message, true);
  }
}

/* =====================================================================
   Reminders (bell)
   ===================================================================== */
function dueList() {
  const today = sod(new Date());
  return state.enquiries.filter(isPendingFU).map(e => ({ e, d: parse(e.followUpDate) })).filter(x => x.d)
    .map(x => ({ e: x.e, diff: dayDiff(today, x.d) })).filter(x => x.diff <= 1).sort((a, b) => a.diff - b.diff);
}
function renderDailyReminder() {
  const card = $("#dailyReminder");
  if (state.loading) { card.hidden = true; return; }
  const key = "lbstimn_daily_dismiss_" + isoDay(new Date());
  let dismissed = false; try { dismissed = !!sessionStorage.getItem(key); } catch (e) {}
  const list = dueList(), dueToday = list.filter(x => x.diff === 0).length, overdue = list.filter(x => x.diff < 0).length;
  if (dismissed || (!dueToday && !overdue)) { card.hidden = true; return; }
  $("#drText").textContent = "You have " + dueToday + (dueToday === 1 ? " follow-up" : " follow-ups") + " scheduled for today, and " + overdue + " overdue follow-up" + (overdue === 1 ? "" : "s") + ".";
  card.hidden = false;
}
function dismissDailyReminder() {
  try { sessionStorage.setItem("lbstimn_daily_dismiss_" + isoDay(new Date()), "1"); } catch (e) {}
  $("#dailyReminder").hidden = true;
}
function renderReminders() {
  const list = dueList(), due = list.filter(x => x.diff <= 0).length, badge = $("#bellCount");
  badge.textContent = due > 99 ? "99+" : due; badge.hidden = !due;
  $("#remList").innerHTML = list.length ? list.slice(0, 30).map(x => {
    const cls = x.diff < 0 ? "over" : x.diff === 0 ? "today" : "";
    const txt = x.diff < 0 ? Math.abs(x.diff) + "d overdue" : x.diff === 0 ? "Today" : "Tomorrow";
    return '<li><button type="button" data-open="' + esc(x.e.id) + '"><span class="who"><b>' + esc(x.e.name) + "</b><span>" + esc(x.e.course || "") + " · " + esc(x.e.phone) + '</span></span><span class="when ' + cls + '">' + txt + "</span></button></li>";
  }).join("") : '<li class="rp-empty">No follow-ups due. You\'re all caught up.</li>';
  const nb = $("#notifyBtn"); nb.hidden = !("Notification" in window) || Notification.permission !== "default";
  if ("Notification" in window && Notification.permission === "granted" && due) {
    const key = "lbstimn_notified_" + isoDay(new Date());
    try { if (!sessionStorage.getItem(key)) { sessionStorage.setItem(key, "1"); new Notification("Follow-up reminders", { body: due + (due === 1 ? " follow-up is" : " follow-ups are") + " due today or overdue." }); } } catch (e) {}
  }
}
function toggleBell(force) {
  const p = $("#remPanel"), open = force != null ? force : p.hidden;
  p.hidden = !open; $("#bellBtn").setAttribute("aria-expanded", String(open));
}

function renderAll() { renderStats(); renderRecent(); renderCharts(); renderFilterOptions(); renderTable(); renderFeeStats(); renderFeeTable(); renderReminders(); renderDailyReminder(); $("#tableCount").textContent = " (" + state.enquiries.length + ")"; hydrateIcons(document); }

/* =====================================================================
   Data loading (with instant paint from cache)
   ===================================================================== */
const CACHE_KEY = "lbstimn_cache_v1";
const readCache = () => { try { const c = JSON.parse(localStorage.getItem(CACHE_KEY) || "null"); return c && Array.isArray(c.data) ? c.data : null; } catch (e) { return null; } };
const writeCache = d => { try { localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), data: d })); } catch (e) {} };
const clearCache = () => { try { localStorage.removeItem(CACHE_KEY); } catch (e) {} };
function spinRefresh(on) { ["#refreshIco", "#tRefreshIco"].forEach(s => $(s).classList.toggle("spin", on)); }

async function load(silent) {
  $("#errBanner").hidden = true;
  if (!silent) { state.loading = true; renderAll(); }
  spinRefresh(true);
  try {
    const [enquiries, fees] = await Promise.all([Api.list(), Api.fees.list().catch(() => state.fees)]);
    state.enquiries = enquiries; state.fees = fees;
    state.loading = false;
    if (!Api.demo) writeCache(state.enquiries);
  } catch (err) {
    state.loading = false;
    if (err.code === 401) { showLogin(err.message); return; }
    $("#errMsg").textContent = isNet(err) ? " The server couldn't be reached. Check API_BASE in js/config.js and that your backend allows requests from this page (CORS)." : " " + err.message;
    $("#errBanner").hidden = false;
  } finally { spinRefresh(false); }
  renderAll();
}

/* =====================================================================
   Validation + selects
   ===================================================================== */
function validate(form) {
  let ok = true;
  const v = n => form.elements[n].value.trim();
  const set = (n, msg) => { const f = form.elements[n].closest(".fld"); f.classList.toggle("bad", !!msg); const er = $(".err", f); if (er) er.textContent = msg || ""; if (msg) ok = false; };
  set("name", v("name").length < 2 ? "Enter the student's name." : "");
  set("phone", v("phone").replace(/\D/g, "").length < 10 ? "Enter a valid 10-digit phone number." : "");
  set("course", !v("course") ? "Choose a course." : "");
  return ok;
}
function optionValues(field, defaults, extra) {
  const out = defaults.slice(); uniq(field).forEach(v => { if (out.indexOf(v) === -1) out.push(v); });
  if (extra && out.indexOf(extra) === -1) out.push(extra);
  return out;
}
function fillSelect(sel, values, cur, placeholder) {
  sel.innerHTML = (placeholder ? '<option value="">' + placeholder + "</option>" : "") + values.map(v => "<option>" + esc(v) + "</option>").join("");
  sel.value = cur || "";
}
function fillNewFormOptions() {
  fillSelect($("#f-course"), optionValues("course", Model.COURSES), $("#f-course").value, "Select Course");
  fillSelect($("#f-batch"), optionValues("batch", CONFIG.BATCHES || []), $("#f-batch").value, "Select Batch");
  fillSelect($("#f-source"), optionValues("source", Model.SOURCES), $("#f-source").value, "Select Source");
  fillSelect($("#f-assigned"), counselorList(), $("#f-assigned").value, "Select Counselor");
  fillSelect($("#f-status"), OPEN, $("#f-status").value || OPEN[0], "Select Status");
  const d = $("#f-date"); if (!d.value) d.value = isoDay(new Date());
}

/* =====================================================================
   Edit lead modal
   ===================================================================== */
const snapshot = e => ({ name: e.name, phone: e.phone, city: e.city, course: e.course, batch: e.batch, source: e.source, status: e.status, assignedTo: e.assignedTo, followUpDate: parse(e.followUpDate) ? isoDay(parse(e.followUpDate)) : "", notes: e.notes });
function formVals() {
  const f = $("#editForm").elements, o = {};
  ["name", "phone", "city", "course", "batch", "source", "status", "assignedTo", "followUpDate", "notes"].forEach(k => { o[k] = f[k].value.trim(); });
  return o;
}
const isDirty = () => { if (!state.edit) return false; const v = formVals(), o = state.edit.orig; return Object.keys(v).some(k => v[k] !== (o[k] || "")); };

function renderStatusField(e) {
  const sel = $("#e-status");
  if (e.status === CONFIRMED) { sel.innerHTML = "<option>" + CONFIRMED + "</option>"; sel.value = CONFIRMED; sel.disabled = true; sel.title = "Use Confirm admission to change a confirmed lead."; }
  else { sel.disabled = false; sel.title = ""; sel.innerHTML = OPEN.concat(["Dropped"]).map(s => "<option>" + s + "</option>").join(""); sel.value = e.status; }
  $("#mStatus").innerHTML = pill(e.status);
}
function renderAdmit(e) {
  const el = $("#admit");
  if (e.status === CONFIRMED) {
    el.className = "admit done";
    el.innerHTML = '<span class="ai">' + icon("shieldCheck", 20) + '</span><div class="tx"><b>Admission confirmed</b><span>This lead has been marked Confirmed.</span></div>';
  } else {
    el.className = "admit";
    el.innerHTML = '<span class="ai">' + icon("shieldCheck", 20) + '</span><div class="tx"><b>Admission confirmation</b><span>Confirm once the parent has agreed.</span></div><button class="btn success sm" id="admitBtn" type="button" data-confirm="' + esc(e.id) + '">Confirm admission</button>';
  }
}
function openEdit(id) {
  const e = state.enquiries.find(x => String(x.id) === String(id)); if (!e) return;
  toggleBell(false);
  state.edit = { id: e.id, orig: snapshot(e), remarks: [], rstate: "loading", opener: document.activeElement };
  const f = $("#editForm").elements;
  fillSelect($("#e-course"), optionValues("course", Model.COURSES, e.course), e.course, "Select Course");
  fillSelect($("#e-batch"), optionValues("batch", CONFIG.BATCHES || [], e.batch), e.batch, "Select Batch");
  fillSelect($("#e-source"), optionValues("source", Model.SOURCES, e.source), e.source, "Select Source");
  fillSelect($("#e-assigned"), counselorList(), e.assignedTo, "Select Counselor");
  ["name", "phone", "city", "followUpDate", "notes"].forEach(k => { f[k].value = state.edit.orig[k] || ""; });
  $$("#editForm .fld.bad").forEach(x => { x.classList.remove("bad"); const er = $(".err", x); if (er) er.textContent = ""; });
  $("#mTitle").textContent = e.name || "Edit lead";
  $("#mSub").textContent = "Enquired on " + fmtDate(e.createdAt);
  renderStatusField(e); renderAdmit(e);
  $("#remText").value = ""; syncRemBtn();
  $("#notesTranslateBox").hidden = true; $("#remTranslateBox").hidden = true; $("#notesVoiceState").textContent = ""; $("#voiceState").textContent = "";
  renderRemarks();
  $("#editOverlay").hidden = false; document.body.style.overflow = "hidden";
  setTimeout(() => $("#e-name").focus(), 30);
  loadRemarks();
}
function closeEdit() {
  stopVoice();
  $("#editOverlay").hidden = true; document.body.style.overflow = "";
  const op = state.edit && state.edit.opener; state.edit = null;
  if (op && op.focus && document.contains(op)) op.focus();
}
async function requestClose() {
  if (isDirty() || $("#remText").value.trim()) {
    const ok = await confirmDialog({ title: "Discard your changes?", message: "You have unsaved changes on this lead. They will be lost.", confirmText: "Discard changes", danger: true });
    if (!ok) return;
  }
  closeEdit();
}
async function saveEdit() {
  const s = state.edit; if (!s) return;
  const e = state.enquiries.find(x => String(x.id) === String(s.id)); if (!e) return;
  if (!validate($("#editForm"))) { const bad = $("#editForm .fld.bad .input, #editForm .fld.bad .select"); if (bad) bad.focus(); return; }
  const vals = formVals(), patch = {};
  Object.keys(vals).forEach(k => { if (vals[k] !== (s.orig[k] || "")) patch[k] = vals[k]; });
  if (!Object.keys(patch).length) { toast("No changes to save"); return; }
  if (patch.status === "Dropped") {
    const ok = await confirmDialog({ title: "Mark this lead as dropped?", message: (e.name || "This lead") + " will be counted as a dropped enquiry.", confirmText: "Mark as dropped", danger: true });
    if (!ok) return;
  }
  const btn = $("#mSave"); btn.disabled = true; btn.textContent = "Saving…";
  try {
    await Api.update(e.id, patch);
    Object.assign(e, patch);
    toast("Lead updated successfully.");
    closeEdit(); renderAll();
  } catch (err) {
    if (err.code === 401) return showLogin(err.message);
    toast(err.message, true);
  } finally { btn.disabled = false; btn.textContent = "Save changes"; }
}
async function deleteEdit() {
  const s = state.edit; if (!s) return;
  const e = state.enquiries.find(x => String(x.id) === String(s.id));
  const ok = await confirmDialog({ title: "Delete this lead?", message: "This permanently removes " + ((e && e.name) || "the lead") + " and cannot be undone.", confirmText: "Delete lead", danger: true });
  if (!ok) return;
  const btn = $("#mDelete"); btn.disabled = true;
  try {
    await Api.remove(s.id);
    state.enquiries = state.enquiries.filter(x => String(x.id) !== String(s.id));
    if (!Api.demo) writeCache(state.enquiries);
    toast("Lead deleted successfully."); closeEdit(); renderAll();
  } catch (err) {
    if (err.code === 401) return showLogin(err.message);
    toast(err.message, true);
  } finally { btn.disabled = false; }
}

/* ---------- admission confirmation (kept separate from normal edits) ---------- */
async function confirmAdmission(id) {
  const e = state.enquiries.find(x => String(x.id) === String(id)); if (!e || e.status === CONFIRMED) return;
  const ok = await confirmDialog({ title: "Confirm admission?", message: (e.name || "This student") + " will be marked as Converted. Use this only after the admission is confirmed.", confirmText: "Confirm admission", success: true });
  if (!ok) return;
  const inModal = state.edit && String(state.edit.id) === String(e.id);
  const btn = inModal ? $("#admitBtn") : null; if (btn) { btn.disabled = true; btn.textContent = "Confirming…"; }
  try {
    await Api.confirm(e.id);
    e.status = CONFIRMED;
    toast("Admission confirmed for " + (e.name || "student"));
    if (state.edit && String(state.edit.id) === String(e.id)) { state.edit.orig.status = CONFIRMED; renderStatusField(e); renderAdmit(e); }
    renderAll();
  } catch (err) {
    if (err.code === 401) return showLogin(err.message);
    toast(err.message, true);
    if (btn) { btn.disabled = false; btn.textContent = "Confirm admission"; }
  }
}

/* ---------- remarks timeline ---------- */
async function loadRemarks() {
  const s = state.edit; if (!s) return;
  s.rstate = "loading"; renderRemarks();
  try { const list = await Api.remarks(s.id); if (state.edit !== s) return; s.remarks = list.slice().sort((a, b) => (+parse(a.createdAt) || 0) - (+parse(b.createdAt) || 0)); s.rstate = "ok"; }
  catch (err) { if (state.edit !== s) return; if (err.code === 401) return showLogin(err.message); s.rstate = "error"; s.rerr = err.code === 404 ? "Remarks aren't available on the server yet." : err.message; }
  renderRemarks();
}
function renderRemarks() {
  const s = state.edit, tl = $("#timeline"); if (!s) return;
  $("#remCount").textContent = s.rstate === "ok" && s.remarks.length ? s.remarks.length + (s.remarks.length === 1 ? " entry" : " entries") : "";
  if (s.rstate === "loading") { tl.innerHTML = '<div class="skel" style="height:52px;margin:10px 0"></div><div class="skel" style="height:52px;margin:10px 0"></div>'; return; }
  if (s.rstate === "error") { tl.innerHTML = emptyBox("alert", "Couldn't load remarks", esc(s.rerr || ""), '<br><button class="btn sm" id="remRetry" type="button">Try again</button>'); return; }
  if (!s.remarks.length) { tl.innerHTML = emptyBox("inbox", "No remarks yet", "Add the first note about this lead below."); return; }
  tl.innerHTML = s.remarks.map(r => {
    const who = r.author || "Admin";
    return '<div class="entry"><span class="av" style="background:' + avColor(who) + '">' + esc(initials(who)) + '</span><div class="bubble"><div class="who"><b>' + esc(who) + "</b><span>" + esc(fmtDateTime(r.createdAt)) + "</span></div><p>" + esc(r.text) + "</p></div></div>";
  }).join("");
  tl.scrollTop = tl.scrollHeight;
}
function syncRemBtn() { $("#remAdd").disabled = !$("#remText").value.trim(); }
async function addRemark() {
  const s = state.edit, ta = $("#remText"), text = ta.value.trim(); if (!s || !text) return;
  stopVoice();
  const btn = $("#remAdd"); btn.disabled = true;
  try {
    const res = await Api.addRemark(s.id, text, state.user.name);
    if (state.edit !== s) return;
    s.remarks.push({ id: (res && res.id) || "t" + Date.now(), text: (res && res.text) || text, author: (res && res.author) || state.user.name, createdAt: (res && res.createdAt) || new Date().toISOString() });
    s.rstate = "ok"; ta.value = ""; renderRemarks(); toast("Note added successfully.");
  } catch (err) {
    if (err.code === 401) return showLogin(err.message);
    toast(err.message, true);
  } finally { syncRemBtn(); }
}

/* ---------- voice dictation (speech to text) ----------
   Generalised so every remarks/notes field (new-lead form, edit-lead
   notes, remarks composer) has its own mic + language picker. Only one
   recognizer runs at a time. */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const VOICE_TARGETS = {
  newNotes: { ta: "#f-notes", mic: "#fMicBtn", lang: "#fVoiceLang", state: "#fVoiceState", onInput: null },
  editNotes: { ta: "#e-notes", mic: "#notesMicBtn", lang: "#notesVoiceLang", state: "#notesVoiceState", onInput: null },
  remarks: { ta: "#remText", mic: "#micBtn", lang: "#voiceLang", state: "#voiceState", onInput: syncRemBtn }
};
const voice = { rec: null, on: false, active: null };
function voiceUI(key, on, msg) {
  const t = VOICE_TARGETS[key];
  const b = $(t.mic); b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on));
  $(t.state).textContent = msg || "";
}
function setupVoice() {
  Object.keys(VOICE_TARGETS).forEach(key => {
    const t = VOICE_TARGETS[key];
    try { const l = localStorage.getItem("lbstimn_voice_lang"); if (l) $(t.lang).value = l; } catch (e) {}
    if (!SR) { $(t.mic).disabled = true; $(t.lang).disabled = true; $(t.state).textContent = "Voice input works in Chrome or Edge."; }
  });
}
function startVoice(key) {
  if (voice.on) stopVoice();
  const t = VOICE_TARGETS[key], ta = $(t.ta), rec = new SR();
  rec.lang = $(t.lang).value; rec.interimResults = true; rec.continuous = true;
  const base = ta.value && !/\s$/.test(ta.value) ? ta.value + " " : ta.value; let fin = "";
  rec.onstart = () => { voice.on = true; voice.active = key; voiceUI(key, true, "Listening…"); };
  rec.onresult = ev => {
    let interim = "";
    for (let i = ev.resultIndex; i < ev.results.length; i++) { const tr = ev.results[i][0].transcript; if (ev.results[i].isFinal) fin += tr.trim() + " "; else interim += tr; }
    ta.value = base + fin + interim; if (t.onInput) t.onInput();
  };
  rec.onerror = ev => {
    const m = { "not-allowed": "Microphone access is blocked. Allow it in your browser settings.", "service-not-allowed": "Microphone access is blocked. Allow it in your browser settings.", "no-speech": "Didn't catch that. Try again.", "audio-capture": "No microphone found.", "network": "Voice service unreachable. Check your connection." };
    voiceUI(key, false, m[ev.error] || "Voice input stopped.");
  };
  rec.onend = () => {
    voice.on = false; voice.active = null;
    if (fin) { ta.value = (base + fin).replace(/\s+$/, ""); if (t.onInput) t.onInput(); }
    const st = $(t.state); voiceUI(key, false, /blocked|found|reach|catch/.test(st.textContent) ? st.textContent : "");
  };
  voice.rec = rec;
  try { rec.start(); } catch (e) { voiceUI(key, false, "Couldn't start voice input."); }
}
function stopVoice() { if (voice.rec && voice.on) { try { voice.rec.stop(); } catch (e) {} } }

/* ---------- translation (remarks / notes) ----------
   Translates dictated text (e.g. Hindi) into English in a preview box,
   WITHOUT overwriting what was typed. The person chooses to insert it.
   Real API integration point -- no fabricated results: if the request
   fails (no internet, no key, blocked), the error is shown honestly. */
const TRANSLATE_TARGETS = {
  newNotes: { ta: "#f-notes", btn: "#fTranslateBtn", box: "#fTranslateBox" },
  editNotes: { ta: "#e-notes", btn: "#notesTranslateBtn", box: "#notesTranslateBox" },
  remarks: { ta: "#remText", btn: "#remTranslateBtn", box: "#remTranslateBox" }
};
async function translateText(text) {
  const cfg = CONFIG.TRANSLATE || {};
  if (!text) throw new Error("Nothing to translate yet.");
  if (!cfg.provider || cfg.provider === "none") throw new Error("Translation isn't set up for this site yet.");
  if (cfg.provider === "google") {
    if (!cfg.apiKey) throw new Error("Add a Google Translate API key in js/config.js to enable this.");
    const res = await fetch("https://translation.googleapis.com/language/translate/v2?key=" + encodeURIComponent(cfg.apiKey), {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: text, target: cfg.targetLang || "en" })
    });
    if (!res.ok) throw new Error("Translation service returned an error.");
    const data = await res.json();
    const t = data && data.data && data.data.translations && data.data.translations[0];
    if (!t || !t.translatedText) throw new Error("No translation returned.");
    return t.translatedText;
  }
  const url = "https://api.mymemory.translated.net/get?q=" + encodeURIComponent(text) + "&langpair=auto|" + (cfg.targetLang || "en");
  const res = await fetch(url);
  if (!res.ok) throw new Error("Translation service returned an error.");
  const data = await res.json();
  const t = data && data.responseData && data.responseData.translatedText;
  if (!t) throw new Error("No translation returned.");
  return t;
}
function setupTranslate() {
  Object.keys(TRANSLATE_TARGETS).forEach(key => { $(TRANSLATE_TARGETS[key].btn).addEventListener("click", () => runTranslate(key)); });
}
async function runTranslate(key) {
  const t = TRANSLATE_TARGETS[key], ta = $(t.ta), box = $(t.box), btn = $(t.btn);
  const text = ta.value.trim();
  box.hidden = false; box.innerHTML = '<div class="tr-loading">Translating…</div>';
  btn.disabled = true;
  try {
    const translated = await translateText(text);
    box.innerHTML = '<div class="tr-label">Translation (EN)</div><p>' + esc(translated) + '</p><div class="tr-actions"><button class="btn sm" type="button" data-tr-insert>Insert below original</button><button class="btn sm" type="button" data-tr-dismiss>Dismiss</button></div>';
    $("[data-tr-insert]", box).addEventListener("click", () => {
      ta.value = ta.value.replace(/\s+$/, "") + (ta.value.trim() ? "\n\n" : "") + "Translation (EN): " + translated;
      if (key === "remarks") syncRemBtn();
      box.hidden = true;
    });
    $("[data-tr-dismiss]", box).addEventListener("click", () => { box.hidden = true; });
  } catch (err) {
    const msg = isNet(err) ? "Couldn't reach the translation service. Check your connection." : err.message;
    box.innerHTML = '<div class="tr-error">' + esc(msg) + "</div>";
  } finally { btn.disabled = false; }
}

/* =====================================================================
   New enquiry form
   ===================================================================== */
async function submitNew(ev) {
  ev.preventDefault();
  const form = ev.target;
  if (!validate(form)) { const bad = $(".fld.bad .input, .fld.bad .select", form); if (bad) bad.focus(); return; }
  const v = n => form.elements[n].value.trim();
  const data = { name: v("name"), phone: v("phone"), city: v("city"), course: v("course"), batch: v("batch"), source: v("source"), status: v("status") || OPEN[0], assignedTo: v("assignedTo"), followUpDate: v("followUpDate"), notes: v("notes") };
  const btn = $("#formSubmit"); btn.disabled = true; btn.textContent = "Saving…";
  try {
    const created = await Api.create(data);
    if (created && created.id !== "" && created.id != null) state.enquiries.push(Object.assign({ createdAt: new Date().toISOString() }, data, created));
    else state.enquiries = await Api.list();
    if (!Api.demo) writeCache(state.enquiries);
    form.reset(); $$(".fld.bad", form).forEach(f => { f.classList.remove("bad"); const er = $(".err", f); if (er) er.textContent = ""; });
    fillNewFormOptions();
    toast("Lead added successfully.");
    state.table.sort = { key: "createdAt", dir: "desc" }; state.table.page = 1;
    renderAll(); setTab("table");
  } catch (err) {
    if (err.code === 401) return showLogin(err.message);
    toast(err.message, true);
  } finally { btn.disabled = false; btn.textContent = "Save Lead"; }
}

/* =====================================================================
   Tabs, shell, auth
   ===================================================================== */
function setTab(name) {
  const feesOpen = name === "fees";
  if (feesOpen && !canAccessFees()) { toast("Fees access is limited to admins and counsellors.", true); return; }
  state.tab = name;
  $$(".tab").forEach(t => t.setAttribute("aria-selected", String(!feesOpen && t.dataset.tab === name)));
  ["dashboard", "new", "table"].forEach(tab => { $("#tab-" + tab).hidden = feesOpen || tab !== name; });
  $("#tab-fees").hidden = !feesOpen;
  $("#enquiryHead").hidden = feesOpen;
  $("#enquiryTabs").hidden = feesOpen;
  $("#errBanner").hidden = feesOpen || $("#errMsg").textContent === "";
  $("#dashControls").hidden = feesOpen || name !== "dashboard";
  $("#navEnquiries").toggleAttribute("aria-current", !feesOpen);
  if (feesOpen) $("#navFees").setAttribute("aria-current", "page");
  else $("#navFees").removeAttribute("aria-current");
  if (name === "new") { fillNewFormOptions(); setTimeout(() => $("#f-name").focus(), 30); }
  if (feesOpen) { fillFeeForm(); renderFeeStats(); renderFeeTable(); setFeeTab("dashboard"); }
  navOpen(false);
  window.scrollTo({ top: 0 });
}
function canAccessFees() {
  const role = String(state.user && state.user.role || "").trim().toLowerCase();
  return role === "admin" || role === "counselor" || role === "counsellor";
}
function setUser(u) {
  state.user = u; const n = (u && u.name) || "user";
  $("#sbName").textContent = n; $("#sbRole").textContent = (u && u.role) || "counselor";
  $("#sbAvatar").textContent = initials(n); $("#topAvatar").textContent = n.charAt(0).toUpperCase(); $("#topName").textContent = n;
  try { localStorage.setItem("lbstimn_user", JSON.stringify(u)); } catch (e) {}
  $("#navFees").hidden = !canAccessFees();
  if (!canAccessFees() && state.tab === "fees") setTab("dashboard");
}
function hideSplash() { const sp = $("#bootSplash"); if (sp) sp.hidden = true; }
function showLogin(msg) {
  hideSplash();
  Api.logout(); clearCache(); state.enquiries = [];
  if (state.edit) closeEdit();
  $("#app").hidden = true; $("#login").hidden = false; $("#loginErr").textContent = msg || "";
  setTimeout(() => $("#lu").focus(), 30);
}
function showApp() {
  hideSplash();
  $("#login").hidden = true; $("#app").hidden = false;
  $("#modeChip").hidden = !Api.demo;
  const cached = !Api.demo ? readCache() : null;
  if (cached) { state.enquiries = cached; state.loading = false; renderAll(); load(true); } else load(false);
  startRealtime();
}
let realtimeChannel = null;
function startRealtime() {
  if (realtimeChannel || Api.demo) return; // demo mode has nothing to subscribe to
  realtimeChannel = Api.subscribe(() => load(true)); // silent background refresh on any DB change
}
function navOpen(on) { $("#app").classList.toggle("nav-open", on); $("#navBackdrop").hidden = !on; }

async function boot() {
  try { await Api.init(); } catch (e) { console.error(e); }
  if (Api.sdkError) toast(Api.sdkError + " Showing demo data.", true);
  const org = CONFIG.ORG;
  $$("[data-org-name]").forEach(el => { el.textContent = org.name; });
  $$("[data-org-tag]").forEach(el => { el.textContent = org.tagline; });
  $$("[data-org-fullname]").forEach(el => { el.textContent = org.fullName || org.name; });
  $("#domain").textContent = org.domain; $("#fdomain").textContent = org.domain;
  $("#fyear").textContent = new Date().getFullYear();
  $$("[data-logo]").forEach(el => { el.innerHTML = org.logoUrl ? '<img src="' + esc(org.logoUrl) + '" alt="">' : "<span>" + esc(org.initials) + "</span>"; });
  hydrateIcons(document);
  setupVoice();
  setupTranslate();
  if (!CONFIG.TRANSLATE || CONFIG.TRANSLATE.provider === "none") { ["#fTranslateBtn", "#notesTranslateBtn", "#remTranslateBtn"].forEach(s => { const el = $(s); if (el) el.hidden = true; }); }
  fillNewFormOptions();
  renderFilterOptions(); renderTable();

  if (Api.mode === "supabase") {
    const u = await Auth.init();
    if (u) { setUser({ name: u.fullName, role: u.role }); showApp(); } else showLogin("");
    return;
  }
  let saved = null; try { saved = JSON.parse(localStorage.getItem("lbstimn_user") || "null"); } catch (e) {}
  setUser(saved || { name: "user", role: "counselor" });
  const needsLogin = !Api.demo && CONFIG.AUTH_MODE === "token" && !Api.hasToken();
  if (needsLogin) showLogin(""); else showApp();
}

/* =====================================================================
   Events
   ===================================================================== */
$("#loginForm").addEventListener("submit", async ev => {
  ev.preventDefault();
  const u = $("#lu").value.trim(), p = $("#lp").value;
  if (!u || !p) { $("#loginErr").textContent = "Enter your username and password."; return; }
  const b = $("#loginBtn"); b.disabled = true; b.textContent = "Signing in…"; $("#loginErr").textContent = "";
  try { const r = await Api.login(u, p); setUser(r.user); $("#lp").value = ""; showApp(); }
  catch (err) { $("#loginErr").textContent = isNet(err) ? "Can't reach the server. Try again shortly." : (err.code === 401 ? "Incorrect email or password." : err.message); }
  finally { b.disabled = false; b.textContent = "Sign in"; }
});
$("#logout").addEventListener("click", () => { if (Api.demo) { toast("Signed out of demo"); return; } showLogin(""); });
$("#collapse").addEventListener("click", () => { const a = $("#app"); a.classList.toggle("collapsed"); $("#collapse").setAttribute("aria-label", a.classList.contains("collapsed") ? "Expand sidebar" : "Collapse sidebar"); });
$("#menuBtn").addEventListener("click", () => navOpen(!$("#app").classList.contains("nav-open")));
$("#navBackdrop").addEventListener("click", () => navOpen(false));
$("#refresh").addEventListener("click", () => load(false));
$("#tRefresh").addEventListener("click", () => load(false));
$("#retry").addEventListener("click", () => load(false));
$("#useDemo").addEventListener("click", () => { Api.forceDemo(); $("#modeChip").hidden = false; load(false); });
$("#viewAll").addEventListener("click", () => setTab("table"));
$("#navEnquiries").addEventListener("click", () => setTab(state.tab === "fees" ? "dashboard" : state.tab));
$("#navFees").addEventListener("click", () => setTab("fees"));
$$(".tab").forEach(t => t.addEventListener("click", () => setTab(t.dataset.tab)));

/* dashboard range */
function syncDashRange() { $("#dCustom").hidden = state.dash.kind !== "custom"; renderStats(); renderCharts(); }
$("#range").addEventListener("change", e => { state.dash.kind = e.target.value; syncDashRange(); });
$("#dFrom").addEventListener("change", e => { state.dash.from = e.target.value; syncDashRange(); });
$("#dTo").addEventListener("change", e => { state.dash.to = e.target.value; syncDashRange(); });

/* table filters */
let qTimer; $("#tq").addEventListener("input", e => { clearTimeout(qTimer); qTimer = setTimeout(() => { state.table.q = e.target.value.trim(); state.table.page = 1; renderTable(); }, 150); });
[["#tCourse", "course"], ["#tSource", "source"], ["#tStatus", "status"]].forEach(p => $(p[0]).addEventListener("change", e => { state.table[p[1]] = e.target.value; state.table.page = 1; renderTable(); }));
$("#tDate").addEventListener("change", e => { state.table.dateKind = e.target.value; state.table.page = 1; $("#tCustom").hidden = e.target.value !== "custom"; renderTable(); });
$("#tFrom").addEventListener("change", e => { state.table.from = e.target.value; state.table.page = 1; renderTable(); });
$("#tTo").addEventListener("change", e => { state.table.to = e.target.value; state.table.page = 1; renderTable(); });
$("#fClear").addEventListener("click", clearFilters);
$("#fToggle").addEventListener("click", openFilters);
$("#fClose").addEventListener("click", closeFilters);
$("#fDone").addEventListener("click", closeFilters);
$("#fScrim").addEventListener("click", closeFilters);
document.addEventListener("change", e => { if (e.target.id === "pSize") { state.table.size = parseInt(e.target.value, 10); state.table.page = 1; renderTable(); } });

$("#exportBtn").addEventListener("click", () => {
  const rows = tableRows(); if (!rows.length) { toast("Nothing to export", true); return; }
  const head = ["Name", "Phone", "Locality", "Course", "Batch", "Source", "Status", "Counselor", "Follow-up", "Created", "Remarks"];
  const q = v => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
  const csv = [head.map(q).join(",")].concat(rows.map(e => [e.name, e.phone, e.city, e.course, e.batch, e.source, e.status, e.assignedTo, parse(e.followUpDate) ? isoDay(parse(e.followUpDate)) : "", parse(e.createdAt) ? isoDay(parse(e.createdAt)) : "", e.notes].map(q).join(","))).join("\r\n");
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
  a.download = "enquiries-" + isoDay(new Date()) + ".csv"; document.body.appendChild(a); a.click(); a.remove();
  toast("Exported " + rows.length + " enquiries");
});

/* new enquiry form */
$("#enqForm").addEventListener("submit", submitNew);
$("#enqForm").addEventListener("reset", () => setTimeout(() => { $$("#enqForm .fld.bad").forEach(f => { f.classList.remove("bad"); const er = $(".err", f); if (er) er.textContent = ""; }); fillNewFormOptions(); }, 0));

/* fees */
$("#feeForm").addEventListener("submit", submitFee);
$("#feeForm").addEventListener("reset", () => setTimeout(() => { $$("#feeForm .fld.bad").forEach(f => { f.classList.remove("bad"); const er = $(".err", f); if (er) er.textContent = ""; }); fillFeeForm(); }, 0));
let feeQTimer; $("#fee-enquiry-search").addEventListener("input", e => { clearTimeout(feeQTimer); feeQTimer = setTimeout(() => populateFeeEnquiryOptions(e.target.value), 150); });
document.addEventListener("click", ev => { const el = ev.target.closest("[data-fee-delete]"); if (el) deleteFee(el.getAttribute("data-fee-delete")); });
$$('[data-fee-tab]').forEach(button => button.addEventListener("click", () => setFeeTab(button.dataset.feeTab)));
$("#issueReceiptBtn").addEventListener("click", issueReceipt);
$("#feeExportBtn").addEventListener("click", () => {
  const rows = state.fees.slice().sort((a, b) => (+parse(b.paymentDate) || 0) - (+parse(a.paymentDate) || 0));
  if (!rows.length) { toast("Nothing to export", true); return; }
  const head = ["Student", "Amount", "Mode", "Date", "Received by", "Notes"];
  const q = v => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
  const csv = [head.map(q).join(",")].concat(rows.map(f => [feeStudentName(f), f.amount, f.mode, f.paymentDate ? isoDay(parse(f.paymentDate)) : "", f.receivedBy, f.notes].map(q).join(","))).join("\r\n");
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
  a.download = "fee-payments-" + isoDay(new Date()) + ".csv"; document.body.appendChild(a); a.click(); a.remove();
  toast("Exported " + rows.length + " payments");
});

/* edit modal */
$("#mClose").addEventListener("click", requestClose);
$("#mCancel").addEventListener("click", requestClose);
$("#mSave").addEventListener("click", saveEdit);
$("#mDelete").addEventListener("click", deleteEdit);
$("#editForm").addEventListener("submit", ev => { ev.preventDefault(); saveEdit(); });
$("#editOverlay").addEventListener("mousedown", ev => { if (ev.target.id === "editOverlay") requestClose(); });
$("#remText").addEventListener("input", syncRemBtn);
$("#remText").addEventListener("keydown", ev => { if ((ev.ctrlKey || ev.metaKey) && ev.key === "Enter") { ev.preventDefault(); addRemark(); } });
$("#remAdd").addEventListener("click", addRemark);
Object.keys(VOICE_TARGETS).forEach(key => {
  const t = VOICE_TARGETS[key];
  $(t.mic).addEventListener("click", () => { voice.on && voice.active === key ? stopVoice() : startVoice(key); });
  $(t.lang).addEventListener("change", e => {
    try { localStorage.setItem("lbstimn_voice_lang", e.target.value); } catch (x) {}
    Object.keys(VOICE_TARGETS).forEach(k2 => { const el = $(VOICE_TARGETS[k2].lang); if (el !== e.target) el.value = e.target.value; });
    if (voice.on && voice.active === key) stopVoice();
  });
});
$("#f-name").closest("form").addEventListener("reset", () => setTimeout(() => { $("#fVoiceState").textContent = ""; $("#fTranslateBox").hidden = true; }, 0));

/* confirm dialog */
$("#cfOk").addEventListener("click", () => closeConfirm(true));
$("#cfCancel").addEventListener("click", () => closeConfirm(false));
$("#cfOverlay").addEventListener("mousedown", ev => { if (ev.target.id === "cfOverlay") closeConfirm(false); });

/* reminders */
$("#bellBtn").addEventListener("click", ev => { ev.stopPropagation(); toggleBell(); });
$("#drClose").addEventListener("click", dismissDailyReminder);
$("#remPanel").addEventListener("click", ev => ev.stopPropagation());
$("#notifyBtn").addEventListener("click", async () => { try { await Notification.requestPermission(); } catch (e) {} renderReminders(); });
document.addEventListener("click", () => toggleBell(false));

/* delegated row / pager / misc actions */
document.addEventListener("click", ev => {
  const t = ev.target;
  let el;
  if ((el = t.closest("[data-open]"))) { openEdit(el.getAttribute("data-open")); return; }
  if ((el = t.closest("[data-confirm]"))) { confirmAdmission(el.getAttribute("data-confirm")); return; }
  if ((el = t.closest("[data-sort]"))) { const k = el.getAttribute("data-sort"), s = state.table.sort; state.table.sort = { key: k, dir: s.key === k && s.dir === "asc" ? "desc" : "asc" }; state.table.page = 1; renderTable(); return; }
  if ((el = t.closest("[data-page]"))) { state.table.page += parseInt(el.getAttribute("data-page"), 10); renderTable(); return; }
  if ((el = t.closest("[data-tab-go]"))) { setTab(el.getAttribute("data-tab-go")); return; }
  if (t.closest("[data-clear-filters]")) { clearFilters(); return; }
  if (t.closest("#remRetry")) { loadRemarks(); }
});

/* keyboard: Escape layers + focus trap */
document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    if (!$("#cfOverlay").hidden) { closeConfirm(false); return; }
    if (!$("#editOverlay").hidden) { requestClose(); return; }
    if ($("#filters").classList.contains("open")) { closeFilters(); return; }
    if (!$("#remPanel").hidden) { toggleBell(false); $("#bellBtn").focus(); return; }
    if ($("#app").classList.contains("nav-open")) navOpen(false);
    return;
  }
  if (e.key === "Tab") {
    const box = !$("#cfOverlay").hidden ? $("#cfOverlay .dialog") : !$("#editOverlay").hidden ? $("#editOverlay .modal") : null;
    if (!box) return;
    const f = $$('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])', box).filter(x => x.offsetParent !== null || x === document.activeElement);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});

boot().catch(err => {
  // never leave the person on a blank/endless loading screen
  console.error(err);
  const sp = $("#bootSplash"); if (sp) { sp.hidden = false; sp.classList.add("err"); }
  $("#bootMsg").textContent = "Something went wrong while starting the portal. Please reload; if it keeps happening, check js/supabase.js and js/config.js.";
  const b = $("#bootRetry"); b.hidden = false; b.onclick = () => location.reload();
});
})();
