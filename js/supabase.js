/* =====================================================================
   Supabase client initialisation (non-blocking).

   Fill in your project's URL and anon (public) key below — both are in
   Supabase: Project Settings -> API. The anon key is safe to ship in
   frontend code; Row Level Security (schema.sql) is what protects data.

   The Supabase SDK is loaded ONLY when these are filled in, and loaded
   asynchronously (jsDelivr first, unpkg as backup, 8s timeout each), so a
   slow or blocked CDN can never freeze the page. Left at the placeholders,
   nothing is downloaded and the app runs on demo data instantly.
   ===================================================================== */
const SUPABASE_URL = "https://YOUR-PROJECT-REF.supabase.co";
const SUPABASE_ANON_KEY = "YOUR-SUPABASE-ANON-KEY";

const SUPABASE_CONFIGURED = SUPABASE_URL.indexOf("YOUR-PROJECT-REF") === -1 && SUPABASE_ANON_KEY.indexOf("YOUR-SUPABASE") === -1;
const SDK_URLS = [
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2",
  "https://unpkg.com/@supabase/supabase-js@2"
];

let sb = null;        // the Supabase client (null until ready / when not configured)
let sbError = "";     // set if the SDK couldn't be loaded

function loadScript(src, timeoutMs) {
  return new Promise(resolve => {
    const s = document.createElement("script");
    let done = false;
    const finish = ok => { if (done) return; done = true; clearTimeout(timer); resolve(ok); };
    const timer = setTimeout(() => { s.remove(); finish(false); }, timeoutMs);
    s.async = true; s.src = src;
    s.onload = () => finish(true);
    s.onerror = () => { s.remove(); finish(false); };
    document.head.appendChild(s);
  });
}

/** Resolves once the SDK is ready (or has definitively failed / isn't needed). */
const sbReady = (async function () {
  if (!SUPABASE_CONFIGURED) return null;
  const has = () => window.supabase && typeof window.supabase.createClient === "function";
  if (!has()) {
    for (const url of SDK_URLS) { if (await loadScript(url, 8000) && has()) break; }
  }
  if (has()) sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  else sbError = "Couldn't load the Supabase library. Check your internet connection.";
  return sb;
})();
