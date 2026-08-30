# Research Digest — B2B UGC Organic Content + Lead Acquisition (2026-08-30)

Compiled from three parallel research threads (hackathon, API landscape, product space). Facts marked *(unverified)* came from third-party or conflicting sources.

## 1. 8x.social and the hackathon

- **8x.social** is a managed creator network + self-serve marketplace: brands get organic views via creators posting from their *own* accounts, no ad spend. Positioning: "It feels organic because it is." Their published operating loop: brief → many creators/accounts → daily QA → track hooks/formats → rotate creators → recycle winners. Quality rules from their blog: "Hook on a feeling, not a feature", "One product per post", test hooks per market, turn winners into reusable assets. (https://www.8x.social/en, /en/for-brands, /en/blog/ai-personal-finance-app-ugc-creators)
- Their hackathons (London 13 Jun, Ljubljana 18 Jul, Berlin 1 Aug 2026) are one-day events, teams of 1–3, "use whatever tools you want", tracks announced on the morning, submission form → live demos → finals. Partners seen: OpenAI credits, ElevenLabs, bilt.me, PostHog. **Judging criteria are not published.** Past winners were demo-heavy consumer AI apps (Plato, Hue Are You, Story Snap). No page mentions Emergent or a B2B track — confirm theme/deadline from your event link.
- **Emergent (emergent.sh)** is an AI app-builder ("vibe-coding"), not an LLM gateway. Its Universal Key (`EMERGENT_LLM_KEY`) only works via the private Python lib `emergentintegrations` inside Emergent-built apps; text + image only, no audio/video, no public HTTP API or Node SDK. → Spend those credits only to scaffold/deploy inside Emergent; do not make the runtime depend on it.

## 2. API landscape (what we can actually build on)

| Need | Pick | Model / detail | Cost |
|---|---|---|---|
| Strategy + copy | OpenAI Responses API | `gpt-5.6-luna` (cheap, structured outputs) / `gpt-5.6-terra` for final voice-critical copy | $0.20–2 in, $1.2–12 out per 1M tok |
| Structured JSON | Responses `text.format = json_schema strict` | all fields required, `additionalProperties:false` | — |
| Research on ICP/topic | Responses `web_search` tool | `search_context_size` low | $10 / 1K calls |
| Images (carousel slides, thumbnails) | `gpt-image-1-mini` (or `gpt-image-2`) | org verification required; `gpt-image-1` retires 2026-12-01 | ~$0.005–0.05 / image *(unverified)* |
| Voiceover | ElevenLabs `eleven_flash_v2_5` (cheap) / `eleven_v3` (expressive, 5K char cap) | Node SDK `@elevenlabs/elevenlabs-js` → `client.textToSpeech.convert(voiceId,{text,modelId,outputFormat})` | $0.05–0.10 / 1K chars |
| Voice clone | ElevenLabs instant clone | Starter+ plan | — |
| Video | **Remotion** (React → MP4, free ≤3 employees) — kinetic-text/stat-card video over TTS | render server-side (Remotion Lambda or a worker) | ~$0 |
| Gen-AI b-roll (stretch) | fal `fal-ai/wan/v2.2-5b/text-to-video` or `fal-ai/ltx-2/...` | 5s 720p, 1–3 min latency | $0.15–0.30 / clip |
| **Sora 2** | **Do NOT use** | `sora-2` / `sora-2-pro` shut down **2026-09-24**, no replacement | — |
| Free LLM fallback | Groq `openai/gpt-oss-120b` | 30 RPM / 1K RPD | free |
| Transactional email (lead magnet delivery) | Resend | free tier 3K/mo | free |

## 3. Publishing APIs (why we chose channel-agnostic export)

| Platform | Reality |
|---|---|
| LinkedIn member posts | Self-serve `w_member_social`, `POST /rest/posts`, own feed only; 60-day tokens, no refresh; 150 req/member/day. Feasible but adds OAuth + media upload + app setup to a 1-week solo build. |
| LinkedIn org pages | Community Management API review: legal org, super-admin verification, screencast. Skip. |
| X | Pay-per-use: $0.015/post, $0.20/post with URL. No free tier. |
| YouTube | Unaudited apps → uploads forced private. |
| Instagram | Business account, public media URL, App Review for other users. |
| Aggregators | Ayrshare $149/mo; Late free 2 profiles/10 posts; **Postiz** open-source AGPL self-host (still needs platform app creds). |

Decision: MVP exports copy-ready text, PDF carousels, MP4 video, and a hosted lead-magnet page. Publishing integration (LinkedIn self-serve or Postiz) is a post-hackathon module behind a clean `Publisher` port.

## 4. Product space

- "UGC-style" in B2B = person-first content: founder-led posts, employee-generated content, customer-story clips. Personal profiles out-reach company pages 5–10x on LinkedIn. AI-avatar UGC (Arcads/Creatify/HeyGen) is a paid-ads DTC motion, thin in B2B.
- Format signal on LinkedIn 2026: PDF carousels and framework posts lead (dwell + swipes); captioned native video <90s ≈ +112% reach; well-formatted text +78%; **saves weigh ~5x a like**. CTAs should ask for saves/comments over links.
- Competitors: Taplio ($39–199, only one with a lead side, no video), AuthoredUp ($20, best editor, no AI strategy), Supergrow ($12–19, AI interview → posts), Kleo ($99, voice memory), Scripe (interview → posts, ~$2.5M ARR bootstrapped), Lately (repurposing), Jasper/Copy.ai (copy only), Arcads/Creatify/HeyGen (DTC ads), Waalaxy/Lemlist (outreach only), Clay (engager → enrich → outreach; needs a RevOps builder).
- **Gap:** nobody unifies strategy → voice-true content → multi-format assets → lead capture in one lightweight product. Taplio+Lemlist or Clay stacks are the workaround.
- Content → leads mechanics: comment-keyword lead magnets (deliver in <30s), hook–value–CTA structure, 3–5 pillars mapped to ICP pains, UTM'd capture pages, warm outreach referencing the engagement.
- **ToS line:** LinkedIn bans bots/extensions that scrape, automate actions, or send messages; engagement pods are being dismantled in 2026; extension users see ~23% restriction rate. Safe: official API publishing, human-initiated posting, drafted DMs for human send, hosted lead-magnet pages, user-pasted engager lists.
- Strategy frameworks: pillars × angles content matrix (Justin Welsh), 30-day calendar fields (date, pillar, format, topic, status), hook libraries of 300+, repurpose one long-form source into ~10 pieces (Lara Acosta model).
- Signals: YC "AI Growth Hackathon" (2026) rewards GTM/growth builds; LinkedIn ghostwriting market ~3x since 2024.
