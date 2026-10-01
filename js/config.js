/* =====================================================================
   CONFIG: the only file you need to edit to connect the portal to your
   existing backend. Leave API_BASE empty to run with built-in demo data.
   ===================================================================== */
const hostname = typeof window !== "undefined" ? window.location.hostname : "";
const isLocal = /localhost|127\.0\.0\.1/.test(hostname);
const isGitHubPages = /github\.io$/i.test(hostname);
const isProdDomain = /(^|\.)lbstimn\.com$/i.test(hostname);

const CONFIG = {
  // "supabase" = live Supabase database + auth (needs js/supabase.js filled in)
  // "rest"     = your own REST API (API_BASE below)
  // "demo"     = in-memory sample data, no backend needed
  BACKEND: "rest",

  // ---- REST mode only (ignored when BACKEND is "supabase") ----
  // Use the local Node backend while testing on localhost and Hostinger PHP when deployed.
  API_BASE: isLocal ? "http://localhost:3001/api" : "https://db.lbstimn.com/",

  // "token"  = Authorization: Bearer <token> (login screen is shown)
  // "cookie" = your existing session cookie is used
  // "none"   = no authentication
  AUTH_MODE: "token",

  // Request body keys: "camel" (followUpDate) or "snake" (follow_up_date)
  PAYLOAD_STYLE: "camel",

  ENDPOINTS: {
    login: isLocal ? "/auth/login" : "/auth.php",          // POST {username, password} -> {token, user?}
    enquiries: isLocal ? "/enquiries" : "/enquiries.php", // GET/POST/PATCH/DELETE on enquiry records
    remarks: isLocal ? "/enquiries" : "/enquiries.php",   // Existing enquiry remarks operations
    confirm: isLocal ? "/enquiries" : "/enquiries.php",   // Confirm an existing enquiry
    fees: isLocal ? "/fees" : "/fees.php",               // Existing fee records
    receipts: isLocal ? "/receipts" : "/receipts.php"    // POST {paymentId} to issue a saved receipt
  },

  // The status value your backend stores for each status label shown in the UI.
  // These six match the real lbstimn.com Enquiries system.
  STATUS_VALUES: {
    "New": "New",
    "No Response": "No Response",
    "Counseling Scheduled": "Counseling Scheduled",
    "Counseling done": "Counseling done",
    "Confirmed": "Confirmed",
    "Dropped": "Dropped"
  },
  CONFIRM_STATUS: "Confirmed",               // status sent when an admission is confirmed
  REMARK_FIELD: "remark",                    // body key used when posting a remark

  // Baseline counselor names for the "Counselor" dropdown. Any counselor
  // already used in your enquiry data is added automatically as well, so
  // this list only needs names that haven't been assigned to a lead yet.
  COUNSELORS: ["Sahil", "Harjot"],

  // Preferred batch / class timing options for the New Enquiry form.
  BATCHES: ["Morning (7 AM - 10 AM)", "Late Morning (10 AM - 1 PM)", "Afternoon (1 PM - 4 PM)", "Evening (4 PM - 7 PM)", "Weekend"],

  // Speech-to-text translation for remarks/notes. Translates the dictated
  // text (e.g. Hindi) into English in a preview box WITHOUT overwriting
  // what was typed -- the person chooses whether to insert it.
  // provider: "mymemory" (free, no key, mymemory.translated.net) |
  //           "google"   (Google Cloud Translation API, needs apiKey) |
  //           "none"     (hides the Translate button)
  TRANSLATE: {
    provider: "mymemory",
    apiKey: "",
    targetLang: "en"
  },

  ORG: {
    name: "LBSTIMN",
    fullName: "Lal Bahadur Shastri Training Institute",
    tagline: "Admissions CRM",
    domain: "lbstimn.com",
    initials: "LB",
    logoUrl: ""                              // e.g. "img/logo.png"
  },

  // WhatsApp number in international format without +, spaces, or punctuation.
  WHATSAPP_NUMBER: "",

  PAGE_SIZE: 10
};