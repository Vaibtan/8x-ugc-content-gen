# PRD — "Founder Voice" (working name)
### AI organic-content engine for B2B founders: strategy → voice-true content → multi-format assets → lead capture

Version 0.1 · 2026-08-30 · Owner: Vaibhav · Status: Draft for /to-spec

Scope decisions locked with the owner: **~1 week, solo build · B2B founder / solo-operator persona · channel-agnostic export (no publishing OAuth in MVP) · lead acquisition = AI lead magnets + hosted capture page · must work on mobile screens.**

Research backing every claim below is in `docs/RESEARCH.md`.

---

## 1. Problem

B2B founders know organic personal-brand content on LinkedIn (and short vertical video) is the cheapest pipeline they will ever get — personal profiles out-reach company pages 5–10x, and a single post can produce warm ICP conversations. But:

1. **They don't know what to say.** No ICP definition, no content pillars, no calendar — they post sporadically and randomly.
2. **AI output sounds like AI.** Generic tools (Jasper, ChatGPT) produce content nobody recognises as the founder's voice, so it under-performs and they stop.
3. **One idea becomes one post**, not a text post + carousel + 60-second video + newsletter blurb.
4. **Content never turns into leads.** There is no CTA strategy, no lead magnet, no capture page, no list. Existing "lead" tooling either scrapes LinkedIn (ToS-banned, ~23% account-restriction rate) or requires a RevOps stack (Clay + Lemlist).
5. Tools that do parts of this cost $39–199/mo each and none covers the full loop (Taplio, AuthoredUp, Supergrow, Scripe, Lately, Clay).

## 2. Solution (one sentence)

A mobile-first web app where a founder answers a 5-minute voice/text interview, gets an ICP + content-pillar strategy and a 30-day calendar, and turns any idea into a **voice-true content pack** (LinkedIn post, PDF carousel, captioned vertical video with ElevenLabs voiceover, newsletter blurb) that ends in a **lead magnet + hosted capture page** — all exportable in one tap, with no ToS-risky automation.

**Why it wins the demo:** the 8x thesis is "organic because it is" — content from a real person's account, in their voice, many variants, learn what works. We automate that loop for B2B founders: brief → variants → hooks tested → winners recycled → leads captured.

## 3. Goals & non-goals

**Goals (MVP, hackathon)**
- G1 A new user reaches a finished, exportable content pack in < 10 minutes on a phone.
- G2 Generated copy is demonstrably in the user's voice (side-by-side "generic vs. your voice" in the demo).
- G3 Every content pack ends in a lead mechanism: lead magnet + capture page + CSV export.
- G4 Zero LinkedIn ToS exposure: no scraping, no extensions, no auto-DMs.
- G5 Runs end-to-end on OpenAI + ElevenLabs + free tiers; per-pack cost < $0.30.

**Non-goals (MVP)**
- Publishing/scheduling to any network (clean `Publisher` port left for later).
- Engager scraping/enrichment, auto-DMs, engagement pods.
- Multi-user teams, agencies, white-label, billing.
- AI-avatar/talking-head video, gen-AI b-roll (stretch only).
- Analytics from platforms (we only track what we host: capture-page views and leads).

## 4. Personas

- **Primary — B2B founder / solo operator** (SaaS, agency, consultant). 500–10k LinkedIn followers, posts < 1x/week, no marketing hire. Uses phone between meetings. Wants inbound leads without becoming a "creator".
- **Secondary — hackathon judge** (demo audience). Needs a wow moment in 3 minutes: voice in → strategy + video + landing page out.

## 5. User journey (happy path)

1. **Onboard (2 min):** sign in → "Tell me about your business" — record voice (mobile mic) or type. Optional: paste 3 past posts / LinkedIn About text for voice calibration.
2. **Strategy (auto):** app returns **ICP card** (who, pains, triggers, objections), **3–5 content pillars**, **positioning line**, **voice profile** (tone, sentence length, vocabulary, taboo words), and a **30-day calendar** (date · pillar · format · hook · funnel stage). User edits inline.
3. **Create a pack:** pick a calendar item or type/record an idea → app generates a **Content Pack**:
   - LinkedIn text post (3 hook variants, formatted, save/comment CTA)
   - PDF carousel (8–10 slides, branded, rendered)
   - Vertical video ≤ 60 s: script → ElevenLabs voiceover → Remotion kinetic-text render with captions (9:16 MP4)
   - Newsletter/email blurb
   - **Lead magnet** (checklist / template / mini-guide as PDF) + comment-keyword CTA + hosted capture page (`/m/<slug>`)
4. **Review & regenerate:** per-asset "more like my voice", "punchier hook", "shorter". Voice-fidelity score shown.
5. **Export:** copy text, download PDF/MP4, share capture-page link. Pack marked "posted" manually.
6. **Leads:** capture page collects name + email (+ optional company/role), delivers the magnet via email, lands in **Leads** tab with source pack; CSV export; drafted follow-up message (human sends).
7. **Learn:** user logs which post performed ("winner"); calendar suggests recycles of winners into other formats.

## 6. Functional requirements

### F1 Onboarding & voice profile
- Voice recording in browser (MediaRecorder), transcribed via OpenAI `gpt-4o-mini-transcribe` (or Whisper).
- Interview: 5 adaptive questions (what you sell, who buys, why they buy, what you believe that others don't, a recent customer story).
- Output `VoiceProfile` JSON (strict schema): tone adjectives, avg sentence length, signature phrases, banned words, emoji policy, formatting habits, POV (I/we), example sentences.
- Voice calibration from pasted posts (optional).

### F2 Strategy engine
- `ICP`, `Pillars[]` (3–5, each with angles), `Positioning`, `Calendar[30]`.
- Content-matrix generation: pillars × angles × formats → ranked ideas; funnel-stage mix (TOFU/MOFU/BOFU ≈ 50/30/20).
- Optional web research on the niche via Responses `web_search` (low context) — capped at 2 calls per strategy.
- Editable; regenerate a single section without touching the others.

### F3 Content pack generator
- Input: idea text/voice + pillar + goal (reach / leads).
- Text post: hook-library-driven (300+ hook patterns seeded), 3 variants, LinkedIn formatting rules (≤ 3 lines per paragraph, first 210 chars = hook, save/comment CTA, no external link in body).
- Carousel: slide JSON → server-rendered PDF (title, 6–8 body slides, CTA slide) with a brand kit (colours, font, logo, name/handle).
- Video: script (≤ 150 words) → ElevenLabs TTS (`eleven_flash_v2_5`, user's cloned voice if available, else preset) → word-level timestamps → Remotion composition (kinetic text, progress bar, captions, brand colours) → MP4 1080×1920.
- Newsletter blurb: 120–180 words + subject line.
- All generations are **jobs** with status (queued/running/done/failed), visible in the pack; text assets stream instantly, media assets complete asynchronously.

### F4 Lead magnet & capture
- Magnet types: checklist, template, 5-step guide, scorecard. Generated as PDF with brand kit.
- Capture page: public, mobile-first, `/m/<slug>` with headline, 3 bullets, form (name, email, optional company/role), consent checkbox, UTM passthrough.
- Delivery: email via Resend with PDF link (signed URL); fallback: instant download after submit.
- Leads table: name, email, company, source pack, UTM, created_at, status (new/contacted/won). CSV export. Drafted personalised follow-up (copy only).
- Comment-keyword CTA text auto-inserted into the post ("Comment PLAYBOOK and I'll send it") — the user DMs manually; the capture link is the scalable path.

### F5 Library, calendar & learn loop
- Packs list with status (draft/ready/posted/winner), filter by pillar/format.
- Calendar view (mobile: list; desktop: month grid) — tap a slot → generate.
- "Mark as winner" → suggests 3 repurposes (different format/angle) added to calendar.

### F6 Brand kit & settings
- Name, handle, headshot, logo, 2 colours, font choice; API-usage meter (tokens/credits spent per pack).

### F7 Mobile requirements
- Responsive ≤ 390 px width; bottom tab nav (Home · Create · Calendar · Leads · Settings); thumb-reachable primary CTA; mic recording works on iOS Safari/Android Chrome; PDF/MP4 open in native viewers; PWA manifest + installable; no horizontal scroll; skeletons for async media.

## 7. Non-functional requirements

- **Latency:** text assets stream within 3 s; carousel PDF < 15 s; video < 90 s (async, notify in-app).
- **Cost:** < $0.30 per full pack (≈ 15K tokens luna + 1 image + 150 words TTS + free render).
- **Reliability:** every external call idempotent + retried (3x, backoff); jobs persisted so a refresh never loses work.
- **Security:** API keys server-only; capture page rate-limited + honeypot; signed URLs for magnet PDFs; per-user row-level security.
- **Compliance:** no LinkedIn scraping/automation; consent checkbox on capture; unsubscribe link in delivery email.
- **Observability:** PostHog (8x partner) for funnel events: onboard_complete, pack_generated, asset_exported, lead_captured.

## 8. Architecture

```
[Next.js 15 App Router (PWA, mobile-first, Tailwind + shadcn)]
    │  server actions / route handlers
    ├─ Auth + DB + Storage + RLS ─── Supabase (Postgres, Storage, Auth)
    ├─ Jobs ───────────────────────── Inngest (or Trigger.dev) durable functions
    │      │  (all steps run through Supabase + Db Effect services)
│      ├─ generateStrategy      → OpenAI Responses (gpt-5.6-luna, json_schema strict, web_search cap 2)
    │      ├─ generatePackText      → OpenAI (luna; terra for final "voice pass")
    │      ├─ renderCarousel        → slide JSON → @react-pdf/renderer → Supabase Storage
    │      ├─ renderVideo           → ElevenLabs TTS (+timestamps) → Remotion render (Docker worker) → Storage
    │      ├─ renderMagnet          → PDF → Storage
    │      └─ deliverMagnet         → Resend email
    ├─ Public capture page  /m/[slug]  (edge-cached, ISR)
    └─ Ports (interfaces): LLMPort · TTSPort · RendererPort · MailPort · PublisherPort (unimplemented)
```

**Language & runtime: TypeScript + Effect (v3 stable line)**

Verified against current docs (2026-08-30): Effect 4 is still at `4.0.0-rc.*`, so we pin **Effect v3** plus `@effect/ai` + `@effect/ai-openai` and `@effect/platform`. Effect is used for the **server-side core only**; React/Next UI, Remotion compositions and Inngest function bodies stay plain TypeScript and call into the core via a `ManagedRuntime`.

| Concern | How Effect covers it |
|---|---|
| Ports (`LLMPort`, `TTSPort`, `RendererPort`, `MailPort`, `PublisherPort`) | `Context.Tag` services + `Layer`s; `Layer.mock`/test layers for the seams `/to-spec` will pick |
| Strict LLM JSON (VoiceProfile, Strategy, Pack, …) | One `Schema.Struct` per prompt; `@effect/ai` `LanguageModel.generateObject({ prompt, schema })` with `OpenAiLanguageModel.model("gpt-5.6-luna")`; schema doubles as DB/JSON validation |
| Retries / backoff / timeouts on OpenAI, ElevenLabs, Resend | `Effect.retry(Schedule.exponential(...).pipe(Schedule.compose(Schedule.recurs(3))))`, `Effect.timeout` |
| Typed failures (RateLimited, ModerationBlocked, RenderFailed, QuotaExceeded) | `Data.TaggedError` in the error channel → UI maps to precise states |
| Cost meter | a `Usage` service accumulated via `FiberRef`/`Ref`, flushed to `UsageEvent` |
| Parallel asset generation inside a pack | `Effect.all([...], { concurrency: 3 })` |
| Config / secrets | `Config.string("OPENAI_API_KEY")` etc., fails fast at boot |
| Next.js integration | `ManagedRuntime.make(AppLayer)` singleton; server actions/route handlers do `runtime.runPromise(program)`; streaming text via `Stream` → `ReadableStream` |
| Inngest | Each step calls `runtime.runPromise`; Inngest owns durability/retries across steps, Effect owns retries inside a step (don't double-retry) |
| ElevenLabs / Resend / fal (no Effect provider) | Thin clients on `@effect/platform` `HttpClient` + `Schema` decoding |

| Supabase | `Supabase` service (typeonce.dev pattern): `Config`-built Live Layer, `query(client => …)` → `Effect<A, SupabaseError>`, generated `Database` types; service-role and per-user (RLS) Layer variants; `Db` repository service on top, decoded via the prompt Schemas |

Not Effect: React components, Remotion compositions, browser-side Supabase Auth session handling only.

Trade-off accepted: Effect adds ~half a day of setup/learning on a 7-day solo build; payoff is the ports/seams being real from day 1, testable generation pipeline without hitting APIs, and typed failure states the mobile UI can render.

**Why these choices**
- Next.js + Supabase + Vercel: fastest solo path with auth, storage, RLS, and mobile PWA out of the box.
- Durable jobs (Inngest) rather than long request handlers: video render exceeds serverless timeouts; jobs survive refresh; UI polls/streams status.
- Remotion instead of gen-AI video: deterministic, branded, free, renders in seconds; B2B "kinetic text + voice" outperforms uncanny avatars, and Sora 2 is being shut down 2026-09-24. Gen-AI b-roll via fal Wan 2.2 is a stretch behind `RendererPort`.
- Models: `gpt-5.6-luna` default (cheap, strict JSON); `gpt-5.6-terra` for the final voice pass only; Groq `gpt-oss-120b` as free fallback for drafts. Transcription `gpt-4o-mini-transcribe`.
- Emergent credits: optional — use Emergent only to scaffold UI screens if it speeds things up; runtime never depends on it (no public API, text/image only).
- Render hosting: a tiny Docker worker on Fly/Railway pulling Inngest jobs (Remotion Lambda deferred).

### Data model (core entities)
`User` · `BrandKit` · `VoiceProfile` · `Strategy` (icp, pillars, positioning) · `CalendarItem` · `Pack` (idea, pillar, goal, status) · `Asset` (pack_id, type: post|carousel|video|newsletter|magnet, status, content_json, file_url, cost_cents) · `Magnet` (asset_id, slug, headline, bullets) · `Lead` (magnet_id, name, email, company, role, utm, status) · `Job` (type, ref_id, status, error, cost) · `UsageEvent`.

### Key prompts (each with a strict JSON schema)
1. `voice_profile` (interview transcript → VoiceProfile)
2. `strategy` (business + VoiceProfile → ICP/pillars/positioning/calendar)
3. `pack_text` (idea + pillar + VoiceProfile + hook-library sample → post variants, carousel slides, video script, newsletter, magnet outline, CTA)
4. `voice_pass` (draft + VoiceProfile → rewritten draft + fidelity score + diff notes)
5. `followup_dm` (lead + pack → 2-line human-sent message)

## 9. Build plan (7 days, solo)

| Day | Deliverable | Demo-able? |
|---|---|---|
| 1 | Repo, Next.js + Supabase auth/schema, brand kit, mobile shell (tabs), OpenAI client with strict schemas | Sign in, settings |
| 2 | Onboarding interview (text + mic), VoiceProfile, Strategy + Calendar screens | Strategy from a voice note |
| 3 | Pack text generation (streaming), hook library, voice pass + fidelity score, export/copy | Post in your voice |
| 4 | Carousel + magnet PDF rendering, capture page, Resend delivery, Leads tab + CSV | Lead captured end-to-end |
| 5 | Video: ElevenLabs TTS + Remotion render worker + job status UI | Vertical video with voiceover |
| 6 | Calendar → pack flow, winner/repurpose loop, PostHog, error states, cost meter | Full loop |
| 7 | Mobile QA (iOS Safari/Android), seed demo account, demo script, README, video | Submission |

Cut order if behind: gen-AI b-roll (already out) → newsletter blurb → repurpose loop → video (keep script + audio) → carousel images.

## 10. Success metrics

- Demo: idea → full pack in < 3 min live on a phone; ≥ 1 lead captured on stage.
- Quality: voice-fidelity self-rating ≥ 4/5 from 3 test founders; blind "which is the real founder" test ≥ 60% fooled.
- Cost: ≤ $0.30 per pack measured by the usage meter.
- Reliability: 20 consecutive packs without a failed job.

## 11. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Voice sounds generic | Few-shot with user's real posts; separate `voice_pass` step with fidelity score; ban-word list |
| Remotion render infra eats a day | Fallback: audio + captions "audiogram" via ffmpeg in the worker; or pre-render on laptop for demo |
| OpenAI image org verification blocks `gpt-image-*` | Carousels are text/vector PDFs; images optional; Gemini `gemini-3.1-flash-image` free tier as fallback |
| ElevenLabs plan lacks cloning | Use preset voices; clone is stretch |
| Hackathon theme announced on the day differs | Keep pillars/packs generic; the pack engine works for any "content → leads" brief |
| Mobile mic quirks on iOS | Test day 2; text input always available |

## 12. Post-hackathon roadmap

LinkedIn self-serve publishing (`w_member_social`) and Postiz for other networks behind `PublisherPort` → user-pasted engager list → ICP scoring → drafted outreach (human send) → team/EGC mode (one brief → per-employee variants) → performance loop feeding the calendar → billing.

## 13. Decisions closed (2026-08-30)

1. Video render: **Docker worker** (Fly/Railway) pulling Inngest jobs; Remotion Lambda deferred.
2. Voice: **ElevenLabs preset voices** in MVP; cloning is a stretch behind `TTSPort`.
3. Sign-in: **Google OAuth** via Supabase Auth (magic-link as fallback).
4. Language/runtime: **TypeScript + Effect v3** for the server core (see §8).
5. Hackathon event link/deadline: still to be confirmed by the owner; plan assumes ~7 days.
