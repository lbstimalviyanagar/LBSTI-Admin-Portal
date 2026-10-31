export const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const STATUSES = [
  "New Enquiry",
  "In Discussion",
  "Campus Visit Booked",
  "Admission Confirmed",
  "Deferred / Follow-up",
  "Lost / Closed"
];
export const OPEN_STATUSES = [
  "New Enquiry",
  "In Discussion",
  "Campus Visit Booked",
  "Deferred / Follow-up",
  "New",
  "No Response",
  "Counseling Scheduled",
  "Counseling done"
];

export function normalizeStatus(st) {
  if (!st) return "New Enquiry";
  const s = String(st).trim();
  const lower = s.toLowerCase();
  if (lower === "new" || lower === "new enquiry") return "New Enquiry";
  if (lower === "in discussion" || lower === "counseling scheduled" || lower === "counseling done") return "In Discussion";
  if (lower === "campus visit booked" || lower === "visit booked") return "Campus Visit Booked";
  if (lower === "admission confirmed" || lower === "confirmed" || lower === "admitted" || lower === "enrolled") return "Admission Confirmed";
  if (lower === "deferred / follow-up" || lower === "deferred" || lower === "follow-up" || lower === "followup" || lower === "no response") return "Deferred / Follow-up";
  if (lower === "lost / closed" || lower === "lost" || lower === "closed" || lower === "dropped") return "Lost / Closed";
  return s;
}

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

export const STANDARDIZED_SOURCES = [
  "Website",
  "Google",
  "Google Ads",
  "Meta Ads",
  "Referral",
  "Walk-in",
  "Rejoin",
  "Others"
];

export const SOURCES = STANDARDIZED_SOURCES;

export const BATCHES = [
  "08:00 AM - 09:00 AM",
  "09:00 AM - 10:00 AM",
  "10:00 AM - 11:00 AM",
  "11:00 AM - 12:00 PM",
  "12:00 PM - 01:00 PM",
  "01:00 PM - 02:00 PM",
  "02:00 PM - 03:00 PM",
  "03:00 PM - 04:00 PM",
  "04:00 PM - 05:00 PM",
  "05:00 PM - 06:00 PM",
  "06:00 PM - 07:00 PM",
  "07:00 PM - 08:00 PM"
];

export function normalizeLeadSource(src) {
  if (!src) return "Others";
  const s = String(src).trim();
  if (!s) return "Others";
  const lower = s.toLowerCase();

  if (lower.includes("rejoin") || lower.includes("re-join") || lower.includes("old student")) {
    return "Rejoin";
  }

  if (
    lower === "walkin" ||
    lower === "walk-in" ||
    lower === "walk in" ||
    lower === "walk_in" ||
    lower.includes("walk") ||
    lower === "direct" ||
    lower.includes("visit")
  ) {
    return "Walk-in";
  }

  if (
    lower.includes("ref") ||
    lower.includes("friend") ||
    lower.includes("mouth") ||
    lower.includes("recommend")
  ) {
    return "Referral";
  }

  if (
    lower === "google ads" ||
    lower === "google ad" ||
    lower.includes("adword") ||
    lower === "gads"
  ) {
    return "Google Ads";
  }

  if (
    lower === "google" ||
    lower === "google search" ||
    lower === "organic"
  ) {
    return "Google";
  }

  if (
    lower === "meta ads" ||
    lower === "meta ad" ||
    lower === "meta" ||
    lower.includes("meta") ||
    lower.includes("facebook") ||
    lower === "fb" ||
    lower === "fb ads" ||
    lower.includes("insta") ||
    lower.includes("social")
  ) {
    return "Meta Ads";
  }

  if (
    lower === "website" ||
    lower === "web" ||
    lower === "site" ||
    lower.includes("web") ||
    lower.includes("site") ||
    lower.includes("portal") ||
    lower.includes("landing") ||
    lower.includes("online")
  ) {
    return "Website";
  }

  for (const std of STANDARDIZED_SOURCES) {
    if (lower === std.toLowerCase()) return std;
  }

  if (lower === "other" || lower === "others" || lower === "unknown") return "Others";

  return s;
}

export function canonicalCounselorName(rawName) {
  if (!rawName) return '';
  const trimmed = String(rawName).trim();
  if (!trimmed) return '';
  const lower = trimmed.toLowerCase();
  if (lower === 'unassigned' || lower === 'none' || lower === '–' || lower === '-') return '';
  if (lower === 'sahil' || lower === 'sahil choudhary' || lower.startsWith('sahil choudh')) {
    return 'Sahil Choudhary';
  }
  if (lower === 'harjot' || lower === 'harjot kaur' || lower.startsWith('harjot k')) {
    return 'Harjot Kaur';
  }
  if (lower === 'palwasha' || lower.startsWith('palwasha')) {
    return 'Palwasha';
  }
  return trimmed;
}

export const COUNSELORS = ["Sahil Choudhary", "Harjot Kaur"];

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
  "New Enquiry": "#2563eb",
  "In Discussion": "#7c3aed",
  "Campus Visit Booked": "#0d9488",
  "Admission Confirmed": "#047857",
  "Deferred / Follow-up": "#d97706",
  "Lost / Closed": "#b91c1c",
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

export const formatDeadline = (v) => {
  if (!v) return "No deadline";
  let d = null;
  const raw = String(v).trim();
  const isoLike = raw.includes('T') ? raw : raw.replace(' ', 'T');
  d = new Date(isoLike);
  if (isNaN(d.getTime())) d = new Date(raw);
  if (isNaN(d.getTime())) return String(v);

  const now = new Date();
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  const ampm = h < 12 ? "AM" : "PM";
  const displayHour = h % 12 || 12;
  const timeStr = `${displayHour}:${m} ${ampm}`;

  const isToday = d.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  if (isToday) return `Today at ${timeStr}`;
  if (isTomorrow) return `Tomorrow at ${timeStr}`;
  if (isYesterday) return `Yesterday at ${timeStr}`;
  return `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()} at ${timeStr}`;
};

export const getTimeLeft = (deadlineInput, status = "") => {
  if (!deadlineInput) return null;
  const s = String(status || '').toLowerCase().trim();
  if (s === 'submitted' || s === 'completed') {
    return {
      text: s === 'submitted' ? 'Submitted' : 'Completed',
      color: 'green',
      isOverdue: false,
      isApproaching: false,
      isCompleted: true,
      diffMs: 0
    };
  }

  let deadlineDate = null;
  if (deadlineInput instanceof Date) {
    deadlineDate = deadlineInput;
  } else {
    const raw = String(deadlineInput).trim();
    const isoLike = raw.includes('T') ? raw : raw.replace(' ', 'T');
    const parsed = new Date(isoLike);
    if (!isNaN(parsed.getTime())) {
      deadlineDate = parsed;
    } else {
      deadlineDate = new Date(raw);
    }
  }

  if (!deadlineDate || isNaN(deadlineDate.getTime())) return null;

  const now = new Date();
  const diffMs = deadlineDate.getTime() - now.getTime();

  if (diffMs < 0) {
    const absDiff = Math.abs(diffMs);
    const mins = Math.floor(absDiff / 60000);
    const hrs = Math.floor(absDiff / 3600000);
    const days = Math.floor(hrs / 24);

    let text = "";
    if (mins < 60) {
      const m = Math.max(1, mins);
      text = `Overdue by ${m} minute${m === 1 ? '' : 's'}`;
    } else if (hrs < 24) {
      text = `Overdue by ${hrs} hour${hrs === 1 ? '' : 's'}`;
    } else {
      text = `Overdue by ${days} day${days === 1 ? '' : 's'}`;
    }

    return {
      text,
      color: 'red',
      isOverdue: true,
      isApproaching: false,
      diffMs
    };
  }

  const mins = Math.floor(diffMs / 60000);
  const hrs = Math.floor(diffMs / 3600000);
  const days = Math.floor(hrs / 24);

  let text = "";
  if (mins < 60) {
    const m = Math.max(1, mins);
    text = `Due in ${m} minute${m === 1 ? '' : 's'}`;
  } else if (hrs < 24) {
    text = `${hrs} hour${hrs === 1 ? '' : 's'} left`;
  } else {
    text = `${days} day${days === 1 ? '' : 's'} left`;
  }

  const isWithin24Hours = diffMs <= 24 * 3600 * 1000;
  const isApproaching = diffMs <= 2 * 3600 * 1000;

  return {
    text,
    color: isWithin24Hours ? 'orange' : 'green',
    isOverdue: false,
    isApproaching,
    diffMs
  };
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
    // Current calendar month: 1st day of month through end of current day (today)
    return { start: new Date(today.getFullYear(), today.getMonth(), 1), end: addDays(today, 1) };
  }
  if (kind === "fullmonth") {
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
  const d = parseDate(e.inquiryDate || e.createdAt);
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
  let online = 0;
  for (const key of Object.keys(items)) {
    const item = items[key] || {};
    cash += Number(item.cash || 0);
    cheque += Number(item.cheque || 0);
    online += Number(item.online || 0);
  }
  return { cash, cheque, online };
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


// Auto-suggest next follow-up date (skips Sunday -> moves to Monday) (Phase 2.7)
export function getSuggestedFollowUpDate(fromDate = new Date()) {
  const d = new Date(fromDate);
  d.setDate(d.getDate() + 1);
  if (d.getDay() === 0) {
    d.setDate(d.getDate() + 1);
  }
  return isoDay(d);
}

// Phone normalization for validation, dialer, and WhatsApp (Phase 2.2 & 2.8)
export function normalizePhone(phone) {
  if (!phone) return "";
  const digits = String(phone).replace(/\D/g, "");
  if (digits.length === 10) return "91" + digits;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  if (digits.length === 11 && digits.startsWith("0")) return "91" + digits.slice(1);
  return digits;
}

export function getTelUrl(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, "");
  if (!digits || digits.length < 10) return null;
  const clean = digits.length === 10 ? "+91" + digits : (digits.startsWith("91") ? "+" + digits : digits);
  return `tel:${clean}`;
}

export function getWhatsAppUrl(phone, text = "") {
  if (!phone) return null;
  const normalized = normalizePhone(phone);
  if (!normalized || normalized.length < 10) return null;
  const query = text ? `?text=${encodeURIComponent(text)}` : "";
  return `https://wa.me/${normalized}${query}`;
}
