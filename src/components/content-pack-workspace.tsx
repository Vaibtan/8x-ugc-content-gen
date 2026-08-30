"use client";

import {
  Check,
  Clipboard,
  LoaderCircle,
  RefreshCw,
  Send,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { assetContentAsText } from "@/lib/content-pack/asset-content";
import type {
  AssetRow,
  AssetVersion,
  JobRow,
  PackRow,
} from "@/lib/db/service";

type PackSnapshot = Readonly<{
  pack: PackRow;
  assets: ReadonlyArray<AssetRow>;
  jobs: ReadonlyArray<JobRow>;
  assetVersions: Readonly<Record<string, ReadonlyArray<AssetVersion>>>;
}>;

const PENDING_PACK_ID = "founder-voice.pending-pack-id";
const PENDING_REQUEST_KEY = "founder-voice.pending-pack-request-key";

const money = (cents: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(cents / 100);

const contentFor = (asset: AssetRow) => assetContentAsText(asset.content);

const statusClass = (status: string) =>
  status === "done" || status === "ready" || status === "posted"
    ? "bg-emerald-100 text-emerald-800"
    : status === "failed"
      ? "bg-red-100 text-red-800"
      : "bg-amber-100 text-amber-800";

export function ContentPackWorkspace({
  initialPacks,
  canGenerate,
}: Readonly<{ initialPacks: ReadonlyArray<PackRow>; canGenerate: boolean }>) {
  const [packs, setPacks] = useState(initialPacks);
  const [snapshot, setSnapshot] = useState<PackSnapshot | null>(null);
  const [idea, setIdea] = useState("");
  const [pillar, setPillar] = useState("Founder-led distribution");
  const [goal, setGoal] = useState<"reach" | "leads">("leads");
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [steeringAssetId, setSteeringAssetId] = useState<string | null>(null);
  const [streamedText, setStreamedText] = useState<
    Partial<Record<"post" | "newsletter" | "carousel" | "video" | "magnet", string>>
  >({});

  const loadPack = useCallback(async (packId: string) => {
    const response = await fetch(`/api/packs/${packId}`, { cache: "no-store" });
    if (!response.ok) throw new Error("Could not load this pack.");
    const next = (await response.json()) as PackSnapshot;
    setSnapshot(next);
    setPacks((current) => {
      const remaining = current.filter((pack) => pack.id !== next.pack.id);
      return [next.pack, ...remaining];
    });
    if (next.pack.status !== "draft") {
      localStorage.removeItem(PENDING_PACK_ID);
      localStorage.removeItem(PENDING_REQUEST_KEY);
    }
    return next;
  }, []);

  useEffect(() => {
    const pending = localStorage.getItem(PENDING_PACK_ID);
    if (pending) {
      void loadPack(pending).catch(() => {
        // The id is retained until a real response confirms whether work ended.
      });
    }
  }, [loadPack]);

  useEffect(() => {
    const active =
      snapshot?.pack.status === "draft" ||
      snapshot?.jobs.some(
        (job) =>
          job.type === "generate-pack-text" &&
          job.status !== "done" &&
          job.status !== "failed",
      );
    if (!active || !snapshot) return;
    const timer = window.setInterval(() => {
      void loadPack(snapshot.pack.id).catch(() => undefined);
    }, 1500);
    return () => window.clearInterval(timer);
  }, [loadPack, snapshot]);

  const selectedPackId = snapshot?.pack.id ?? packs[0]?.id ?? null;

  useEffect(() => {
    if (!snapshot && selectedPackId) {
      void loadPack(selectedPackId).catch(() => undefined);
    }
  }, [loadPack, selectedPackId, snapshot]);

  const textAssets = useMemo(() => snapshot?.assets ?? [], [snapshot]);
  const mediaAssets = useMemo(
    () =>
      snapshot?.assets.filter(
        (asset) => asset.type !== "post" && asset.type !== "newsletter",
      ) ?? [],
    [snapshot],
  );

  const generate = async () => {
    if (!idea.trim()) {
      setMessage("Give the pack one concrete idea first.");
      return;
    }
    if (!canGenerate) {
      setMessage(
        "Finish the voice interview first so this pack has a founder voice to use.",
      );
      return;
    }
    setGenerating(true);
    setMessage(null);
    const idempotencyKey =
      localStorage.getItem(PENDING_REQUEST_KEY) ?? crypto.randomUUID();
    localStorage.setItem(PENDING_REQUEST_KEY, idempotencyKey);
    try {
      const response = await fetch("/api/packs/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea, pillar, goal, idempotencyKey }),
      });
      if (!response.ok || response.body === null) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? "Could not start pack generation.");
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const entries = buffer.split("\n\n");
        buffer = entries.pop() ?? "";
        for (const entry of entries) {
          const dataLine = entry
            .split("\n")
            .find((line) => line.startsWith("data: "));
          if (!dataLine) continue;
          const event = JSON.parse(dataLine.slice(6)) as
            | {
                type: "pack-created" | "pack-ready";
                pack: PackRow;
                assets?: AssetRow[];
                jobs?: JobRow[];
              }
            | { type: "pack-generating" | "pack-queued"; packId: string }
            | {
                type: "pack-text-chunk";
                packId: string;
                asset: "post" | "newsletter" | "carousel" | "video" | "magnet";
                delta: string;
              }
            | { type: "pack-failed"; message: string };
          if (event.type === "pack-created") {
            localStorage.setItem(PENDING_PACK_ID, event.pack.id);
            setSnapshot({
              pack: event.pack,
              assets: [],
              jobs: [],
              assetVersions: {},
            });
          }
          if (
            event.type === "pack-generating" ||
            event.type === "pack-queued"
          ) {
            setMessage(
              event.type === "pack-queued"
                ? "Pack queued safely. It will reconnect here as soon as the text is ready."
                : "Writing your text pack now…",
            );
          }
          if (event.type === "pack-text-chunk") {
            setStreamedText((current) => ({
              ...current,
              [event.asset]: `${current[event.asset] ?? ""}${event.delta}`,
            }));
          }
          if (event.type === "pack-ready") {
            await loadPack(event.pack.id);
            setIdea("");
            setStreamedText({});
            setMessage(
              "Text pack ready. Media assets continue independently below.",
            );
          }
          if (event.type === "pack-failed") throw new Error(event.message);
        }
      }
    } catch (cause) {
      setMessage(
        cause instanceof Error
          ? cause.message
          : "Could not generate this pack.",
      );
    } finally {
      setGenerating(false);
    }
  };

  const copy = async (asset: AssetRow, content = contentFor(asset)) => {
    await navigator.clipboard.writeText(content);
    setCopied(asset.id);
    window.setTimeout(() => setCopied(null), 1500);
  };

  const markPosted = async () => {
    if (!snapshot) return;
    const response = await fetch(`/api/packs/${snapshot.pack.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark-posted" }),
    });
    if (response.ok) await loadPack(snapshot.pack.id);
  };

  const retry = async (asset: AssetRow) => {
    if (!snapshot) return;
    const response = await fetch(`/api/packs/${snapshot.pack.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "retry", assetId: asset.id }),
    });
    if (response.ok) await loadPack(snapshot.pack.id);
  };

  const steer = async (
    asset: AssetRow,
    action: "more-like-my-voice" | "punchier-hook" | "shorter",
  ) => {
    if (!snapshot) return;
    setSteeringAssetId(asset.id);
    setMessage(null);
    try {
      const response = await fetch(`/api/packs/${snapshot.pack.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, assetId: asset.id }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? "Could not rewrite this asset.");
      }
      await loadPack(snapshot.pack.id);
      setMessage("New voice version saved. Your earlier versions are still here.");
    } catch (cause) {
      setMessage(
        cause instanceof Error ? cause.message : "Could not rewrite this asset.",
      );
    } finally {
      setSteeringAssetId(null);
    }
  };

  return (
    <div className="space-y-6 pb-6">
      <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--accent)]">
          Create a content pack
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.045em]">
          One useful idea, everywhere it can work.
        </h1>
        <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
          Text arrives first. Your carousel, video, and magnet keep their own
          durable job states.
        </p>
        <div className="mt-5 space-y-3">
          <label className="block text-sm font-bold" htmlFor="pack-idea">
            What do you want to say?
          </label>
          <textarea
            id="pack-idea"
            value={idea}
            onChange={(event) => setIdea(event.target.value)}
            maxLength={4000}
            placeholder="A lesson, customer pattern, contrarian belief, or a fresh idea from today…"
            className="min-h-28 w-full resize-y rounded-xl border border-[var(--border)] bg-transparent px-3 py-3 text-sm outline-none ring-[var(--accent)] focus:ring-2"
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-sm font-bold">
              Pillar
              <Input
                value={pillar}
                onChange={(event) => setPillar(event.target.value)}
                maxLength={160}
                className="mt-1"
              />
            </label>
            <label className="text-sm font-bold">
              Goal
              <select
                value={goal}
                onChange={(event) =>
                  setGoal(event.target.value as "reach" | "leads")
                }
                className="mt-1 h-10 w-full rounded-xl border border-[var(--border)] bg-transparent px-3 text-sm"
              >
                <option value="leads">Generate leads</option>
                <option value="reach">Build reach</option>
              </select>
            </label>
          </div>
          <Button
            className="w-full"
            disabled={generating}
            onClick={generate}
            type="button"
          >
            {generating ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <Sparkles />
            )}
            {generating ? "Building your pack" : "Generate content pack"}
          </Button>
          {message ? (
            <p
              aria-live="polite"
              className="text-sm text-[var(--muted-foreground)]"
            >
              {message}
            </p>
          ) : null}
        </div>
      </section>

      {snapshot ? (
        <section className="space-y-4" aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                Your pack
              </p>
              <h2 className="text-xl font-black">{snapshot.pack.idea}</h2>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${statusClass(snapshot.pack.status)}`}
            >
              {snapshot.pack.status}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-2xl bg-[var(--muted)] px-4 py-3 text-sm">
            <span>Approximate text-generation cost</span>
            <strong>{money(snapshot.pack.costCents)}</strong>
          </div>
          <div className="space-y-3">
            {Object.entries(streamedText).map(([asset, text]) => (
              <article
                className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4"
                key={asset}
              >
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                  Streaming {asset}
                </p>
                <pre className="mt-3 whitespace-pre-wrap text-sm leading-6 font-sans">
                  {text}
                </pre>
              </article>
            ))}
            {textAssets.map((asset) => {
              const versions = snapshot.assetVersions[asset.id] ?? [];
              const generic = versions.find(
                (version) => version.action === "generic",
              );
              const voice = versions.at(-1);
              const visibleText = voice?.content ?? contentFor(asset);
              return (
                <article
                  className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4"
                  key={asset.id}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-black capitalize">{asset.type}</h3>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-bold ${statusClass(asset.status)}`}
                    >
                      {asset.status}
                    </span>
                  </div>
                  {voice?.fidelityScore !== null &&
                  voice?.fidelityScore !== undefined ? (
                    <div className="mt-3 flex items-center justify-between rounded-xl bg-[var(--muted)] px-3 py-2 text-sm">
                      <span className="font-bold">Voice fidelity</span>
                      <strong>{voice.fidelityScore}/100</strong>
                    </div>
                  ) : null}
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <section className="min-w-0 rounded-xl border border-[var(--border)] p-2">
                      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
                        Generic draft
                      </p>
                      <pre className="mt-2 max-h-52 overflow-y-auto whitespace-pre-wrap break-words text-xs leading-5 font-sans">
                        {generic?.content ?? contentFor(asset)}
                      </pre>
                    </section>
                    <section className="min-w-0 rounded-xl border border-[var(--accent)] bg-[var(--muted)] p-2">
                      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--accent)]">
                        My voice
                      </p>
                      <pre className="mt-2 max-h-52 overflow-y-auto whitespace-pre-wrap break-words text-xs leading-5 font-sans">
                        {visibleText}
                      </pre>
                    </section>
                  </div>
                  {voice && voice.diffNotes.length > 0 ? (
                    <p className="mt-3 text-xs leading-5 text-[var(--muted-foreground)]">
                      {voice.diffNotes.join(" ")}
                    </p>
                  ) : null}
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <Button
                      onClick={() => void copy(asset, visibleText)}
                      type="button"
                      variant="outline"
                    >
                      {copied === asset.id ? <Check /> : <Clipboard />}
                      {copied === asset.id ? "Copied" : "Copy text"}
                    </Button>
                    <div className="grid grid-cols-3 gap-1">
                      <Button
                        aria-label={`Make ${asset.type} more like my voice`}
                        disabled={steeringAssetId === asset.id}
                        onClick={() => void steer(asset, "more-like-my-voice")}
                        type="button"
                        variant="outline"
                      >
                        Voice
                      </Button>
                      <Button
                        aria-label={`Give ${asset.type} a punchier hook`}
                        disabled={steeringAssetId === asset.id}
                        onClick={() => void steer(asset, "punchier-hook")}
                        type="button"
                        variant="outline"
                      >
                        Hook
                      </Button>
                      <Button
                        aria-label={`Make ${asset.type} shorter`}
                        disabled={steeringAssetId === asset.id}
                        onClick={() => void steer(asset, "shorter")}
                        type="button"
                        variant="outline"
                      >
                        Shorter
                      </Button>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-[var(--muted-foreground)]">
                    {versions.length} saved version{versions.length === 1 ? "" : "s"}
                  </p>
                </article>
              );
            })}
          </div>
          <div className="space-y-3">
            <h3 className="text-lg font-black">Media jobs</h3>
            {mediaAssets.map((asset) => (
              <article
                className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4"
                key={asset.id}
              >
                <div>
                  <p className="font-bold capitalize">{asset.type}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {asset.error ??
                      (asset.status === "queued"
                        ? "Queued independently. You can leave and come back."
                        : "Render state is durable.")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-bold ${statusClass(asset.status)}`}
                  >
                    {asset.status}
                  </span>
                  <Button
                    aria-label={`Copy ${asset.type} text`}
                    onClick={() => void copy(asset)}
                    type="button"
                    variant="outline"
                  >
                    {copied === asset.id ? <Check /> : <Clipboard />}
                    Copy
                  </Button>
                  {asset.status === "failed" ? (
                    <Button
                      onClick={() => void retry(asset)}
                      type="button"
                      variant="outline"
                    >
                      <RefreshCw />
                      Retry
                    </Button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
          {snapshot.pack.status !== "posted" ? (
            <Button
              className="w-full"
              onClick={() => void markPosted()}
              type="button"
              variant="outline"
            >
              <Send />
              Mark as posted
            </Button>
          ) : null}
        </section>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black">Pack library</h2>
          <span className="text-xs text-[var(--muted-foreground)]">
            {packs.length} saved
          </span>
        </div>
        {packs.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[var(--border)] p-4 text-sm text-[var(--muted-foreground)]">
            Your generated packs will stay here, including work that was still
            running when you left.
          </p>
        ) : (
          packs.map((pack) => (
            <button
              className="flex w-full items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 text-left"
              key={pack.id}
              onClick={() => void loadPack(pack.id)}
              type="button"
            >
              <span className="min-w-0">
                <span className="block truncate font-bold">{pack.idea}</span>
                <span className="text-xs text-[var(--muted-foreground)]">
                  {pack.pillar} · {money(pack.costCents)}
                </span>
              </span>
              <span
                className={`shrink-0 rounded-full px-2 py-1 text-xs font-bold ${statusClass(pack.status)}`}
              >
                {pack.status}
              </span>
            </button>
          ))
        )}
      </section>
    </div>
  );
}
