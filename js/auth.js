/* =====================================================================
   Auth: Supabase session management + role lookup.
   Exposes a single `Auth` object used by js/app.js. When Supabase isn't
   configured (see js/supabase-client.js) this quietly no-ops so the app
   still runs on demo data, matching CONFIG.BACKEND in js/config.js.
   ===================================================================== */
const Auth = (function () {
  "use strict";
  let current = null; // { id, email, fullName, role }

  async function loadProfile(userId) {
    const { data, error } = await sb.from("profiles").select("id, full_name, role").eq("id", userId).single();
    if (error) throw error;
    return { fullName: data.full_name || "", role: data.role || "counselor" };
  }

  /** Call once at boot. Resolves to the signed-in user (or null). */
  async function init() {
    if (!sb) return null;
    const { data, error } = await sb.auth.getSession();
    if (error || !data.session) return null;
    const u = data.session.user;
    try {
      const profile = await loadProfile(u.id);
      current = { id: u.id, email: u.email, fullName: profile.fullName || u.email, role: profile.role };
    } catch (e) {
      // Profile row missing (e.g. trigger hasn't run yet) -- fall back to a safe default.
      current = { id: u.id, email: u.email, fullName: u.email, role: "counselor" };
    }
    return current;
  }

  /** Supabase Auth uses email + password. */
  async function signIn(email, password) {
    if (!sb) throw new Error("Supabase isn't configured yet (js/supabase-client.js).");
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) { const e = new Error(error.message); e.code = error.status === 400 ? 401 : error.status; throw e; }
    const profile = await loadProfile(data.user.id).catch(() => ({ fullName: data.user.email, role: "counselor" }));
    current = { id: data.user.id, email: data.user.email, fullName: profile.fullName || data.user.email, role: profile.role };
    return current;
  }

  async function signOut() {
    current = null;
    if (sb) { try { await sb.auth.signOut(); } catch (e) {} }
  }

  const isAdmin = () => !!current && current.role === "admin";
  const user = () => current;

  return { init, signIn, signOut, isAdmin, user };
})();
