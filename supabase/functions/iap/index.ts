import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// iPad subscriptions bought through Apple. The app sends a transaction id; we ask Apple's App Store Server API
// for that transaction (the only source we trust) and extend the subscription. Apple's server notifications
// (?hook=1) are handled the same way: we take the transaction id and re-fetch it from Apple.
const ORIGINS = [...new Set(["https://tanzeem.app", "https://www.tanzeem.app", "https://heroic-cassata-aac6fc.netlify.app", "capacitor://localhost", ...(Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",")].map((s) => s.trim()).filter(Boolean))];
function cors(req: Request) {
  const o = req.headers.get("Origin") ?? "";
  const h: Record<string, string> = { "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin" };
  if (ORIGINS.includes(o)) h["Access-Control-Allow-Origin"] = o;
  return h;
}
const BUNDLE = "sa.tanzeem.app";
const PLAN: Record<string, string> = { "sa.tanzeem.app.monthly": "month", "sa.tanzeem.app.yearly": "year" };
const HOSTS = ["https://api.storekit.itunes.apple.com", "https://api.storekit-sandbox.itunes.apple.com"];

const b64u = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const enc = new TextEncoder();
function decodeJws(jws: string): Record<string, unknown> | null {
  try { const p = jws.split(".")[1]; return JSON.parse(atob(p.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((p.length + 3) % 4))); } catch { return null; }
}
let keyCache: CryptoKey | null = null;
async function appleJwt() {
  const kid = Deno.env.get("APPLE_IAP_KEY_ID") ?? "", iss = Deno.env.get("APPLE_IAP_ISSUER_ID") ?? "", pem = Deno.env.get("APPLE_IAP_PRIVATE_KEY") ?? "";
  if (!kid || !iss || !pem) return "";
  if (!keyCache) {
    const der = Uint8Array.from(atob(pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "")), (c) => c.charCodeAt(0));
    keyCache = await crypto.subtle.importKey("pkcs8", der, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  }
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(enc.encode(JSON.stringify({ alg: "ES256", kid, typ: "JWT" })));
  const body = b64u(enc.encode(JSON.stringify({ iss, iat: now, exp: now + 1200, aud: "appstoreconnect-v1", bid: BUNDLE })));
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, keyCache, enc.encode(head + "." + body)));
  return head + "." + body + "." + b64u(sig);
}
async function fetchTxn(id: string) {
  const jwt = await appleJwt(); if (!jwt) return { err: "nokey" as const };
  const H = { headers: { Authorization: "Bearer " + jwt } };
  let failed = false;
  for (const host of HOSTS) {
    // the subscription's current state (latest renewal), whichever of its transactions the device gave us
    const s = await fetch(`${host}/inApps/v1/subscriptions/${encodeURIComponent(id)}`, H);
    if (s.ok) {
      const j = await s.json();
      let best: Record<string, unknown> | null = null;
      for (const g of (j.data ?? []) as { lastTransactions?: { signedTransactionInfo?: string }[] }[]) {
        for (const lt of g.lastTransactions ?? []) {
          const t = decodeJws(String(lt.signedTransactionInfo ?? ""));
          if (t && (!best || Number(t.expiresDate ?? 0) > Number(best.expiresDate ?? 0))) best = t;
        }
      }
      if (best) return { t: best };
    } else if (s.status !== 404) { failed = true; console.error("apple subs", host, s.status, (await s.text()).slice(0, 200)); }
    const r = await fetch(`${host}/inApps/v1/transactions/${encodeURIComponent(id)}`, H);
    if (r.status === 404) continue;
    if (!r.ok) { failed = true; console.error("apple", host, r.status, (await r.text()).slice(0, 200)); continue; }
    const j = await r.json();
    const t = decodeJws(String(j.signedTransactionInfo ?? ""));
    if (t) return { t };
  }
  return { err: failed ? "apple" as const : "notfound" as const };
}

async function apply(admin: ReturnType<typeof createClient>, t: Record<string, unknown>, uidHint: string | null, claim = false) {
  if (t.bundleId !== BUNDLE) return { ok: false, why: "bundle" };
  const plan = PLAN[String(t.productId)]; if (!plan) return { ok: false, why: "product" };
  const orig = String(t.originalTransactionId ?? t.transactionId ?? "");
  const token = String(t.appAccountToken ?? "").toLowerCase();
  const { data: known } = await admin.from("apple_txn").select("user_id").eq("original_transaction_id", orig).maybeSingle();
  let uid = known?.user_id as string | undefined;
  // not linked to anyone yet (new purchase, or its account was deleted / it was released): the signed-in caller on
  // this Apple ID takes it; Apple's own notifications fall back to the account that bought it, if it still exists
  if (!uid && uidHint) uid = uidHint;
  if (!uid && token) {
    const { data: tu } = await admin.auth.admin.getUserById(token).catch(() => ({ data: null }));
    if (tu?.user) uid = token;
  }
  if (!uid) return { ok: false, why: "nouser" };
  if (uidHint && uid !== uidHint) {
    // the person just bought or restored with this Apple Account while signed in to another Tanzeem account:
    // the Apple subscription moves to that account, and the previous account stops being subscribed through it
    if (!claim && token !== uidHint) return { ok: false, why: "owner" };
    await admin.rpc("_apply_apple", { p_user: uid, p_end: new Date().toISOString(), p_plan: plan, p_revoke: true });
    uid = uidHint;
  }
  const exp = Number(t.expiresDate ?? 0), revoked = !!t.revocationDate;
  await admin.from("apple_txn").upsert({ original_transaction_id: orig, user_id: uid, product_id: String(t.productId), expires_at: exp ? new Date(exp).toISOString() : null, revoked, updated_at: new Date().toISOString() }, { onConflict: "original_transaction_id" });
  if (revoked) { await admin.rpc("_apply_apple", { p_user: uid, p_end: new Date().toISOString(), p_plan: plan, p_revoke: true }); return { ok: false, why: "revoked" }; }
  if (!exp || exp < Date.now()) return { ok: false, why: "expired" };
  const { data: end, error } = await admin.rpc("_apply_apple", { p_user: uid, p_end: new Date(exp).toISOString(), p_plan: plan, p_revoke: false });
  if (error) { console.error("apply", error.message); return { ok: false, why: "server" }; }
  return { ok: true, end };
}

Deno.serve(async (req: Request) => {
  const C = cors(req);
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...C, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response(C["Access-Control-Allow-Origin"] ? "ok" : null, { status: C["Access-Control-Allow-Origin"] ? 200 : 403, headers: C });
  if (req.method !== "POST") return reply({ error: "method" }, 405);
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const url = new URL(req.url);

    // App Store Server Notifications V2: read the transaction id, then ask Apple for the real record
    if (url.searchParams.get("hook") === "1") {
      const b = await req.json().catch(() => ({}));
      const n = decodeJws(String(b.signedPayload ?? ""));
      const data = (n?.data ?? {}) as Record<string, unknown>;
      const inner = decodeJws(String(data.signedTransactionInfo ?? ""));
      const id = inner && (inner.transactionId as string);
      if (id && /^[0-9]{1,30}$/.test(id)) { const f = await fetchTxn(id); if ("t" in f && f.t) await apply(admin, f.t, null); }
      return new Response("ok", { status: 200 });
    }

    const token = (req.headers.get("Authorization") || "").replace(/^Bearer /i, "");
    const { data: u } = await admin.auth.getUser(token);
    if (!u?.user) return reply({ error: "auth" }, 401);
    const b = await req.json().catch(() => ({}));
    if (b.action !== "verify") return reply({ error: "bad_action" }, 400);
    const ids = (Array.isArray(b.ids) ? b.ids : [b.transactionId]).map(String).filter((x: string) => /^[0-9]{1,30}$/.test(x)).slice(0, 10);
    if (!ids.length) return reply({ error: "id" }, 400);
    let active = false, why = "";
    const claim = b.claim === true;
    const seen = new Set<string>();
    for (const id of ids) {
      if (active) break;
      const f = await fetchTxn(id);
      if (!("t" in f) || !f.t) { why = "err" in f ? String(f.err) : "parse"; console.error("verify", why); continue; }
      const o = String(f.t.originalTransactionId ?? f.t.transactionId ?? "");
      if (seen.has(o)) continue; seen.add(o);
      const r = await apply(admin, f.t, u.user.id, claim);
      if (!r.ok) console.error("verify", r.why);
      if (r.ok) { active = true; why = ""; } else why = String(r.why ?? "");
    }
    const { data: sub } = await admin.from("subscriptions").select("plan,period_end,source").eq("user_id", u.user.id).maybeSingle();
    return reply({ active, why, sub });
  } catch (e) {
    console.error(e);
    return reply({ error: "server" }, 500);
  }
});
