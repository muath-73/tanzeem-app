import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Only the app's own origins may call this from a browser. Built-in list plus anything in the ALLOWED_ORIGINS secret (comma-separated).
const ORIGINS = [...new Set(["https://tanzeem.app", "https://www.tanzeem.app", "https://heroic-cassata-aac6fc.netlify.app", "capacitor://localhost", ...(Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",")].map((s) => s.trim()).filter(Boolean))];
function cors(req: Request) {
  const o = req.headers.get("Origin") ?? "";
  const h: Record<string, string> = { "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin" };
  if (ORIGINS.includes(o)) h["Access-Control-Allow-Origin"] = o;
  return h;
}
// per-user daily limit, and a global daily ceiling that caps total spend even if many accounts are created
const LIMIT = 500, GLOBAL_LIMIT = 200000;
const MODEL = "claude-haiku-5-5";
// the model sometimes spends its whole budget before writing the answer (stop_reason max_tokens, empty text), so the cap is generous; cost follows actual output, not the cap
const MAX_TOKENS = 1500;
const HAS_AR = /[؀-ۿ]/;

function clip(v: unknown, n: number) { return String(v ?? "").slice(0, n); }
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function extractJson(t: string) {
  const s = t.indexOf("{"), e = t.lastIndexOf("}");
  if (s >= 0 && e > s) { try { return JSON.parse(t.slice(s, e + 1)); } catch { /* fall through */ } }
  const ar = t.match(/"ar"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (ar) {
    const mean = t.match(/"mean"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    try { return { ar: JSON.parse('"' + ar[1] + '"'), mean: mean ? JSON.parse('"' + mean[1] + '"') : "" }; } catch { /* fall through */ }
  }
  return null;
}

async function callAI(prompt: string, maxTokens: number): Promise<{ data: unknown; err: string }> {
  let err = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt) await sleep(700);
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": Deno.env.get("ANTHROPIC_API_KEY") ?? "", "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] }),
    });
    if (!r.ok) {
      const t = await r.text();
      err = `upstream ${r.status}`;
      console.error("anthropic", r.status, t.slice(0, 300));
      if (r.status === 400 || r.status === 401 || r.status === 403) break;
      continue;
    }
    const j = await r.json();
    const text = (j.content || []).map((c: { text?: string }) => c.text || "").join("");
    const data = extractJson(text);
    if (data) return { data, err: "" };
    err = "parse";
    console.error("parse fail", JSON.stringify(text).slice(0, 300), "stop:", j.stop_reason, "types:", (j.content || []).map((c: { type?: string }) => c.type).join(","), "out:", j.usage?.output_tokens);
  }
  return { data: null, err };
}

function normTerm(t: string) {
  return t.toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}
// students type their own field names; similar ones share one dictionary (e.g. "تسويق" and "supply chain" use إدارة الأعمال)
const CANON: [string, RegExp][] = [
  ["الرياضيات والإحصاء", /(رياض|إحصاء|احصاء|احتمالات|تفاضل|الجبر|\bmath|statist|calculus|algebra|probab|\bstat\b|\bstats\b|precalc|trigonom)/i],
  ["الطيران", /(طيران|ملاح|طيار|مطار|نقل جوي|حركة جوية|aviation|aeronaut|pilot|flight|aircraft|airline|airport|air traffic|\batc\b|avionic)/i],
  ["الطب", /((?:^|[\s(])(?:ال)?طب(?:ي|ية)?(?=$|[\s)])|صيدل|تمريض|اسنان|أسنان|مختبر|صحة|صحي|تشريح|أشعة|اشعة|علاج طبيعي|تغذية|جراح|باطن|اطفال|أطفال|نساء|ولادة|فسيولوج|أحياء دقيقة|احياء دقيقة|\bmedic|\bmed\b|pharm|nurs|dent|health|anatom|physiol|radiolog|patholog|clinical|biomedical|surgery|pediatric|obstetric|microbio|immunolog|nutrition|physiotherap|mbbs|pharmd)/i],
  ["الهندسة", /(هندس|ميكانيك|كهرب|مدني|كيميائ|بترول|معمار|صناعي|انشاء|إنشاء|engineer|\beng\b|mechanic|electric|electronic|civil|petrol|chemical eng|industrial|architect|structur|thermo|aerospace)/i],
  ["علوم الحاسب", /((?<!م)حاسب|حاسوب|كمبيوتر|برمج|ذكاء|اصطناعي|بيانات|سيبران|أمن معلومات|امن معلومات|تقني|شبكات|نظم معلومات|تعلم الآلة|comput|software|program|\bai\b|artificial intel|machine learn|data|cyber|\bit\b|information tech|network|\bcs\b)/i],
  ["القانون", /(قانون|حقوق|شريعة|انظمة|أنظمة|\blaw\b|legal|jurisprud)/i],
  ["إدارة الأعمال", /(إدار|ادار|أعمال|اعمال|تسويق|ماركت|محاسب|مالي|تمويل|سلاسل|إمداد|امداد|لوجست|موارد بشرية|اقتصاد|مشتريات|business|\bbus\b|market|account|financ|supply|chine|chain|logist|\bhr\b|human res|econom|management|procure|mba)/i],
];
function canonField(f: string) {
  const s = String(f || "").trim();
  if (!s) return "";
  for (const [k] of CANON) if (s === k) return k;
  for (const [k, re] of CANON) if (re.test(s)) return k;
  return "";
}
const GENERAL = "عام";
function normField(f: string) { return f.replace(/["\\\n\r]/g, " ").replace(/\s+/g, " ").trim().slice(0, 40); }

Deno.serve(async (req: Request) => {
  const C = cors(req);
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...C, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response(C["Access-Control-Allow-Origin"] ? "ok" : null, { status: C["Access-Control-Allow-Origin"] ? 200 : 403, headers: C });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer /i, "");
    const { data: u } = await admin.auth.getUser(token);
    if (!u?.user) return reply({ error: "auth" }, 401);
    const uid = u.user.id;

    const b = await req.json();
    // the in-app quiz was replaced by the copy-a-prompt button, so only translation is served
    if (b.task !== "translate") return reply({ error: "bad_task" }, b.task === "quiz" ? 410 : 400);

    const text = clip(b.text, 80), field = clip(b.field, 60), ctx = clip(b.ctx, 400), course = clip(b.course, 80);
    if (!text) return reply({ error: "empty" }, 400);

    // shared dictionary: the course's field first, then its family, then the general academic words ("عام")
    let ckey = "", fkey = "", gkey = "", skipFirstPass = false;
    try { ckey = normTerm(text).slice(0, 80); fkey = normField(field); gkey = canonField(fkey) || fkey; } catch { ckey = ""; }
    const cacheQ = (async () => {
      if (!ckey || !fkey) return { data: null };
      try { return await admin.from("term_cache").select("field,ar,mean,amb").eq("term", ckey).in("field", [...new Set([fkey, gkey, GENERAL])]); }
      catch (e) { console.error("cache read", e); return { data: null }; }
    })();
    const [{ data: sub, error: subErr }, { data: rows }] = await Promise.all([
      admin.from("subscriptions").select("period_end").eq("user_id", uid).maybeSingle(),
      cacheQ,
    ]);
    if (subErr) console.error("subscriptions", subErr.message);
    const subscribed = !!sub && new Date(sub.period_end).getTime() >= Date.now();
    const shape = subscribed
      ? `{"ar": "<short Arabic translation>", "mean": "<one simple Arabic sentence explaining the term>"}`
      : `{"ar": "<short Arabic translation>"}`;
    const prompt = `Translate the English term "${text}" into Arabic as it is used in the field "${field}" (course: "${course}"). Sentence it appears in: "${ctx}". Reply with ONLY a single JSON object and nothing else, in exactly this shape: ${shape}. Always give a translation, even for a single common word.`;

    // a cache hit costs nothing. Any failure falls through to the normal AI path.
    try {
      const R = (rows ?? []) as { field: string; ar: string; mean: string; amb: boolean }[];
      const c = R.find((r) => r.field === fkey) ?? R.find((r) => r.field === gkey) ?? R.find((r) => r.field === GENERAL);
      if (c?.amb) skipFirstPass = true;
      else if (c && c.ar && (!subscribed || c.mean)) return reply({ data: subscribed ? { ar: c.ar, mean: c.mean } : { ar: c.ar }, cached: true });
    } catch (e) { console.error("cache pick", e); }

    // atomic daily counters (per user + global). Fails closed: if the counter is unavailable we do not spend money.
    const { data: used, error: bumpErr } = await admin.rpc("bump_usage", { p_user: uid, p_task: "translate", p_limit: LIMIT, p_global: GLOBAL_LIMIT });
    if (bumpErr) { console.error("bump_usage", bumpErr.message); return reply({ error: "server" }, 503); }
    if (used === -1) return reply({ error: "limit" }, 429);
    if (used === -2) { console.error("GLOBAL DAILY CAP REACHED: translate"); return reply({ error: "limit" }, 429); }

    // dictionary pass: term + field only (no user-written sentence), so a shared entry can't be steered by one user's text
    if (ckey && fkey && !skipFirstPass) {
      try {
        const p1 = `You translate terms for university students. Term: "${text}". Field of study: "${fkey}". Reply with ONLY a single JSON object and nothing else, in exactly this shape: {"ar": "<short Arabic translation as used in this field>", "mean": "<one simple Arabic sentence explaining the term in this field>", "amb": <true if the term has two or more clearly different meanings within this field, otherwise false>}. Always give a translation, even for a single common word.`;
        const f = await callAI(p1, MAX_TOKENS);
        const d = f.data as { ar?: unknown; mean?: unknown; amb?: unknown } | null;
        if (d && typeof d.amb === "boolean") {
          if (d.amb) {
            await admin.from("term_cache").upsert({ term: ckey, field: gkey, ar: "", mean: "", amb: true, updated_at: new Date().toISOString() }, { onConflict: "term,field" });
          } else {
            const ar = typeof d.ar === "string" ? d.ar.trim() : "";
            const mean = typeof d.mean === "string" ? d.mean.trim() : "";
            if (ar && ar.length <= 120 && HAS_AR.test(ar) && mean.length <= 300) {
              await admin.from("term_cache").upsert({ term: ckey, field: gkey, ar, mean: HAS_AR.test(mean) ? mean : "", amb: false, updated_at: new Date().toISOString() }, { onConflict: "term,field" });
              return reply({ data: subscribed ? { ar, mean: HAS_AR.test(mean) ? mean : "" } : { ar } });
            }
          }
        }
      } catch (e) { console.error("dictionary pass", e); }
    }

    const res = await callAI(prompt, MAX_TOKENS);
    const data = res.data;
    if (!data) return reply({ error: res.err || "parse" }, 502);
    if (!subscribed && typeof data === "object") delete (data as Record<string, unknown>).mean;
    return reply({ data });
  } catch (e) {
    console.error(e);
    return reply({ error: "server" }, 500);
  }
});
