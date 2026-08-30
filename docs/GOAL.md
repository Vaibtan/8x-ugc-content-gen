# /goal — Implement the Founder Voice MVP end to end

Copy everything below the line into a fresh session.

---

Implement spec **#1 "Founder Voice MVP — strategy → voice-true content packs → lead capture"** end to end by running the **`/implement-spec`** skill against it. The spec's eleven child tickets (#2, #3, #5–#13) are a task graph with native GitHub blocked-by edges; work the frontier (currently only #2), fan out implementer subagents whenever the frontier widens, and merge everything into one PR that closes #1 and its tickets. Do not use `/wayfinder` — this effort is already planned; wayfinder is for charting decisions, not executing tickets.

## Read first (context pointers, do not duplicate)

- `docs/SPEC.md` (mirror of issue #1) — the source of truth for behaviour, implementation decisions, and the test seam.
- `docs/PRD.md` §8 — architecture, Effect concern table, model choices, 7-day build order and cut order.
- `docs/RESEARCH.md` — API facts (model IDs, prices, limits, deprecations). Trust it over training data.
- `AGENTS.md` / `docs/agents/*` — issue-tracker conventions and triage labels.
- Each ticket's body — "What to build" and acceptance criteria are the definition of done per ticket.

## Non-negotiable decisions (already made; do not re-litigate)

- TypeScript everywhere. **Effect v3** (not the v4 RC) for the server core: `effect`, `@effect/platform`, `@effect/ai`, `@effect/ai-openai`, pinned. One `ManagedRuntime` from the application Layer; server actions, route handlers and Inngest steps call `runtime.runPromise`.
- Ports as `Context.Tag` services with Live + fake Layers: `LLMPort`, `TTSPort`, `RendererPort`, `MailPort`, `PublisherPort` (declared, unimplemented). `Supabase` as an Effect service per the typeonce.dev pattern (Config-built Layer, `query(client => …)` → `Effect<A, SupabaseError>`, generated `Database` types, service-role and per-user RLS variants). `Db` repository service on top; use-cases depend on `Db`, never on `Supabase`.
- One Effect `Schema.Struct` per prompt output (VoiceProfile, Strategy, PackText, VoicePassResult, FollowupDm); all fields required, no additional properties; the same schema is the OpenAI strict JSON schema, the DB validator, and the test fixture generator.
- Models: OpenAI `gpt-5.6-luna` default, `gpt-5.6-terra` for the voice pass only, `gpt-4o-mini-transcribe` for audio. ElevenLabs `eleven_flash_v2_5`, preset voices only. Remotion for video via a Docker render worker. **Never** use Sora 2 (shut down 2026-09-24), Emergent's key, LinkedIn/X/YouTube/Instagram APIs, scraping, or auto-DMs.
- Stack: Next.js 15 App Router, Tailwind + shadcn, PWA, Supabase (Postgres/Auth/Storage/RLS, Google OAuth with magic-link fallback), Inngest, Resend, PostHog, Vitest.
- Mobile first: every screen works at 390 px with bottom-tab navigation; no horizontal scroll; mic recording has a text fallback.
- Cost target < $0.30 per pack; `Usage` service meters every external call.

## Testing contract

Test at exactly one seam: the use-case services run through the Effect runtime against fake port Layers and an in-memory `Db`. One HTTP-level test for the public capture route. Schema round-trip tests for every prompt schema. No tests of prompt strings, React internals, or Remotion pixels. Assert on outputs, rows, enqueued jobs, and sent mail. Every ticket's tests must be green before its branch is merged.

## Human-in-the-loop items — do not block on them

Some steps need accounts or secrets only the owner can provide: Supabase project + Google OAuth client, OpenAI / ElevenLabs / Resend / Inngest / PostHog keys, Fly or Railway for the render worker, Vercel for the app. Handle them like this:

1. Read all secrets through Effect `Config`; commit a complete `.env.example`; never commit real values.
2. Keep building against fake Layers and local Supabase (`supabase start`) where possible.
3. For anything the owner must click through, use the `/wizard` skill to generate a single bash wizard (`scripts/setup-wizard.sh`) that walks them through every dashboard step once, and note in the PR description which acceptance criteria are waiting on it (e.g. real Google sign-in on a phone, real video render on the worker).
4. Do not pause the whole effort waiting for a key; the frontier is wide enough to keep working.

## Working rules

- Branch from `main`; open a draft PR early titled "Founder Voice MVP (closes #1)" with `Closes #2 … Closes #13` in the body.
- One implementer subagent per ticket in its own worktree; merge with a merger subagent; re-evaluate the frontier after every merge.
- Commit messages reference the ticket (`#7: stream pack text…`). Keep CI (typecheck + tests) green on the PR branch after every merge.
- Follow the ticket order of the build plan when the frontier offers a choice: shell → interview → pack text → PDFs/capture → video → calendar loop → polish.
- If a ticket turns out to be infeasible as written, do everything else in it, leave a comment on the issue stating exactly what was cut and why, and continue. Cut order if time runs short: newsletter blurb → repurpose loop → video (keep script + audio) → carousel images.
- When all tickets are merged: run `/code-review` on the PR branch, fix everything raised in one implementer subagent, mark the PR ready, clean up worktrees, and post a final summary on issue #1 listing what is demo-able, what awaits owner-provided secrets, and the measured cost per pack.

## Definition of done

A reviewer can check out the PR, run the setup wizard, and on a phone: sign in with Google → answer the interview by voice → see a strategy and calendar → generate a pack → copy the post, download the carousel and video, open the capture page and submit a lead → see the lead and follow-up draft in the Leads tab → export CSV. All ticket acceptance criteria checked, or explicitly listed as waiting on a human step.
