// Browser-only fixture: no real accounts or Supabase requests are made.
// Load with agent-browser --init-script to verify the account UI locally.
(() => {
  const owner = "11111111-1111-4111-8111-111111111111";
  const user = { id: owner, aud: "authenticated", role: "authenticated", email: "planning@example.test", email_confirmed_at: "2026-01-01T00:00:00Z" };
  localStorage.setItem("sb-benefit-test-auth-token", JSON.stringify({
    access_token: "fixture-access-token-never-valid-on-production",
    refresh_token: "fixture-refresh-token", token_type: "bearer",
    expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user,
  }));
  if (!localStorage.getItem("fixture-planning")) localStorage.setItem("fixture-planning", JSON.stringify({
    revision: 0, data: { version: 1, compareIds: [], checklists: { "demo-2": ["documents"] } },
  }));
  localStorage.setItem("benefit-planning:v1:guest", JSON.stringify({ version: 1, compareIds: ["demo-1"], checklists: { "demo-1": ["eligibility"] } }));
  const nativeFetch = window.fetch.bind(window);
  const reply = (data, status = 200) => Promise.resolve(new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } }));
  window.fetch = (input, init = {}) => {
    const url = new URL(typeof input === "string" ? input : input.url, location.href);
    if (url.pathname === "/api/client-config") return reply({ authEnabled: true, supabaseUrl: "https://benefit-test.supabase.co", publishableKey: "sb_publishable_fixture_only" });
    if (url.hostname === "benefit-test.supabase.co") return reply(user);
    if (url.pathname === "/api/account/profile") return reply({ region: "전체", category: "전체", notificationsEnabled: false });
    if (["/api/account/saved", "/api/account/notifications"].includes(url.pathname)) return reply([]);
    if (url.pathname.startsWith("/api/account/planning")) {
      const state = JSON.parse(localStorage.getItem("fixture-planning"));
      const body = init.body ? JSON.parse(init.body) : null;
      if (init.method === "PUT") {
        if (body.revision !== state.revision) return reply({}, 409);
        state.data = body.data; state.revision++;
      } else if (init.method === "POST") {
        state.data.compareIds = [...new Set([...state.data.compareIds, ...body.compareIds])];
        for (const [id, steps] of Object.entries(body.checklists)) state.data.checklists[id] = [...new Set([...(state.data.checklists[id] || []), ...steps])];
        state.revision++;
      }
      localStorage.setItem("fixture-planning", JSON.stringify(state));
      return reply(state);
    }
    return nativeFetch(input, init);
  };
})();
