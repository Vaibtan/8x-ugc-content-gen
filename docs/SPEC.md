# Spec: Founder Voice MVP — strategy → voice-true content packs → lead capture

Synthesised from `docs/PRD.md` and `docs/RESEARCH.md` (2026-08-30). Scope: ~1 week, solo, hackathon.

## Problem Statement

I am a B2B founder / solo operator. I know organic content on LinkedIn and short vertical video is the cheapest pipeline I will ever get, but I don't know what to say (no ICP, no pillars, no calendar), everything AI writes for me sounds like AI, one idea only ever becomes one post, and none of it ever turns into a lead I can follow up. The tools that do parts of this cost $39–199/month each, and the "lead" tools either scrape LinkedIn (which gets accounts restricted) or need a RevOps stack I don't have. I mostly have my phone between meetings.

## Solution

A mobile-first web app. I answer a 5-minute voice or text interview about my business. The app gives me a strategy — ICP card, 3–5 content pillars, a positioning line, a voice profile and a 30-day calendar — that I can edit. From any calendar slot or idea I get a **Content Pack** in my voice: a LinkedIn post with three hook variants, a branded PDF carousel, a ≤60 s captioned vertical video with an ElevenLabs voiceover, a newsletter blurb, and a **lead magnet** with a hosted capture page. I export each asset in one tap and post it myself. Leads who claim the magnet land in my Leads tab with a drafted follow-up I send by hand. I mark winners and the calendar suggests repurposes. Nothing touches LinkedIn's API or scrapes anything.

## User Stories

### Onboarding & voice profile
1. As a founder, I want to sign in with Google, so that I am in the app in one tap on stage and on my phone.
2. As a founder, I want to record a voice answer with my phone mic, so that I can onboard without typing.
3. As a founder, I want to type my answer instead of recording, so that I can onboard in a quiet room or if the mic fails.
4. As a founder, I want the interview to ask ~5 adaptive questions (what I sell, who buys, why, what I believe others don't, a customer story), so that the app learns enough to write like me.
5. As a founder, I want to optionally paste 2–3 of my past posts, so that my voice profile is calibrated on real writing.
6. As a founder, I want to see my voice profile (tone, sentence length, signature phrases, banned words, emoji policy, POV) and edit it, so that I can correct what the AI got wrong.
7. As a founder, I want to see progress while transcription and profile generation run, so that I know the app hasn't hung.

### Strategy
8. As a founder, I want an ICP card (who, pains, buying triggers, objections), so that every piece of content targets a real buyer.
9. As a founder, I want 3–5 content pillars each with several angles, so that I never run out of on-brand ideas.
10. As a founder, I want a one-line positioning statement, so that my bio and CTAs are consistent.
11. As a founder, I want a 30-day calendar (date, pillar, format, hook, funnel stage) mixed roughly 50/30/20 across TOFU/MOFU/BOFU, so that I have a plan instead of random posts.
12. As a founder, I want to edit any strategy field inline, so that the plan reflects my judgement.
13. As a founder, I want to regenerate one section (e.g. pillars) without losing my edits elsewhere, so that iteration is cheap.
14. As a founder, I want the strategy to optionally use a couple of web searches about my niche, so that it reflects current market language, without blowing my budget.

### Content packs
15. As a founder, I want to tap a calendar slot and get a pack generated for it, so that following the plan is one tap.
16. As a founder, I want to type or record a fresh idea and pick a pillar and a goal (reach or leads), so that spontaneous ideas become packs too.
17. As a founder, I want three hook variants for the LinkedIn post, so that I can choose the strongest opener.
18. As a founder, I want the post formatted for LinkedIn (short paragraphs, first ~210 characters as the hook, save/comment CTA, no link in body), so that it performs under the 2026 algorithm.
19. As a founder, I want the text assets to stream in within seconds, so that the pack feels instant even while media renders.
20. As a founder, I want a branded 8–10 slide PDF carousel, so that I have a high-dwell format without a designer.
21. As a founder, I want a ≤150-word video script, so that I can review what will be spoken.
22. As a founder, I want a 9:16 MP4 with an ElevenLabs voiceover, kinetic captions, progress bar and my brand colours, so that I have native video without filming.
23. As a founder, I want to choose from preset voices, so that the voiceover fits my brand.
24. As a founder, I want a 120–180 word newsletter blurb with a subject line, so that the idea reaches my email list too.
25. As a founder, I want each asset to show its own status (queued / running / done / failed) and a retry button, so that one failed render doesn't block the pack.
26. As a founder, I want a "more like my voice", "punchier hook" and "shorter" action per asset, so that I can steer without prompting.
27. As a founder, I want a voice-fidelity score on each text asset, so that I trust it sounds like me.
28. As a founder, I want a side-by-side "generic vs. my voice" view, so that I (and judges) can see the difference.
29. As a founder, I want to copy any text asset to the clipboard in one tap, so that posting from my phone is trivial.
30. As a founder, I want to download the PDF and MP4 to my phone's native viewers/share sheet, so that I can post them to any network.
31. As a founder, I want to mark a pack as "posted", so that my library reflects reality.
32. As a founder, I want to see the approximate API cost of each pack, so that I stay within budget.
33. As a founder, I want a refresh or a closed tab never to lose an in-progress pack, so that mobile interruptions are harmless.

### Lead magnet & capture
34. As a founder, I want every pack to include a lead magnet (checklist, template, 5-step guide or scorecard) as a branded PDF, so that content always has a reason to convert.
35. As a founder, I want a hosted capture page at a short link with headline, three bullets and a form, so that I can put one link in my profile or comments.
36. As a founder, I want a comment-keyword CTA auto-written into the post ("Comment PLAYBOOK…"), so that the post drives engagement signals as well as leads.
37. As a visitor, I want the capture page to load fast and work on my phone, so that I can claim the magnet in seconds.
38. As a visitor, I want to give name and email (company/role optional) and tick a consent box, so that I know what I'm signing up for.
39. As a visitor, I want the magnet emailed to me and also available to download immediately, so that I get it even if email is slow.
40. As a visitor, I want the delivery email to have an unsubscribe link, so that I can opt out.
41. As a founder, I want captured leads listed with name, email, company, role, source pack, UTM and status (new / contacted / won), so that I can work them.
42. As a founder, I want to change a lead's status, so that I can track follow-up.
43. As a founder, I want a drafted two-line personalised follow-up per lead that references the magnet, so that I can send it by hand in seconds.
44. As a founder, I want to export leads as CSV, so that I can load them into my CRM.
45. As a founder, I want the capture page protected from spam (rate limit + honeypot), so that my list stays clean.
46. As a founder, I want UTM parameters passed through to the lead, so that I know which post produced it.
47. As a founder, I want capture-page views counted, so that I can see conversion rate per magnet.

### Library, calendar & learn loop
48. As a founder, I want a packs library filterable by pillar, format and status (draft / ready / posted / winner), so that I can find and reuse work.
49. As a founder, I want the calendar shown as a list on mobile and a month grid on desktop, so that it is usable on both.
50. As a founder, I want to mark a posted pack as a "winner", so that the app learns what works.
51. As a founder, I want three suggested repurposes of a winner (different format or angle) added to my calendar, so that winners keep compounding.

### Brand kit & settings
52. As a founder, I want to set my name, handle, headshot, logo, two colours and a font, so that carousels, videos, magnets and capture pages look like me.
53. As a founder, I want a usage meter of tokens/credits spent, so that I can see costs.
54. As a founder, I want my data isolated from other users, so that nobody else can read my strategy or leads.

### Mobile & platform
55. As a founder, I want the app to work at 390 px width with bottom tab navigation (Home · Create · Calendar · Leads · Settings), so that it is thumb-friendly.
56. As a founder, I want to install the app to my home screen (PWA), so that it feels native.
57. As a founder, I want skeleton states for assets still rendering, so that the UI never looks broken.
58. As a founder, I want the mic to work on iOS Safari and Android Chrome, so that onboarding works on any phone.
59. As a founder, I want clear, specific error states (rate-limited, content blocked, render failed, quota exceeded), so that I know whether to retry or change input.

## Implementation Decisions

**Stack.** TypeScript throughout. Next.js 15 App Router (PWA, Tailwind + shadcn, mobile-first). Supabase for Postgres, Auth (Google OAuth, magic-link fallback), Storage and row-level security. Inngest for durable jobs. A small Docker render worker on Fly/Railway for Remotion video rendering (Remotion Lambda deferred). Resend for magnet delivery email. PostHog for funnel events (onboard_complete, pack_generated, asset_exported, lead_captured).

**Effect v3 for the server core.** Effect 4 is still an RC, so pin the v3 line with `@effect/ai`, `@effect/ai-openai` and `@effect/platform`. Effect is used only server-side; React/Next UI and Remotion compositions stay plain TypeScript. The browser never talks to Supabase directly except for Auth session handling — all data access goes through server actions/route handlers into the Effect runtime. A single `ManagedRuntime` built from the application Layer is the entry point for server actions, route handlers and Inngest steps.

**Ports as Effect services.** Five ports, each a `Context.Tag` with a live Layer and a fake Layer:
- `LLMPort` — structured generation via `LanguageModel.generateObject` against OpenAI (`gpt-5.6-luna` default; `gpt-5.6-terra` for the final voice pass only); transcription; optional web search capped at 2 calls per strategy.
- `TTSPort` — ElevenLabs `eleven_flash_v2_5` with word timestamps; preset voices only.
- `RendererPort` — carousel PDF, magnet PDF (React-PDF), and video MP4 (Remotion, via the worker).
- `MailPort` — Resend.
- `PublisherPort` — declared, unimplemented (throws `NotImplemented`), so publishing can be added later without touching use-cases.
Non-Effect-provider APIs (ElevenLabs, Resend, fal) are thin `HttpClient` + `Schema`-decoded clients.

**Supabase as an Effect service** (pattern from typeonce.dev "Supabase service in Effect"). A `Supabase` `Context.Tag` whose Live Layer is built from `Config` (URL + `Redacted` key) and exposes `query(client => client.from(...)...)` that lifts any PostgREST response into `Effect<A, SupabaseError>` (a `Data.TaggedError` carrying the `PostgrestError`), plus the raw typed client for Storage and Auth-admin calls. Types come from `supabase gen types typescript` (a `db-types` script). Two Live variants: `Supabase.Service` (service-role key; used by Inngest steps, the render worker and the public capture path) and `Supabase.ForUser` (anon key + the caller's access token from the server session, so RLS is enforced for every user-initiated action). The `Db` service is a thin repository layer on top of `Supabase` (packs, assets, leads, jobs, usage…) that decodes rows through the same Effect Schemas used for prompts; use-cases depend on `Db`, never on `Supabase` directly, which is what keeps the in-memory `Db` fake possible in tests.

**Use-case services (the domain layer).** `VoiceProfileService` (transcript + optional posts → VoiceProfile), `StrategyService` (business + VoiceProfile → ICP, Pillars, Positioning, Calendar; per-section regenerate), `ContentPackService` (idea + pillar + goal + VoiceProfile + hook-library sample → all text assets, streaming; then enqueues media jobs), `VoicePassService` (draft + VoiceProfile → rewrite + fidelity score), `LeadCaptureService` (capture → store lead → deliver magnet → draft follow-up), `RepurposeService` (winner → 3 calendar items). These depend only on ports and a `Db` service.

**Schemas.** One Effect `Schema.Struct` per prompt output — VoiceProfile, Strategy, PackText (post variants, carousel slides, video script, newsletter, magnet outline, CTA keyword), VoicePassResult, FollowupDm. The same schema is the OpenAI strict JSON schema, the DB `content_json` validator and the test fixture generator. All fields required, no additional properties.

**Errors.** `Data.TaggedError` types in the error channel: `SupabaseError`, `RateLimited`, `ModerationBlocked`, `RenderFailed`, `QuotaExceeded`, `TranscriptionFailed`, `NotFound`, `Forbidden`. The UI maps each to a specific state and retry affordance.

**Retries and jobs.** Effect `Schedule` (exponential, 3 attempts, timeout) inside a single external call. Inngest owns durability across steps (text → carousel → TTS → video → magnet → notify) and never re-wraps Effect retries. Every asset is a `Job` row with status; the UI subscribes to job status so refresh never loses work.

**Cost meter.** A `Usage` service accumulates token/character/render counts per request via `Ref`, flushed to `UsageEvent` rows and summed per pack (`cost_cents`) and per user. Target < $0.30 per pack.

**Config.** All secrets via Effect `Config`, failing at boot if absent: OpenAI, ElevenLabs, Resend, Supabase service key, Inngest keys, PostHog key.

**Data model.** `User` · `BrandKit` · `VoiceProfile` · `Strategy` (icp, pillars, positioning) · `CalendarItem` (date, pillar, format, hook, funnel_stage, pack_id?) · `Pack` (idea, pillar, goal, status: draft|ready|posted|winner) · `Asset` (pack_id, type: post|carousel|video|newsletter|magnet, status, content_json, file_url, cost_cents) · `Magnet` (asset_id, slug, headline, bullets, view_count) · `Lead` (magnet_id, name, email, company?, role?, utm, status: new|contacted|won, followup_draft) · `Job` (type, ref_id, status, error, cost_cents) · `UsageEvent`. RLS on every user-owned table; `Magnet` read and `Lead` insert are the only public paths.

**Public capture route.** `/m/<slug>` is statically generated and revalidated; the submit handler is a route handler that runs `LeadCaptureService.capture` with rate limiting (per IP, per slug) and a honeypot field; returns a signed magnet URL and enqueues delivery email. Unsubscribe link tokens are stored on the lead.

**Content rules encoded in prompts.** LinkedIn formatting (≤3 lines/paragraph, first 210 chars hook, save/comment CTA, no external link in body), funnel mix 50/30/20, hook library of ≥300 patterns seeded as data and sampled into `pack_text` prompts, comment-keyword CTA generated with the magnet.

**Video pipeline.** Script → TTS with timestamps → Remotion composition (kinetic text, captions, progress bar, brand colours, 1080×1920) rendered by the worker → Storage. Fallback if the worker is unavailable: audiogram (audio + static captions) via ffmpeg in the worker.

**Mobile.** Bottom tabs, ≤390 px layouts, PWA manifest, MediaRecorder with text fallback, native share/download for files, skeletons for async assets, no horizontal scroll.

**Emergent credits.** Not a runtime dependency (no public API); may be used to scaffold UI only.

## Testing Decisions

**What makes a good test here:** call a use-case service through the Effect runtime with fake port Layers and assert on observable outputs — returned values, rows written through the `Db` service, jobs enqueued, emails sent to the fake `MailPort` — never on prompt strings or internal call order.

**The seam (one):** the use-case services (`VoiceProfileService`, `StrategyService`, `ContentPackService`, `VoicePassService`, `LeadCaptureService`, `RepurposeService`) with `Layer` fakes for `LLMPort`, `TTSPort`, `RendererPort`, `MailPort` and an in-memory `Db`. Fake `LLMPort` returns schema-valid fixtures generated from the same Effect Schemas, and can be scripted to fail with `RateLimited`/`ModerationBlocked` to test error propagation and retries.

**One HTTP-level test:** the capture route (`/m/<slug>` submit) — valid submit creates a lead and enqueues delivery; honeypot-filled and over-rate-limit submits are rejected; missing consent is rejected.

**Schema tests:** every prompt schema round-trips (`decode(encode(x)) == x`) and produces a strict OpenAI JSON schema (all required, no additional properties).

**Not tested:** Remotion visual output, React components (beyond a smoke render of the mobile shell), real API calls. Media renders are verified manually on days 4–5.

**Prior art:** none — greenfield repo. Establish the pattern with the first `ContentPackService` test.

## Out of Scope

- Publishing or scheduling to LinkedIn, X, YouTube, Instagram, or via aggregators (`PublisherPort` stays unimplemented).
- Scraping or enriching post engagers, auto-DMs, engagement pods, browser extensions.
- Voice cloning (preset ElevenLabs voices only).
- AI-avatar / talking-head video and gen-AI b-roll.
- Teams, agencies, white-label, billing, multi-workspace.
- Platform analytics (only hosted capture-page views and leads are tracked).
- Remotion Lambda.

## Further Notes

- Sora 2 API shuts down 2026-09-24; do not introduce it. `gpt-image-*` requires org verification — carousels are vector PDFs and images are optional.
- Suggested build order (7 days): shell + auth + schemas → interview + strategy → pack text + voice pass + export → carousel/magnet PDF + capture + leads → video worker → calendar/winner loop + PostHog + cost meter → mobile QA + demo seed.
- Cut order if behind: newsletter blurb → repurpose loop → video (keep script + audio) → carousel images.
- Demo target: idea → full pack in < 3 min on a phone, one lead captured live.
