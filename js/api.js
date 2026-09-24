/* =====================================================================
   Data model + API layer.
   All backend access goes through the `Api` object at the bottom.
   ===================================================================== */
const Model = (function () {
  "use strict";
  // Status names and course list match the existing lbstimn.com database exactly,
  // so labels shown here are the same ones staff already use.
  const STATUSES = ["New", "No Response", "Counseling Scheduled", "Counseling done", "Confirmed", "Dropped"];
  const OPEN = ["New", "No Response", "Counseling Scheduled", "Counseling done"];
  const COURSES = [
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
    // Additional technology/coding tracks
    "MERN Stack Development (6 Months)", "Java Full Stack Development (6 Months)", "Python Full Stack Development (6 Months)",
    "Web Development (4 Months)", "React JS (2 Months)", "Node JS (2 Months)", "Data Structures & Algorithms (2 Months)",
    "AI & Machine Learning (3 Months)", "Data Science (4 Months)", "SQL & Database (1 Month)", "DevOps (2 Months)",
    "Cyber Security (3 Months)"
  ];
  const SOURCES = ["Website", "Meta Ads", "Google Ads", "Walk-in", "Referral", "Phone call", "Education fair"];

  function normStatus(s) {
    const v = String(s || "").toLowerCase();
    if (/no.?response|not.?respond|nr\b/.test(v)) return "No Response";
    if (/schedul/.test(v)) return "Counseling Scheduled";
    if (/done|complete/.test(v)) return "Counseling done";
    if (/confirm|admit|enrol|convert|join/.test(v)) return "Confirmed";
    if (/drop|lost|reject|closed|not interested/.test(v)) return "Dropped";
    return "New";
  }
  const nameOf = v => (v && typeof v === "object") ? String(v.name || v.username || v.fullName || v.full_name || "") : String(v == null ? "" : v);

  function normalize(raw) {
    raw = raw || {};
    const pick = (...k) => { for (const key of k) { if (raw[key] != null && raw[key] !== "") return raw[key]; } return ""; };
    return {
      id: pick("id", "_id", "enquiry_id", "enquiryId"),
      name: String(pick("name", "student_name", "studentName", "full_name", "fullName")),
      phone: String(pick("phone", "mobile", "contact", "phone_number", "phoneNumber", "mobile_number")),
      email: String(pick("email", "email_id", "emailId")),
      course: String(pick("course", "course_interested", "courseInterested", "program", "programme")),
      batch: String(pick("batch", "preferred_batch", "preferredBatch", "batch_time", "batchTime")),
      source: String(pick("source", "lead_source", "leadSource")),
      city: String(pick("city", "location")),
      status: normStatus(pick("status", "lead_status", "leadStatus")),
      assignedTo: nameOf(pick("assignedTo", "assigned_to", "assigned", "counselor", "counsellor", "assignee")),
      notes: String(pick("notes", "note", "comment", "comments", "message")),
      followUpDate: pick("followUpDate", "follow_up_date", "followup_date", "next_follow_up", "nextFollowUp"),
      createdAt: pick("createdAt", "created_at", "date", "created", "enquiry_date", "enquiryDate")
    };
  }
  function normRemark(raw) {
    raw = raw || {};
    const pick = (...k) => { for (const key of k) { if (raw[key] != null && raw[key] !== "") return raw[key]; } return ""; };
    return {
      id: pick("id", "_id"),
      text: String(pick("text", "remark", "message", "note", "content", "body")),
      author: nameOf(pick("author", "user", "created_by", "createdBy", "admin", "added_by", "addedBy")),
      createdAt: pick("createdAt", "created_at", "date", "timestamp", "time")
    };
  }
  function toPayload(obj) {
    const src = Object.assign({}, obj);
    if (src.status != null) src.status = CONFIG.STATUS_VALUES[src.status] || src.status;
    if (CONFIG.PAYLOAD_STYLE !== "snake") return src;
    const out = {};
    Object.keys(src).forEach(k => { out[k.replace(/[A-Z]/g, c => "_" + c.toLowerCase())] = src[k]; });
    return out;
  }
  return { STATUSES, OPEN, COURSES, SOURCES, normStatus, normalize, normRemark, toPayload };
})();

/* ---------- HTTP client ---------- */
const Http = (function () {
  "use strict";
  const TOKEN_KEY = "lbstimn_token";
  const getToken = () => { try { return localStorage.getItem(TOKEN_KEY) || ""; } catch (e) { return ""; } };
  const setToken = t => { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch (e) {} };

  async function request(method, path, body) {
    const headers = { "Accept": "application/json" };
    if (body) headers["Content-Type"] = "application/json";
    const t = getToken();
    if (CONFIG.AUTH_MODE === "token" && t) headers["Authorization"] = "Bearer " + t;
    const res = await fetch(CONFIG.API_BASE + path, {
      method, headers,
      body: body ? JSON.stringify(body) : undefined,
      credentials: CONFIG.AUTH_MODE === "cookie" ? "include" : "same-origin"
    });
    if (res.status === 401) { const e = new Error("Your session has expired. Please sign in again."); e.code = 401; throw e; }
    if (!res.ok) {
      let m = ""; try { const j = await res.json(); m = j.message || j.error || ""; } catch (e) {}
      const err = new Error(m || "Request failed (" + res.status + ")"); err.code = res.status; throw err;
    }
    if (res.status === 204) return null;
    const txt = await res.text();
    return txt ? JSON.parse(txt) : null;
  }
  return { request, getToken, setToken };
})();

/* ---------- In-memory demo backend (used when API_BASE is empty) ---------- */
const DemoStore = (function () {
  "use strict";
  const { sod, addDays, isoDay } = U;
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const r = rng(20260919);
  const ri = (a, b) => a + Math.floor(r() * (b - a + 1));
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = ri(0, i); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
  const first = ["Aarav","Vivaan","Aditya","Arjun","Ishaan","Rohan","Kabir","Karan","Riya","Ananya","Diya","Isha","Kavya","Meera","Neha","Pooja","Priya","Sakshi","Sneha","Tanvi","Aman","Deepak","Harsh","Nikhil","Rahul","Sahil","Yash","Simran","Muskan","Nidhi"];
  const last = ["Sharma","Verma","Gupta","Singh","Kumar","Yadav","Mishra","Tiwari","Pandey","Joshi","Agarwal","Chauhan","Saxena","Rastogi","Srivastava","Khan","Ansari","Mehta"];
  const cities = ["Lucknow","Kanpur","Delhi","Noida","Ghaziabad","Varanasi","Prayagraj","Agra","Meerut","Gorakhpur"];
  const staff = (CONFIG.COUNSELORS && CONFIG.COUNSELORS.length) ? CONFIG.COUNSELORS.slice() : ["Sahil", "Harjot"];
  const pickStaff = () => staff[r() < 0.82 ? 0 : ri(1, staff.length - 1) || 0];
  const notes = ["Asked about fee structure and scholarships.", "Wants hostel facility.", "Interested in placement records.", "Needs education loan guidance.", "", "", "Comparing with two other institutes."];
  const pool = ["Called the student; interested in the course.", "Parent was contacted regarding fees.", "Shared the brochure on WhatsApp.", "Campus visit scheduled this week.", "Number not reachable, will retry tomorrow.", "Student requested a callback in the evening.", "Documents checklist shared with parent.", "Student will visit tomorrow with parent to confirm admission."];

  const counts = {
    "ADCA (12 Months)": 22, "English Speaking Course (6 Months)": 16, "Full Stack Developer (8 Months)": 14,
    "UI/UX Design (8 Months)": 12, "Tally Prime (2 Months)": 10, "Python (2 Months)": 9, "DIT (12 Months)": 8,
    "Frontend Developer (4 Months)": 7, "Java Advance / J2EE (2 Months)": 5, "Photoshop (1 Month)": 4
  };
  const courses = []; Object.keys(counts).forEach(c => { for (let i = 0; i < counts[c]; i++) courses.push(c); });
  shuffle(courses);
  const sts = []; [["New", 50], ["Counseling Scheduled", 16], ["Counseling done", 14], ["No Response", 9], ["Confirmed", 10], ["Dropped", 8]].forEach(p => { for (let i = 0; i < p[1]; i++) sts.push(p[0]); });
  shuffle(sts);
  const days = []; [[12, 14], [3, 10], [2, 7], [1, 5], [0, 3]].forEach(p => { for (let i = 0; i < p[1]; i++) days.push(p[0]); });
  while (days.length < 107) days.push(r() < 0.6 ? ri(0, 30) : ri(31, 120));
  shuffle(days);
  const today = sod(new Date());
  let store = days.map((d, i) => {
    const dt = addDays(today, -d); dt.setHours(ri(9, 17), ri(0, 59), 0, 0);
    const fn = first[ri(0, first.length - 1)], ln = last[ri(0, last.length - 1)];
    const st = sts[i], open = Model.OPEN.indexOf(st) > -1;
    return {
      name: fn + " " + ln, phone: ["9", "8", "7", "6"][ri(0, 3)] + String(ri(100000000, 999999999)),
      email: (fn + "." + ln + ri(1, 99)).toLowerCase() + "@" + (r() < .7 ? "gmail.com" : "outlook.com"),
      course: courses[i], source: Model.SOURCES[ri(0, Model.SOURCES.length - 1)], city: cities[ri(0, cities.length - 1)],
      status: st, notes: notes[ri(0, notes.length - 1)],
      assignedTo: st === "New" ? (r() < .3 ? pickStaff() : "") : pickStaff(),
      batch: CONFIG.BATCHES[ri(0, CONFIG.BATCHES.length - 1)],
      followUpDate: open ? isoDay(addDays(today, ri(-2, 10))) : "",
      createdAt: dt.toISOString()
    };
  });
  store.sort((a, b) => a.createdAt < b.createdAt ? -1 : 1).forEach((x, i) => { x.id = i + 1; });
  let nextId = store.length + 1, remSeq = 1;
  const remarks = {};
  store.forEach(e => {
    if (e.status === "New" && r() < .6) return;
    const n = ri(1, 3), list = [];
    for (let k = 0; k < n; k++) {
      const t0 = +new Date(e.createdAt), span = Date.now() - t0;
      list.push({ id: remSeq++, text: pool[ri(0, pool.length - 1)], author: e.assignedTo || pickStaff(), createdAt: new Date(t0 + span * ((k + 1) / (n + 1))).toISOString() });
    }
    remarks[e.id] = list;
  });
  const wait = ms => new Promise(res => setTimeout(res, ms));
  const find = id => store.find(e => String(e.id) === String(id));

  return {
    async list() { await wait(300); return store.map(x => Object.assign({}, x)); },
    async create(d) { await wait(250); const x = Object.assign({ id: nextId++, createdAt: new Date().toISOString() }, d); store.push(x); return Object.assign({}, x); },
    async update(id, p) { await wait(200); const x = find(id); if (!x) throw new Error("Enquiry not found"); Object.assign(x, p); return Object.assign({}, x); },
    async remove(id) { await wait(200); store = store.filter(e => String(e.id) !== String(id)); delete remarks[id]; return null; },
    async remarks(id) { await wait(200); return (remarks[id] || []).map(x => Object.assign({}, x)); },
    async addRemark(id, text, author) { await wait(200); const x = { id: remSeq++, text, author, createdAt: new Date().toISOString() }; (remarks[id] = remarks[id] || []).push(x); return Object.assign({}, x); },
    async confirm(id) { await wait(250); const x = find(id); if (!x) throw new Error("Enquiry not found"); x.status = "Confirmed"; return Object.assign({}, x); }
  };
})();

/* ---------- Api facade: the only thing the UI talks to ---------- */
const Api = (function () {
  "use strict";
  const api = { demo: !CONFIG.API_BASE };
  const unwrapList = r => Array.isArray(r) ? r : (r && (r.data || r.results || r.enquiries || r.items || r.rows || r.remarks)) || [];
  const unwrapOne = r => (r && typeof r === "object" && !Array.isArray(r)) ? (r.data || r.enquiry || r.remark || r) : null;
  const url = (tpl, id) => tpl.replace("{id}", encodeURIComponent(id));
  const E = CONFIG.ENDPOINTS;

  api.login = async function (username, password) {
    if (api.demo) return { user: { name: "user", role: "counselor" } };
    const r = await Http.request("POST", E.login, { username, password });
    const token = r && (r.token || r.accessToken || r.access_token);
    if (token) Http.setToken(token);
    const u = (r && (r.user || r.data)) || {};
    return { user: { name: u.name || u.username || username, role: u.role || "counselor" } };
  };
  api.logout = function () { Http.setToken(""); };
  api.hasToken = () => !!Http.getToken();

  api.list = async function () {
    if (api.demo) return DemoStore.list();
    return unwrapList(await Http.request("GET", E.enquiries)).map(Model.normalize);
  };
  api.create = async function (data) {
    if (api.demo) return DemoStore.create(data);
    const o = unwrapOne(await Http.request("POST", E.enquiries, Model.toPayload(data)));
    return o ? Model.normalize(o) : null;
  };
  api.update = async function (id, patch) {
    if (api.demo) return DemoStore.update(id, patch);
    const o = unwrapOne(await Http.request("PATCH", E.enquiries + "/" + encodeURIComponent(id), Model.toPayload(patch)));
    return o ? Model.normalize(o) : null;
  };
  api.remove = async function (id) {
    if (api.demo) return DemoStore.remove(id);
    return Http.request("DELETE", E.enquiries + "/" + encodeURIComponent(id));
  };
  api.confirm = async function (id) {
    if (api.demo) return DemoStore.confirm(id);
    if (E.confirm) {
      const o = unwrapOne(await Http.request("POST", url(E.confirm, id)));
      return o ? Model.normalize(o) : null;
    }
    return api.update(id, { status: CONFIG.CONFIRM_STATUS });
  };
  api.remarks = async function (id) {
    if (api.demo) return DemoStore.remarks(id);
    return unwrapList(await Http.request("GET", url(E.remarks, id))).map(Model.normRemark);
  };
  api.addRemark = async function (id, text, author) {
    if (api.demo) return DemoStore.addRemark(id, text, author);
    const body = {}; body[CONFIG.REMARK_FIELD] = text;
    const o = unwrapOne(await Http.request("POST", url(E.remarks, id), body));
    return o ? Model.normRemark(o) : null;
  };
  return api;
})();
