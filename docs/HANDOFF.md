# تنظيم (Tanzeem) — Handoff for the next Claude session

Written 20 Nov 2026 at the end of a very long session, so a new chat can continue without re-reading it.
Read this whole file first. The user's personal preferences and long project history are also in Claude's memory
(`/preferences.md`, `/areas/uni-study-app.md`), which loads automatically.

---

## 1. Who and how to work (MUST follow)

User: معاذ (mooaath.kh@gmail.com), Saudi university student in Dhahran, owner of تنظيم.

- Reply **in Saudi Arabic dialect** only. Short, clear, ordered.
- Every step he must do: give the **direct link** to the exact page. One step at a time (حبة حبة).
- Never claim something works unless verified. If unsure, say so plainly.
- When asked for a fix: fix it, **verify it yourself** (Playwright harness below), batch changes, and say "build" only once.
- **Do exactly what he asks.** Never substitute wording or add things on your own. A concern = one line, don't act on it.
- **Ask before doing anything extra** («لا تسوي شيء بدون ما تستأذن», «رد قبل لا تسوي شي»). Before changing the app, list planned actions and wait for yes/no.
- Never ask for / accept secrets (keys, passwords, demo password). Don't sign in for him. No Chrome actions unless asked.
- Videos: before making any video, present the full idea and wait for yes. Every video: ~2 s static at start + 5 s holding the last screen at end. In a set, different terms/examples/screens per video. Ads: stress that **translation is completely free**. Never write "قريباً" etc. on his own — put exactly what he says (e.g. «متوفر على App Store»).
- Never use the phrase «معلم ذكاء اصطناعي».

## 2. Where everything lives

| Thing | Location |
|---|---|
| App code (iPad Capacitor app) | GitHub `muath-73/tanzeem-app`, branch `main`. The app is `www/index.html` (single file). |
| Website tanzeem.app | `site/` in this repo (landing `site/index.html`, app `site/app.html` = same as `www/index.html`, `_headers`, privacy/support/refund pages, deck images). Hosted on **Netlify** site `heroic-cassata-aac6fc` (id `07d50bf1-5be8-4429-adac-948adea120b8`), deployed **manually** (drag-drop / Netlify deploy tool), NOT from Git. |
| Backend | Supabase project `orbzpmriclzwejtzasvh` (org `ekfogtgfrxvrmfbsaxhd`, **Free plan**), region eu-west-3. |
| Build | Codemagic workflow "Tanzeem iPad to TestFlight" (`codemagic.yaml`), started manually by the user. iPad only (`TARGETED_DEVICE_FAMILY = 2`). |
| Edge function sources (copies) | `supabase/functions/ai`, `iap`, `pay` (deployed versions are the source of truth; read with Supabase `get_edge_function`). |
| Dictionary source data | `data/dict/*.tsv` |
| Test harness | `tools/qa/` (see §8) |
| «صوّر وحل» design preview | `docs/solve-preview/app.html` + `shots/` |

**Website is behind the repo:** last Netlify deploy was 17 Nov 2026. The changes v75e–v75g (notes for non-subscribers, «جرّب الاشتراك») are in GitHub but **not on tanzeem.app yet**. To deploy: copy `www/index.html` → `site/app.html` and deploy `site/` to the Netlify site above (ask the user first — he batches deploys).

## 3. Current state (20 Nov 2026)

- **App Store:** iOS app 1.0 **build 10 submitted, under Apple review**. Do NOT touch/replace it. Items: Monthly (Apple id 6832944358), Yearly (6832932370), subscription group 22564282. China mainland removed from availability. Review notes pasted in English. Demo account `tanzeemm.app+review@gmail.com` (subscription source 'review', yearly, active to 2027-11-11). Small Business Program approved (15%).
- **Repo HEAD:** v75g (`e2780c6`) + this handoff commit. Commits after build 10 (v75e, v75f, v75g) are **not built yet** — a build is needed for them to reach the iPad (user knows; don't nag).
- Prices: monthly 18 SAR, yearly 159 SAR. Invite-code users get 3 SAR off first monthly. Coupon box stays (empty).
- Support email: tanzeemm.app@gmail.com.

### Recent app changes (this session)
- v75–v75d: sign-in screen is a normal page (fixed iPad partial paint), English strings, restore purchases gives one clear answer, IAP claim flow, no "linked to another account" toast during purchase, iapLoad loop fix.
- v75e–g: **notes for non-subscribers**: notes box opens and they can type, but nothing is saved. A soft green notice (brand colour, `--primary-soft`) says «ملاحظة: ترى ملاحظاتك ما تنحفظ هنا» + link «جرّب الاشتراك» (opens plan). Status «ما تنحفظ». Writing on slides stays locked for non-subscribers (lock modal «هذي من مزايا المشتركين 🌟»).
- Upsell link under translations: «جرّب الاشتراك» (was «شوف الاشتراك»).
- Non-subscribers: translation only, no simple explanation (`mean`) — by design.

### Backend
- Edge functions: `ai` v19 (translate only; dictionary-first), `iap` v8 (Apple; production StoreKit API returns 401 → uses sandbox host fallback; `claim:true` on purchase/restore moves subscription between accounts), `signup` v15 (calls `claim_trial` RPC; `grant execute on claim_trial to service_role` was required), `pay` v9 (Moyasar web payments), `convert-pptx` v10, `delete-account` v10.
- Tables: `term_cache(term, field, ar, mean, amb)` key (term, field); `subscriptions`, `apple_txn`, `invoices`, `trial_claims`, `ai_usage`, `app_state`, `ink` (notes+drawing), storage bucket `slides` (50 MB limit).
- `ai` function: per-user limit 500/day, global 200,000/day, model `claude-haiku-5-5`. Field name typed by student is mapped by `CANON` regexes to a dictionary field, order: الرياضيات والإحصاء → **الطيران** (added v19) → الطب → الهندسة → علوم الحاسب → القانون → إدارة الأعمال. Lookup order: exact field → canon field → «عام». `mean` returned only to subscribers. Note «سلاسل الامداد(رياضيات)» maps to math because it contains «رياض».

### Dictionary (term_cache) counts after this session
الهندسة ≈9,640 · الطب ≈8,330 · إدارة الأعمال ≈4,900 (incl. the user's 1,000-term Supply Chain list: 594 new + 644 existed; abbreviations stored separately, e.g. "bol") · علوم الحاسب ≈3,280 · القانون ≈3,040 · عام ≈930 · الطيران ≈680 · الرياضيات والإحصاء ≈360.
Added this session: aviation terms + abbreviations, ~500 abbreviations across all fields (ambiguous ones like PT/MS/RA deliberately skipped so AI translates them in context), general academic words.
Pending (user asked earlier): before launch, review every added term for correctness.

## 4. Decided, not built yet: «صوّر وحل» (photo a paper → answers)

Ship in **update 1.1 after Apple approves 1.0**, together with **iPhone support**. Preview: `docs/solve-preview/` (open with the harness; state via `window.__SV` = start | loading | answers | paper | free | limit and `window.__SVM` = short | long).

Spec agreed with the user:
- **Subscribers only.** Limit **15 papers per week** (each page = 1). Resets weekly (preview says Sunday).
- New bottom tab in the **middle**: «صوّر وحل» with camera icon (tabs: الرئيسية · كلماتي · صوّر وحل · الاشتراك · الإعدادات).
- Screen: title «صوّر وحل» / «صوّر أي ورقة، ونعطيك الإجابات مرتبة.»; choice «تبي الإجابات»: **بدون شرح** (default, «الإجابات بس») / **مع شرح**; big dashed box with «صوّر الورقة» (camera) + «اختر صورة من الألبوم»; can pick several pages at once; pill «باقي لك N من 15 ورقة هذا الأسبوع»; «🔒 ما نحفظ صورك. تنحذف بعد الحل مباشرة.» (photos must NOT be stored).
- Results: one white **sheet** per page (header «الصفحة 1», «الصفحة 2» when several), keep the paper's own numbering and parts (Part 1 / Part 2), **thick black line between answers**, big bold text.
- **Format the user asked for next time:** number, then a **dash**, then the answer — e.g. **`1 - (c)`**, **`a - خطأ (False)`** — not a dot.
- Colours: MCQ letter **green**, any text **black**; صح/خطأ (True/False) **green**; final result of a worked problem green highlight.
- «بدون شرح»: MCQ → **letter only** (no option text, no working); True/False → صح/خطأ only; a question with no choices that needs solving → **full solution steps** + final answer.
- «مع شرح»: same + short Arabic explanation line under each answer.
- Footer note: «ℹ️ الإجابات من الذكاء الاصطناعي، وممكن يكون فيها أخطاء. راجعها قبل ما تعتمد عليها.»
- Non-subscriber screen: «صوّر أي ورقة وخذ إجاباتها مرتبة» + «جرّب الاشتراك». Limit screen: «خلصت أوراق هذا الأسبوع».
- Marketing wording: «صوّر أي ورقة وخذ الإجابات مرتبة» — **never mention exams**.
- Model: Haiku 5.5 (user thinks it's enough; test accuracy on real papers first — user should send 5–10 sample papers).
- Needs `NSCameraUsageDescription` + `NSPhotoLibraryUsageDescription` added in `codemagic.yaml` (PlistBuddy step) — without them the camera can crash the app. No new Capacitor plugin needed (file input `accept="image/*"`).
- Server: new edge function (e.g. `solve`): check subscription, weekly counter, send image(s) to Haiku, return structured JSON (parts → items {label, type: mcq|tf|work, answer, steps[], explain}), never store the image.
- Equations: render with proper math (fractions, roots, superscripts); preview uses simple HTML/CSS; real build could bundle KaTeX locally.

Cost estimate given to user (Haiku 5.5: $0.10/M in, $0.50/M out; ~2,000 input tokens per photo): ≈0.002 SAR per photo answers-only, ≈0.005 with explanation; ~4 photos/week/subscriber → ≈4 halalas/month per subscriber. Net per 18 SAR monthly subscriber ≈12.8 SAR (after VAT 15%, Apple 15%, AI, fixed costs).

## 5. iPhone support (update 1.1)

App is iPad-only now. Plan: after 1.0 approval, enable iPhone (remove the `TARGETED_DEVICE_FAMILY = 2` sed in `codemagic.yaml`, test phone layout), user adds iPhone screenshots in App Store Connect, submit 1.1. Once iPhone is supported it can't be removed later. Phone preview screenshots were made (layout works; study screen slide is small on phone).

## 6. Pending / reminders for the user

1. Wait for Apple review result of 1.0 (build 10). Then 1.1 = iPhone + «صوّر وحل».
2. Upgrade Supabase to **Pro ($25/mo)** before launch/marketing (Free: 1 GB storage ≈550 slide files, 5 GB egress, 500k function calls/month). Link: https://supabase.com/dashboard/org/ekfogtgfrxvrmfbsaxhd/billing
3. Check Anthropic rate limits/tier: https://console.anthropic.com/settings/limits ; before launch turn auto-reload back on with monthly cap (from memory).
4. Deploy the website (site/app.html is behind) when he wants.
5. Build in Codemagic for v75e–g to reach the iPad (not urgent; not for the in-review version).
6. Review all dictionary terms before launch.
7. Other long-standing reminders are in memory `/areas/uni-study-app.md` (security steps, Netlify plan, trademark later, etc.).

## 7. Promo videos (done earlier)
4 videos v1–v4 (v4 = all features, 27 s, end card tanzeem.app + «متوفر على App Store»). Pipeline: HTML/CSS pages rendered frame-by-frame with Playwright (seek `document.getAnimations()` at 30 fps) → ffmpeg libx264 veryfast crf 18. Fonts: Lalezar (headings, lacks "…" glyph → use "..."), IBM Plex Sans Arabic (body). The project zip `tanzeem-promo-project.zip` was sent to the user in chat (not in repo, 285 MB of work files). No TTS available in the sandbox; user does voice in CapCut.

## 8. Test harness (`tools/qa`)
Playwright with a Supabase stub (no network). `h.js` serves `../$V` relative to `tools/` — e.g. from `tools/qa`: `V=../site node t89.js` serves `site/`. `open(browser, cfg, {ctx})` where cfg = `{session, email, state, sub, tr:{term:[ar, mean]}, iapMode, ...}`; stub records `window.__calls`, `__iapBodies`. `login.js` → `dismiss(page)` closes welcome modals. Samples: `t89.js` (notes free vs subscriber vs English), `ph.js` (all phone screens), `sv*.js`/`ph2.js` (solve preview; serve `docs/solve-preview` with `V=../docs/solve-preview`). PDFs: `med.pdf`, `test.pdf`. Playwright + Chromium are pre-installed in the cloud sandbox.

## 9. Answers to likely questions
- 2000 users on Free Supabase → storage/egress/function quotas run out; Pro fixes it.
- Apple: cancelling the current review restarts review; adding iPhone requires a new build — so do it as update 1.1.
- Netlify deploys cost credits (free 300/month); user batches deploys and planned the $9 Personal plan.
