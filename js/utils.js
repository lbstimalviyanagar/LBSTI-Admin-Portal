/* Shared helpers: DOM, escaping, dates, avatars */
const U = (function () {
  "use strict";
  const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const sod = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const dayDiff = (a, b) => Math.round((sod(b) - sod(a)) / 864e5);

  // "YYYY-MM-DD" strings are treated as local dates (avoids off-by-one in some time zones)
  const localDate = s => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
  const parse = v => {
    if (!v) return null;
    if (v instanceof Date) return isNaN(v) ? null : v;
    const l = localDate(String(v));
    if (l) return l;
    const d = new Date(v);
    return isNaN(d) ? null : d;
  };
  const fmtDate = v => { const d = parse(v); return d ? d.getDate() + " " + MON[d.getMonth()] + " " + d.getFullYear() : "–"; };
  const fmtDay = v => { const d = parse(v); if (!d) return "–"; return d.getDate() + " " + MON[d.getMonth()] + (d.getFullYear() === new Date().getFullYear() ? "" : " " + d.getFullYear()); };
  const fmtShort = d => d.getDate() + " " + MON[d.getMonth()];
  const fmtDateTime = v => {
    const d = parse(v); if (!d) return "";
    const h = d.getHours(), m = String(d.getMinutes()).padStart(2, "0");
    return d.getDate() + " " + MON[d.getMonth()] + " " + d.getFullYear() + ", " + (h % 12 || 12) + ":" + m + " " + (h < 12 ? "AM" : "PM");
  };
  const isoDay = d => { const x = new Date(d); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); };

  const initials = n => { const w = String(n || "").trim().split(/\s+/).filter(Boolean); return ((w.length > 1 ? w[0][0] + w[1][0] : (w[0] || "?").slice(0, 2))).toUpperCase(); };
  const AVCOL = ["#1d4ed8", "#5b4bd6", "#0b7f74", "#b45309", "#a3391b", "#0d6ea8", "#7c3aed"];
  const avColor = n => { let h = 0; for (const c of String(n || "")) h = (h * 31 + c.charCodeAt(0)) >>> 0; return AVCOL[h % AVCOL.length]; };

  return { MON, $, $$, esc, sod, addDays, dayDiff, localDate, parse, fmtDate, fmtDay, fmtShort, fmtDateTime, isoDay, initials, avColor };
})();
