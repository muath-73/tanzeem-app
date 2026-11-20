import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// «صوّر وحل»: one photo of a paper in, its answers out. Subscribers only, 15 pages a week.
// The photo is never stored: it lives only in this request's memory and is sent to the model, then dropped.

const ORIGINS = [...new Set(["https://tanzeem.app", "https://www.tanzeem.app", "https://heroic-cassata-aac6fc.netlify.app", "capacitor://localhost", ...(Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",")].map((s) => s.trim()).filter(Boolean))];
function cors(req: Request) {
  const o = req.headers.get("Origin") ?? "";
  const h: Record<string, string> = { "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin" };
  if (ORIGINS.includes(o)) h["Access-Control-Allow-Origin"] = o;
  return h;
}

const WEEK_LIMIT = 15;          // pages per subscriber per week (week starts Sunday, Riyadh time)
const GLOBAL_WEEK = 60000;      // all users together, a ceiling on spend
const MODEL = "claude-haiku-5-5";
const MAX_IMG_B64 = 6_000_000;  // ~4.5 MB image
const TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
// test-only hook (sha256 of a one-off token). Empty in the shipped version.
const TEST_HASH = "";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function prompt(long: boolean) {
  return `You are answering the questions on a photographed university worksheet / question paper for a student.
Read the WHOLE page carefully and answer EVERY question on it, in the paper's own order, keeping the paper's own numbering and its own sections (e.g. "Part 1: True or False", "Section B").
Think carefully and get the answers right; accuracy matters more than anything.

Reply with ONLY one JSON object, no markdown, no text before or after, in exactly this shape:
{"ok": true, "parts": [{"title": "<section heading exactly as printed, or empty string if the paper has no sections>", "items": [ITEM, ...]}]}

ITEM is one of:
- multiple choice: {"n": "<question label as printed, e.g. 1, 2, a, Q3, 4(b)>", "type": "mcq", "answer": "<ONLY the option label as printed, e.g. c, B, iii>"${long ? ', "explain": "<one short simple Arabic sentence (Saudi-friendly, clear) saying why>"' : ""}}
- true/false: {"n": "...", "type": "tf", "answer": true or false${long ? ', "explain": "<one short Arabic sentence>"' : ""}}
- a question that must be solved (calculation, equation, proof, derivation, numeric problem) with no options: {"n": "...", "type": "work", "steps": [STEP, ...], "answer": "<final result in LaTeX>"${long ? ', "explain": "<optional one short Arabic sentence>"' : ""}}
  STEP is {"math": "<one line of working in LaTeX>"}${long ? ' or {"note": "<very short Arabic note explaining the next step>"}' : ""}. Give the full clear working, one step per line, then the final answer in "answer".
- short written answer / fill in the blank / definition: {"n": "...", "type": "text", "answer": "<the answer, short, in the same language as the question>"${long ? ', "explain": "<one short Arabic sentence>"' : ""}}

Rules:
- LaTeX only for math (no $ signs), e.g. "\\\\frac{2DS}{H}", "x^{2} - 4x + 3 = 0", "\\\\sqrt{160000}". Escape backslashes properly for JSON.
- Never copy the question text or the option text into the answer.
- If a multiple choice question has no printed labels, use a, b, c, d in order.
- ${long ? "Explanations are in Arabic, one short sentence each." : "No explanations at all."}
- If the image has no questions (e.g. a selfie, a random photo, a slide with no questions): {"ok": false, "reason": "no_questions"}
- If the page is too blurry/dark/cut to read: {"ok": false, "reason": "unclear"}`;
}

function extractJson(t: string) {
  const s = t.indexOf("{"), e = t.lastIndexOf("}");
  if (s < 0 || e <= s) return null;
  try { return JSON.parse(t.slice(s, e + 1)); } catch { return null; }
}

const S = (v: unknown, n: number) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "").slice(0, n);
// keep only what the app knows how to draw; anything odd is dropped rather than shown wrong
function clean(d: any) {
  if (!d || typeof d !== "object") return null;
  if (d.ok === false) return { ok: false, reason: d.reason === "unclear" ? "unclear" : "no_questions" };
  if (!Array.isArray(d.parts)) return null;
  const parts = d.parts.slice(0, 20).map((p: any) => ({
    title: S(p?.title, 120),
    items: (Array.isArray(p?.items) ? p.items : []).slice(0, 80).map((it: any) => {
      const type = ["mcq", "tf", "work", "text"].includes(it?.type) ? it.type : "text";
      const o: any = { n: S(it?.n, 16), type, explain: S(it?.explain, 400) };
      if (type === "tf") o.answer = it?.answer === true || /^(true|t|صح)$/i.test(String(it?.answer).trim());
      else o.answer = S(it?.answer, type === "mcq" ? 12 : 600);
      if (type === "work") o.steps = (Array.isArray(it?.steps) ? it.steps : []).slice(0, 30).map((s: any) =>
        typeof s === "string" ? { math: s.slice(0, 400) } : s?.note ? { note: S(s.note, 300) } : { math: S(s?.math, 400) }).filter((s: any) => s.math || s.note);
      return o;
    }).filter((it: any) => it.type === "tf" || it.answer || (it.steps && it.steps.length)),
  })).filter((p: any) => p.items.length);
  if (!parts.length) return { ok: false, reason: "no_questions" };
  return { ok: true, parts };
}

async function solve(image: Record<string, unknown>, long: boolean) {
  let err = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt) await sleep(800);
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": Deno.env.get("ANTHROPIC_API_KEY") ?? "", "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL, max_tokens: long ? 8000 : 6000,
        messages: [{ role: "user", content: [{ type: "image", source: image }, { type: "text", text: prompt(long) }] }],
      }),
    });
    if (!r.ok) {
      err = `upstream ${r.status}`;
      console.error("anthropic", r.status, (await r.text()).slice(0, 300));
      if (r.status === 400 || r.status === 401 || r.status === 403) break;
      continue;
    }
    const j = await r.json();
    const text = (j.content || []).map((c: { text?: string }) => c.text || "").join("");
    const data = clean(extractJson(text));
    if (data) return { data, usage: j.usage, err: "" };
    err = "parse";
    console.error("solve parse fail", "stop:", j.stop_reason, "out:", j.usage?.output_tokens, JSON.stringify(text).slice(0, 300));
  }
  return { data: null, usage: null, err };
}

async function sha256(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  const C = cors(req);
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...C, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response(C["Access-Control-Allow-Origin"] ? "ok" : null, { status: C["Access-Control-Allow-Origin"] ? 200 : 403, headers: C });
  try {
    const b = await req.json().catch(() => ({}));
    const long = b.mode === "long";

    if (TEST_HASH && typeof b.test === "string" && (await sha256(b.test)) === TEST_HASH) {
      const t0 = Date.now();
      const res = await solve({ type: "url", url: String(b.url) }, long);
      return reply({ ...(res.data ?? { error: res.err }), usage: res.usage, ms: Date.now() - t0 });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer /i, "");
    const { data: u } = await admin.auth.getUser(token);
    if (!u?.user) return reply({ error: "auth" }, 401);
    const uid = u.user.id;

    const { data: sub } = await admin.from("subscriptions").select("period_end").eq("user_id", uid).maybeSingle();
    const subscribed = !!sub && new Date(sub.period_end).getTime() >= Date.now();

    const { data: wk } = await admin.rpc("solve_week_start");
    const usedQ = async () => {
      const { data } = await admin.from("ai_usage").select("n").eq("user_id", uid).eq("task", "solve").eq("day", wk).maybeSingle();
      return Math.max(0, WEEK_LIMIT - (data?.n ?? 0));
    };

    // the screen asks how many pages are left this week
    if (b.status) return reply({ subscribed, left: subscribed ? await usedQ() : 0, limit: WEEK_LIMIT });
    if (!subscribed) return reply({ error: "not_subscribed" }, 403);

    const mt = String(b.media_type || "");
    const data = typeof b.image === "string" ? b.image.replace(/^data:[^,]*,/, "") : "";
    if (!TYPES.includes(mt) || !data || data.length > MAX_IMG_B64 || !/^[A-Za-z0-9+/=\s]+$/.test(data.slice(0, 200))) return reply({ error: "bad_image" }, 400);

    const { data: used, error: bumpErr } = await admin.rpc("bump_solve", { p_user: uid, p_pages: 1, p_limit: WEEK_LIMIT, p_global: GLOBAL_WEEK });
    if (bumpErr) { console.error("bump_solve", bumpErr.message); return reply({ error: "server" }, 503); }
    if (used === -1) return reply({ error: "limit", left: 0 }, 429);
    if (used === -2) { console.error("GLOBAL WEEKLY CAP REACHED: solve"); return reply({ error: "busy" }, 429); }

    const res = await solve({ type: "base64", media_type: mt, data }, long);
    // a page that could not be answered (server error, unreadable, no questions) is given back
    if (!res.data || res.data.ok === false) await admin.rpc("refund_solve", { p_user: uid, p_pages: 1 });
    const left = await usedQ();
    if (!res.data) return reply({ error: res.err || "parse", left }, 502);
    return reply({ ...res.data, left });
  } catch (e) {
    console.error(e);
    return reply({ error: "server" }, 500);
  }
});
