import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Website payments through Moyasar hosted invoices. The browser never sees card data or the secret key.
// Actions: quote (signed-in user) -> the price this user pays now; create (signed-in user) -> hosted payment URL;
// check (signed-in user) -> applies any paid invoice; ?hook=1 (Moyasar callback) -> re-fetches the invoice and applies it.
// The price is always computed here; nothing in a request body is trusted except the cycle and the coupon text.
const ORIGINS = [...new Set(["https://tanzeem.app", "https://www.tanzeem.app", "https://heroic-cassata-aac6fc.netlify.app", "capacitor://localhost", ...(Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",")].map((s) => s.trim()).filter(Boolean))];
function cors(req: Request) {
  const o = req.headers.get("Origin") ?? "";
  const h: Record<string, string> = { "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin" };
  if (ORIGINS.includes(o)) h["Access-Control-Allow-Origin"] = o;
  return h;
}
// prices in halalas (1 SAR = 100)
// v:4 pages (v76 site) show 20/170; v:3 pages show 18/159; v:2 pages (the site still live before the upload) showed 25/159
const PRICE: Record<string, number> = { month: 1800, year: 15900 };
const PRICE_V2: Record<string, number> = { month: 2500, year: 15900 };
const PRICE_V4: Record<string, number> = { month: 2000, year: 17000 };
// pages from before the price change (they send no "v") keep their old price until the new site is uploaded,
// so a student never pays a different amount from the one shown
const OLD_PRICE: Record<string, number> = { month: 1900, year: 14900 };
// launch coupon: monthly only. It can be switched off without a deploy by setting COUPON_WELCOME_UNTIL (ISO date) in the secrets.
// public coupons were withdrawn (Nov 2026): the price itself was lowered. Any code typed now is reported as invalid.
const COUPONS: Record<string, { month: number }> = {};
const COUPONS_V2: Record<string, { month: number }> = {};
// every launch price ever used, so the two-payment limit counts old and new launch payments together
const LAUNCH_AMOUNTS = [1400, 1900];
const REF_OFF = 300; // invited users: 3 SAR off their first monthly payment
const API = "https://api.moyasar.com/v1";
const FN_URL = (Deno.env.get("SUPABASE_URL") ?? "") + "/functions/v1/pay?hook=1";

function mAuth() {
  const k = Deno.env.get("MOYASAR_SECRET_KEY") ?? "";
  return k ? "Basic " + btoa(k + ":") : "";
}
function couponOk(code: string) {
  if (!COUPONS[code]) return false;
  const until = Deno.env.get("COUPON_" + code + "_UNTIL");
  if (until && Date.now() > new Date(until).getTime()) return false;
  return true;
}

// the price this user pays for this cycle now. Coupon and invite discount never stack: the lower one wins.
async function quote(admin: ReturnType<typeof createClient>, uid: string, cycle: string, rawCoupon: unknown, ver = 3) {
  if (ver < 2) return { amount: OLD_PRICE[cycle], base: OLD_PRICE[cycle], kind: "", coupon: "", couponErr: false };
  const P = ver === 4 ? PRICE_V4 : ver === 2 ? PRICE_V2 : PRICE, CP = ver === 2 ? COUPONS_V2 : COUPONS;
  const base = P[cycle];
  const code = String(rawCoupon ?? "").trim().toUpperCase().slice(0, 32);
  let amount = base, kind = "", couponErr = false;
  if (cycle === "month") {
    if (code) {
      let ok = couponOk(code);
      if (ok) {
        // the launch price covers two monthly payments per student
        const { count } = await admin.from("invoices").select("id", { count: "exact", head: true }).eq("user_id", uid).eq("cycle", "month").in("amount", LAUNCH_AMOUNTS).eq("applied", true);
        if ((count ?? 0) >= 2) ok = false;
      }
      if (ok) { amount = CP[code].month; kind = "coupon"; } else couponErr = true;
    }
    const { data: ref } = await admin.from("referrals").select("referred_id").eq("referred_id", uid).maybeSingle();
    if (ref) {
      const { count } = await admin.from("invoices").select("id", { count: "exact", head: true }).eq("user_id", uid).eq("applied", true);
      if (!count && base - REF_OFF < amount) { amount = base - REF_OFF; kind = "ref"; }
    }
  } else if (code) couponErr = true;
  return { amount, base, kind, coupon: kind === "coupon" ? code : "", couponErr };
}

async function refresh(admin: ReturnType<typeof createClient>, id: string) {
  // returns the new period end if this call activated the subscription
  const { data: inv } = await admin.from("invoices").select("id,amount,applied").eq("id", id).maybeSingle();
  if (!inv || inv.applied) return null;
  const r = await fetch(`${API}/invoices/${encodeURIComponent(id)}`, { headers: { Authorization: mAuth() } });
  if (!r.ok) { console.error("invoice fetch", r.status); return null; }
  const j = await r.json();
  await admin.from("invoices").update({ status: String(j.status ?? ""), updated_at: new Date().toISOString() }).eq("id", id);
  if (j.status !== "paid" || j.currency !== "SAR" || Number(j.amount) !== inv.amount) return null;
  const { data: end, error } = await admin.rpc("_apply_invoice", { p_id: id });
  if (error) { console.error("apply", error.message); return null; }
  return end as string | null;
}

Deno.serve(async (req: Request) => {
  const C = cors(req);
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...C, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response(C["Access-Control-Allow-Origin"] ? "ok" : null, { status: C["Access-Control-Allow-Origin"] ? 200 : 403, headers: C });
  if (req.method !== "POST") return reply({ error: "method" }, 405);
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    if (!mAuth()) return reply({ error: "nokey" }, 503);
    const url = new URL(req.url);

    // Moyasar callback: take any id-looking fields, but only act on invoices we created, and only after re-fetching them
    if (url.searchParams.get("hook") === "1") {
      let b: Record<string, unknown> = {};
      try { b = await req.json(); } catch { /* ignore */ }
      const d = (b.data ?? b) as Record<string, unknown>;
      const ids = [d.invoice_id, d.id, b.id].filter((x) => typeof x === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(x as string)) as string[];
      for (const id of [...new Set(ids)]) await refresh(admin, id);
      return new Response("ok", { status: 200 });
    }

    const token = (req.headers.get("Authorization") || "").replace(/^Bearer /i, "");
    const { data: u } = await admin.auth.getUser(token);
    if (!u?.user) return reply({ error: "auth" }, 401);
    const uid = u.user.id;
    const b = await req.json().catch(() => ({}));
    const cycle = b.cycle === "month" ? "month" : "year";

    if (b.action === "quote") {
      const q = await quote(admin, uid, cycle, b.coupon, b.v === 4 ? 4 : b.v === 3 ? 3 : b.v === 2 ? 2 : 1);
      return reply({ cycle, amount: q.amount / 100, base: q.base / 100, kind: q.kind, coupon: q.coupon, couponErr: q.couponErr });
    }

    if (b.action === "create") {
      const q = await quote(admin, uid, cycle, b.coupon, b.v === 4 ? 4 : b.v === 3 ? 3 : b.v === 2 ? 2 : 1);
      if (q.couponErr) return reply({ error: "coupon" }, 400);
      // reuse an unpaid invoice from the last hour (same cycle and same price) so repeated taps don't pile up
      const since = new Date(Date.now() - 3600e3).toISOString();
      const { data: prev } = await admin.from("invoices").select("id,url,status").eq("user_id", uid).eq("cycle", cycle).eq("amount", q.amount).eq("applied", false).gte("created_at", since).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (prev?.url && prev.status === "initiated") return reply({ id: prev.id, url: prev.url, amount: q.amount / 100 });
      const origin = req.headers.get("Origin") ?? "";
      const base = ORIGINS.includes(origin) && origin.startsWith("https://") ? origin : "https://tanzeem.app";
      const r = await fetch(`${API}/invoices`, {
        method: "POST",
        headers: { Authorization: mAuth(), "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: q.amount, currency: "SAR",
          description: (cycle === "year" ? "Tanzeem subscription - 1 year" : "Tanzeem subscription - 1 month") + (q.coupon ? " (" + q.coupon + ")" : q.kind === "ref" ? " (invite)" : ""),
          success_url: base + "/app.html#paid", back_url: base + "/app.html",
          callback_url: FN_URL,
          expired_at: new Date(Date.now() + 24 * 3600e3).toISOString(),
          metadata: { user_id: uid, cycle, discount: q.kind || "none" },
        }),
      });
      if (!r.ok) { console.error("invoice create", r.status, (await r.text()).slice(0, 300)); return reply({ error: "create" }, 502); }
      const j = await r.json();
      if (!j.id || !j.url) return reply({ error: "create" }, 502);
      const { error: ie } = await admin.from("invoices").insert({ id: j.id, user_id: uid, cycle, amount: q.amount, status: String(j.status ?? "initiated"), url: j.url });
      if (ie) { console.error("invoice save", ie.message); return reply({ error: "server" }, 500); }
      return reply({ id: j.id, url: j.url, amount: q.amount / 100 });
    }

    if (b.action === "check") {
      const since = new Date(Date.now() - 2 * 24 * 3600e3).toISOString();
      const { data: list } = await admin.from("invoices").select("id").eq("user_id", uid).eq("applied", false).gte("created_at", since).order("created_at", { ascending: false }).limit(5);
      let activated: string | null = null;
      for (const it of list ?? []) { const e = await refresh(admin, it.id); if (e) activated = e; }
      const { data: sub } = await admin.from("subscriptions").select("plan,period_end,source").eq("user_id", uid).maybeSingle();
      return reply({ activated: !!activated, sub });
    }

    return reply({ error: "bad_action" }, 400);
  } catch (e) {
    console.error(e);
    return reply({ error: "server" }, 500);
  }
});
