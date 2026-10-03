export const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const STATUSES = ["New", "No Response", "Counseling Scheduled", "Counseling done", "Confirmed", "Dropped"];
export const OPEN_STATUSES = ["New", "No Response", "Counseling Scheduled", "Counseling done"];

export const COURSES = [
  "ADCA (12 Months)", "DIT (12 Months)", "CTT (18 Months)", "NPTC (24 Months)", "NTC (12 Months)",
  "PTC (12 Months)", "DABC (12 Months)", "DEA (12 Months)", "DMM (12 Months)", "DWD (12 Months)",
  "DACS (12 Months)", "Full Stack Developer (8 Months)", "UI/UX Design (8 Months)", "DBC (6 Months)",
  "DASD (6 Months)", "DADA (6 Months)", "DDM (6 Months)", "DAFA (6 Months)", "DGD (6 Months)",
  "DADTP (6 Months)", "CMM (6 Months)", "CWD (6 Months)", "DOM (6 Months)", "CACS (6 Months)",
  "English Speaking Course (6 Months)", "Frontend Developer (4 Months)", "Backend Developer (4 Months)",
  "CCO (3 Months)", "Beautician (1/3 Months)", "MS-Word (1 Month)", "Advance Excel (2 Months)",
  "VBA (2 Months)", "C Language (1 Month)", "C++ Language (1 Month)", "Visual Basic (1 Month)",
  "Tally 9.0 with GST (2 Months)", "Tally Prime (2 Months)", "GST (3 Months)", "Java Core (1 Month)",
  "Java Advance / J2EE (2 Months)", "HTML / DHTML (45 Days)", "JavaScript (1 Month)", "Illustrator (1 Month)",
  "InDesign (1 Month)", "CorelDraw (1 Month)", "Photoshop (1 Month)", "SQL (1 Month)", "Python (2 Months)",
  "Premiere Pro (1 Month)", "After Effects (1 Month)", "Quark Express (1 Month)", "Busy with GST (1 Month)",
  "Cam CAD (1 Month)", "3D Max (2 Months)",
  // Additional coding tracks
  "MERN Stack Development (6 Months)", "Java Full Stack Development (6 Months)", "Python Full Stack Development (6 Months)",
  "Web Development (4 Months)", "React JS (2 Months)", "Node JS (2 Months)", "Data Structures & Algorithms (2 Months)",
  "AI & Machine Learning (3 Months)", "Data Science (4 Months)", "SQL & Database (1 Month)", "DevOps (2 Months)",
  "Cyber Security (3 Months)"
];

export const SOURCES = ["Website", "Meta Ads", "Google Ads", "Walk-in", "Referral", "Phone call", "Education fair"];

export const BATCHES = [
  "Morning (7 AM - 10 AM)",
  "Late Morning (10 AM - 1 PM)",
  "Afternoon (1 PM - 4 PM)",
  "Evening (4 PM - 7 PM)",
  "Weekend"
];

export const COUNSELORS = ["Sahil", "Harjot"];

export const FEE_ITEMS = [
  ["registrationFee", "Registration Fee"],
  ["maintenanceCharge", "Maintenance Charge"],
  ["enrollmentFee", "Enrollment Fee"],
  ["reinstatementFee", "Re-instatement Fee"],
  ["lateFee", "Late Fee"],
  ["extraCourseware", "Extra Courseware"],
  ["others", "Others"]
];

export const FEE_MODES = ["Cash", "Online", "Card", "Cheque", "UPI"];

export const SCOL = {
  "New": "#2563eb",
  "No Response": "#64748b",
  "Counseling Scheduled": "#7c3aed",
  "Counseling done": "#0d9488",
  "Confirmed": "#047857",
  "Dropped": "#b91c1c"
};

export const PALETTE = [
  "#2563eb", "#0d9488", "#f59e0b", "#7c3aed", "#e11d48", "#0891b2", "#65a30d", "#b45309"
];

export const ORG = {
  name: "LBSTIMN",
  fullName: "Lal Bahadur Shastri Training Institute",
  tagline: "Admissions CRM",
  domain: "lbstimn.com",
  initials: "LB",
  logoUrl: "/logo.png"
};

export const WHATSAPP_NUMBER = "919990352721";

// Date helpers
export const sod = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

export const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

export const dayDiff = (a, b) => {
  return Math.round((sod(b) - sod(a)) / 864e5);
};

export const localDate = (s) => {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s));
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
};

export const parseDate = (v) => {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v) ? null : v;
  const l = localDate(String(v));
  if (l) return l;
  const d = new Date(v);
  return isNaN(d) ? null : d;
};

export const fmtDate = (v) => {
  const d = parseDate(v);
  return d ? `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}` : "–";
};

export const fmtDay = (v) => {
  const d = parseDate(v);
  if (!d) return "–";
  const curYear = new Date().getFullYear();
  return `${d.getDate()} ${MON[d.getMonth()]}${d.getFullYear() === curYear ? "" : ` ${d.getFullYear()}`}`;
};

export const fmtShort = (d) => `${d.getDate()} ${MON[d.getMonth()]}`;

export const fmtDateTime = (v) => {
  const d = parseDate(v);
  if (!d) return "";
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  const ampm = h < 12 ? "AM" : "PM";
  const displayHour = h % 12 || 12;
  return `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}, ${displayHour}:${m} ${ampm}`;
};

export const isoDay = (d) => {
  const x = new Date(d);
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return `${x.getFullYear()}-${m}-${day}`;
};

// Avatar & Initials
export const initials = (n) => {
  const w = String(n || "").trim().split(/\s+/).filter(Boolean);
  return (w.length > 1 ? w[0][0] + w[1][0] : (w[0] || "?").slice(0, 2)).toUpperCase();
};

const AVCOL = ["#1d4ed8", "#5b4bd6", "#0b7f74", "#b45309", "#a3391b", "#0d6ea8", "#7c3aed"];
export const avColor = (n) => {
  let h = 0;
  for (const c of String(n || "")) {
    h = (h * 31 + c.charCodeAt(0)) >>> 0;
  }
  return AVCOL[h % AVCOL.length];
};

export const slug = (s) => String(s || "").toLowerCase().replace(/[^a-z]/g, "");

// Range calculator
export function rangeOf(kind, from, to) {
  const today = sod(new Date());
  if (kind === "today") return { start: today, end: addDays(today, 1) };
  if (kind === "yesterday") return { start: addDays(today, -1), end: today };
  if (kind === "week") {
    const s = addDays(today, -((today.getDay() + 6) % 7));
    return { start: s, end: addDays(s, 7) };
  }
  if (kind === "month") {
    return { start: new Date(today.getFullYear(), today.getMonth(), 1), end: new Date(today.getFullYear(), today.getMonth() + 1, 1) };
  }
  if (kind === "lastmonth") {
    return { start: new Date(today.getFullYear(), today.getMonth() - 1, 1), end: new Date(today.getFullYear(), today.getMonth(), 1) };
  }
  if (kind === "custom") {
    const f = localDate(from);
    const t = localDate(to);
    return { start: f, end: t ? addDays(t, 1) : null };
  }
  return { start: null, end: null };
}

export function inRange(e, r) {
  if (!r.start && !r.end) return true;
  const d = parseDate(e.createdAt);
  if (!d) return false;
  return (!r.start || d >= r.start) && (!r.end || d < r.end);
}

export function isPendingFU(e) {
  return OPEN_STATUSES.includes(e.status) && !!parseDate(e.followUpDate);
}

// Convert numbers to Indian Rupees Words
export function numberToIndianWords(amount) {
  const value = Math.round(Number(amount) || 0);
  if (!value) return "Rupees Zero Only";

  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  const underThousand = (number) => {
    let words = "";
    if (number >= 100) {
      words += ones[Math.floor(number / 100)] + " Hundred ";
      number %= 100;
    }
    if (number >= 20) {
      words += tens[Math.floor(number / 10)] + " ";
      number %= 10;
    }
    if (number) {
      words += ones[number] + " ";
    }
    return words.trim();
  };

  let remaining = value;
  let words = "";
  const units = [[10000000, "Crore"], [100000, "Lakh"], [1000, "Thousand"], [1, ""]];

  for (const [unit, label] of units) {
    const part = Math.floor(remaining / unit);
    if (part) {
      words += underThousand(part) + (label ? " " + label : "") + " ";
      remaining %= unit;
    }
  }

  return "Rupees " + words.trim() + " Only";
}

// Fee breakdown calculations
export function feeBreakdownTotals(items = {}) {
  let cash = 0;
  let cheque = 0;
  for (const key of Object.keys(items)) {
    const item = items[key] || {};
    cash += Number(item.cash || 0);
    cheque += Number(item.cheque || 0);
  }
  return { cash, cheque };
}

// Translation helper using MyMemory or Google Translate
export async function translateText(text, targetLang = "en") {
  if (!text || !text.trim()) throw new Error("Nothing to translate yet.");
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.trim())}&langpair=auto|${targetLang}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Translation service is currently unreachable.");
  const data = await res.json();
  const translated = data?.responseData?.translatedText;
  if (!translated) throw new Error("No translation was returned.");
  return translated;
}
