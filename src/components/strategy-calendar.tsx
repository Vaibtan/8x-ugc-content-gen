"use client";

import { LoaderCircle, RefreshCw, Search, Sparkles } from "lucide-react";
import { useMemo, useState, useTransition } from "react";

import {
  generateStrategyAction,
  regenerateStrategySectionAction,
  saveStrategyAction,
} from "@/app/app/calendar/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type CalendarItem,
  type ContentPillar,
  type Strategy,
  type StrategySection,
} from "@/lib/strategy/schema";

type StrategyCalendarProps = Readonly<{
  hasVoiceProfile: boolean;
  initialStrategy: Strategy | null;
}>;

const splitLines = (value: string) =>
  value
    .split("\n")
    .map((part) => part.trim())
    .filter(Boolean);

const joinLines = (value: ReadonlyArray<string>) => value.join("\n");

const formatLabel = (format: CalendarItem["format"]) =>
  ({
    text_post: "Text post",
    carousel: "Carousel",
    video: "Video",
    newsletter: "Newsletter",
  })[format];

export function StrategyCalendar({
  hasVoiceProfile,
  initialStrategy,
}: StrategyCalendarProps) {
  const [strategy, setStrategy] = useState<Strategy | null>(initialStrategy);
  const [useWebSearch, setUseWebSearch] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const apply = (result: Awaited<ReturnType<typeof saveStrategyAction>>) => {
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setStrategy(result.value);
    setMessage("Saved. Your calendar is ready when you are.");
  };

  const generate = () => {
    startTransition(async () => {
      setMessage(null);
      apply(await generateStrategyAction(useWebSearch));
    });
  };

  const regenerate = (section: StrategySection) => {
    startTransition(async () => {
      setMessage(null);
      const result = await regenerateStrategySectionAction(
        section,
        useWebSearch,
      );
      apply(result);
    });
  };

  const save = () => {
    if (strategy === null) return;
    startTransition(async () => {
      setMessage(null);
      apply(await saveStrategyAction(strategy));
    });
  };

  if (!hasVoiceProfile) {
    return (
      <section className="mt-7 rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm">
        <h2 className="text-lg font-bold">Start with your voice interview</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
          Your answers give the strategy a real business context and keep its
          language aligned with your voice.
        </p>
        <a
          className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-[var(--primary)] px-4 text-sm font-bold text-[var(--primary-foreground)]"
          href="/app"
        >
          Complete interview
        </a>
      </section>
    );
  }

  if (strategy === null) {
    return (
      <section className="mt-7 rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--muted)] text-[var(--accent)]">
          <Sparkles aria-hidden="true" size={22} />
        </span>
        <h2 className="mt-5 text-xl font-black tracking-[-0.03em]">
          Build your 30-day plan
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
          Get an ICP, three to five pillars, a positioning line, and a precise
          15 / 9 / 6 funnel mix across 30 ideas.
        </p>
        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl bg-[var(--muted)] p-4 text-sm leading-5">
          <input
            checked={useWebSearch}
            className="mt-0.5 h-4 w-4 accent-[var(--primary)]"
            onChange={(event) => setUseWebSearch(event.target.checked)}
            type="checkbox"
          />
          <span>
            <span className="flex items-center gap-1 font-bold">
              <Search aria-hidden="true" size={15} /> Add current niche research
            </span>
            <span className="mt-1 block text-[var(--muted-foreground)]">
              Uses at most two web searches to capture current buyer language.
            </span>
          </span>
        </label>
        {message ? <Message text={message} /> : null}
        <Button
          className="mt-5 w-full"
          disabled={isPending}
          onClick={generate}
          type="button"
        >
          {isPending ? (
            <LoaderCircle
              aria-hidden="true"
              className="animate-spin"
              size={18}
            />
          ) : (
            <Sparkles aria-hidden="true" size={18} />
          )}
          {isPending ? "Building your plan…" : "Generate strategy"}
        </Button>
      </section>
    );
  }

  return (
    <form
      className="mt-7 space-y-6 pb-5"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm leading-6 text-[var(--muted-foreground)]">
          Edit any field, then save. Regenerating a section leaves the rest of
          your plan intact.
        </p>
        <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-[var(--muted-foreground)]">
          <input
            checked={useWebSearch}
            className="h-4 w-4 accent-[var(--primary)]"
            onChange={(event) => setUseWebSearch(event.target.checked)}
            type="checkbox"
          />
          Use up to 2 searches
        </label>
      </div>

      <StrategySectionCard
        description="Who the plan is for and why they will care."
        onRegenerate={() => regenerate("icp")}
        pending={isPending}
        title="Ideal customer"
      >
        <label className="grid gap-2 text-sm font-semibold">
          Who
          <textarea
            className="min-h-20 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-base font-normal leading-6 outline-none focus:border-[var(--ring)] focus:ring-2 focus:ring-[color:var(--ring)]/20"
            onChange={(event) =>
              setStrategy((current) =>
                current === null
                  ? current
                  : {
                      ...current,
                      icp: { ...current.icp, who: event.target.value },
                    },
              )
            }
            value={strategy.icp.who}
          />
        </label>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <LineList
            label="Pains"
            onChange={(pains) =>
              setStrategy((current) =>
                current === null
                  ? current
                  : { ...current, icp: { ...current.icp, pains } },
              )
            }
            value={strategy.icp.pains}
          />
          <LineList
            label="Buying triggers"
            onChange={(buyingTriggers) =>
              setStrategy((current) =>
                current === null
                  ? current
                  : { ...current, icp: { ...current.icp, buyingTriggers } },
              )
            }
            value={strategy.icp.buyingTriggers}
          />
          <LineList
            label="Objections"
            onChange={(objections) =>
              setStrategy((current) =>
                current === null
                  ? current
                  : { ...current, icp: { ...current.icp, objections } },
              )
            }
            value={strategy.icp.objections}
          />
        </div>
      </StrategySectionCard>

      <StrategySectionCard
        description="The one line that should make your bio and CTAs feel coherent."
        onRegenerate={() => regenerate("positioning")}
        pending={isPending}
        title="Positioning"
      >
        <Input
          aria-label="Positioning statement"
          maxLength={280}
          onChange={(event) =>
            setStrategy((current) =>
              current === null
                ? current
                : { ...current, positioning: event.target.value },
            )
          }
          value={strategy.positioning}
        />
      </StrategySectionCard>

      <StrategySectionCard
        description="Reusable points of view, each with angles that make choosing an idea easy."
        onRegenerate={() => regenerate("pillars")}
        pending={isPending}
        title="Content pillars"
      >
        <div className="grid gap-4 lg:grid-cols-3">
          {strategy.pillars.map((pillar, index) => (
            <PillarEditor
              index={index}
              key={pillar.id}
              onChange={(next) =>
                setStrategy((current) => {
                  if (current === null) return current;
                  const pillars = [...current.pillars];
                  pillars[index] = next;
                  return { ...current, pillars };
                })
              }
              pillar={pillar}
            />
          ))}
        </div>
      </StrategySectionCard>

      <StrategySectionCard
        description="Thirty slots, exactly balanced as 15 TOFU, 9 MOFU, and 6 BOFU ideas."
        onRegenerate={() => regenerate("calendar")}
        pending={isPending}
        title="30-day calendar"
      >
        <CalendarEditor
          onChange={(calendar) =>
            setStrategy((current) =>
              current === null ? current : { ...current, calendar },
            )
          }
          pillars={strategy.pillars}
          value={strategy.calendar}
        />
      </StrategySectionCard>

      {message ? <Message text={message} /> : null}
      <Button className="w-full" disabled={isPending} type="submit">
        {isPending ? (
          <LoaderCircle aria-hidden="true" className="animate-spin" size={18} />
        ) : null}
        {isPending ? "Saving strategy…" : "Save strategy"}
      </Button>
    </form>
  );
}

function Message({ text }: Readonly<{ text: string }>) {
  return (
    <p
      aria-live="polite"
      className="mt-4 rounded-2xl bg-[var(--muted)] px-4 py-3 text-sm text-[var(--muted-foreground)]"
    >
      {text}
    </p>
  );
}

function StrategySectionCard({
  title,
  description,
  children,
  onRegenerate,
  pending,
}: Readonly<{
  title: string;
  description: string;
  children: React.ReactNode;
  onRegenerate: () => void;
  pending: boolean;
}>) {
  return (
    <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">
            {description}
          </p>
        </div>
        <Button
          disabled={pending}
          onClick={onRegenerate}
          type="button"
          variant="outline"
        >
          <RefreshCw aria-hidden="true" size={15} /> Regenerate
        </Button>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function LineList({
  label,
  value,
  onChange,
}: Readonly<{
  label: string;
  value: ReadonlyArray<string>;
  onChange: (value: ReadonlyArray<string>) => void;
}>) {
  return (
    <label className="grid gap-2 text-sm font-semibold">
      {label}
      <textarea
        aria-label={label}
        className="min-h-28 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm font-normal leading-5 outline-none focus:border-[var(--ring)] focus:ring-2 focus:ring-[color:var(--ring)]/20"
        onChange={(event) => onChange(splitLines(event.target.value))}
        value={joinLines(value)}
      />
      <span className="text-xs font-normal text-[var(--muted-foreground)]">
        One item per line
      </span>
    </label>
  );
}

function PillarEditor({
  pillar,
  onChange,
  index,
}: Readonly<{
  pillar: ContentPillar;
  onChange: (pillar: ContentPillar) => void;
  index: number;
}>) {
  return (
    <article className="rounded-2xl bg-[var(--muted)] p-4">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--accent)]">
        Pillar {index + 1}
      </p>
      <label className="mt-3 grid gap-2 text-sm font-semibold">
        Name
        <Input
          onChange={(event) =>
            onChange({ ...pillar, name: event.target.value })
          }
          value={pillar.name}
        />
      </label>
      <label className="mt-3 grid gap-2 text-sm font-semibold">
        Description
        <textarea
          className="min-h-20 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm font-normal leading-5 outline-none focus:border-[var(--ring)] focus:ring-2 focus:ring-[color:var(--ring)]/20"
          onChange={(event) =>
            onChange({ ...pillar, description: event.target.value })
          }
          value={pillar.description}
        />
      </label>
      <LineList
        label="Angles"
        onChange={(angles) => onChange({ ...pillar, angles })}
        value={pillar.angles}
      />
    </article>
  );
}

function CalendarEditor({
  value,
  pillars,
  onChange,
}: Readonly<{
  value: ReadonlyArray<CalendarItem>;
  pillars: ReadonlyArray<ContentPillar>;
  onChange: (calendar: ReadonlyArray<CalendarItem>) => void;
}>) {
  const update = <Key extends keyof CalendarItem>(
    index: number,
    key: Key,
    next: CalendarItem[Key],
  ) => {
    const calendar = [...value];
    calendar[index] = { ...calendar[index], [key]: next };
    onChange(calendar);
  };
  const gridItems = useMemo(() => {
    const sorted = [...value].sort((left, right) =>
      left.date.localeCompare(right.date),
    );
    const first = sorted[0];
    if (!first) return [] as ReadonlyArray<CalendarItem | null>;
    const leadingDays = new Date(`${first.date}T00:00:00.000Z`).getUTCDay();
    return [...Array<CalendarItem | null>(leadingDays).fill(null), ...sorted];
  }, [value]);

  return (
    <>
      <div className="space-y-3 md:hidden">
        {value.map((item, index) => (
          <CalendarItemEditor
            item={item}
            key={`${item.date}-${index}`}
            onChange={(key, next) => update(index, key, next)}
            pillars={pillars}
          />
        ))}
      </div>
      <div className="hidden md:block">
        <div className="mb-2 grid grid-cols-7 gap-2 text-center text-xs font-bold uppercase tracking-[0.1em] text-[var(--muted-foreground)]">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {gridItems.map((item, gridIndex) => {
            if (item === null)
              return <div aria-hidden="true" key={`blank-${gridIndex}`} />;
            const originalIndex = value.findIndex(
              (candidate) => candidate === item,
            );
            return (
              <CalendarGridItem
                item={item}
                key={`${item.date}-${gridIndex}`}
                onChange={(key, next) => update(originalIndex, key, next)}
                pillars={pillars}
              />
            );
          })}
        </div>
      </div>
    </>
  );
}

function CalendarItemEditor({
  item,
  pillars,
  onChange,
}: Readonly<{
  item: CalendarItem;
  pillars: ReadonlyArray<ContentPillar>;
  onChange: <Key extends keyof CalendarItem>(
    key: Key,
    value: CalendarItem[Key],
  ) => void;
}>) {
  return (
    <article className="rounded-2xl border border-[var(--border)] p-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="grid gap-1 text-xs font-bold text-[var(--muted-foreground)]">
          Date
          <Input
            onChange={(event) => onChange("date", event.target.value)}
            type="date"
            value={item.date}
          />
        </label>
        <label className="grid gap-1 text-xs font-bold text-[var(--muted-foreground)]">
          Stage
          <StageSelect
            onChange={(value) => onChange("funnelStage", value)}
            value={item.funnelStage}
          />
        </label>
      </div>
      <label className="mt-3 grid gap-1 text-xs font-bold text-[var(--muted-foreground)]">
        Pillar
        <PillarSelect
          onChange={(value) => onChange("pillarId", value)}
          pillars={pillars}
          value={item.pillarId}
        />
      </label>
      <label className="mt-3 grid gap-1 text-xs font-bold text-[var(--muted-foreground)]">
        Format
        <FormatSelect
          onChange={(value) => onChange("format", value)}
          value={item.format}
        />
      </label>
      <label className="mt-3 grid gap-1 text-xs font-bold text-[var(--muted-foreground)]">
        Hook
        <Input
          onChange={(event) => onChange("hook", event.target.value)}
          value={item.hook}
        />
      </label>
    </article>
  );
}

function CalendarGridItem({
  item,
  pillars,
  onChange,
}: Readonly<{
  item: CalendarItem;
  pillars: ReadonlyArray<ContentPillar>;
  onChange: <Key extends keyof CalendarItem>(
    key: Key,
    value: CalendarItem[Key],
  ) => void;
}>) {
  return (
    <article className="min-h-44 rounded-xl border border-[var(--border)] bg-[var(--muted)] p-2">
      <div className="flex items-center justify-between gap-1">
        <input
          aria-label="Calendar date"
          className="w-11 bg-transparent text-xs font-black outline-none"
          onChange={(event) => onChange("date", event.target.value)}
          type="date"
          value={item.date}
        />
        <StageSelect
          compact
          onChange={(value) => onChange("funnelStage", value)}
          value={item.funnelStage}
        />
      </div>
      <PillarSelect
        compact
        onChange={(value) => onChange("pillarId", value)}
        pillars={pillars}
        value={item.pillarId}
      />
      <FormatSelect
        compact
        onChange={(value) => onChange("format", value)}
        value={item.format}
      />
      <textarea
        aria-label="Calendar hook"
        className="mt-2 min-h-16 w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--card)] p-2 text-xs leading-4 outline-none focus:border-[var(--ring)]"
        onChange={(event) => onChange("hook", event.target.value)}
        value={item.hook}
      />
    </article>
  );
}

const selectClass = (compact: boolean) =>
  compact
    ? "mt-2 h-7 w-full rounded-md border border-[var(--border)] bg-[var(--card)] px-1 text-[10px] font-semibold"
    : "h-10 rounded-xl border border-[var(--border)] bg-[var(--card)] px-2 text-sm font-normal";

function PillarSelect({
  value,
  pillars,
  onChange,
  compact = false,
}: Readonly<{
  value: string;
  pillars: ReadonlyArray<ContentPillar>;
  onChange: (value: string) => void;
  compact?: boolean;
}>) {
  return (
    <select
      className={selectClass(compact)}
      onChange={(event) => onChange(event.target.value)}
      value={value}
    >
      {pillars.map((pillar) => (
        <option key={pillar.id} value={pillar.id}>
          {pillar.name}
        </option>
      ))}
    </select>
  );
}

function FormatSelect({
  value,
  onChange,
  compact = false,
}: Readonly<{
  value: CalendarItem["format"];
  onChange: (value: CalendarItem["format"]) => void;
  compact?: boolean;
}>) {
  const formats: ReadonlyArray<CalendarItem["format"]> = [
    "text_post",
    "carousel",
    "video",
    "newsletter",
  ];
  return (
    <select
      className={selectClass(compact)}
      onChange={(event) =>
        onChange(event.target.value as CalendarItem["format"])
      }
      value={value}
    >
      {formats.map((format) => (
        <option key={format} value={format}>
          {formatLabel(format)}
        </option>
      ))}
    </select>
  );
}

function StageSelect({
  value,
  onChange,
  compact = false,
}: Readonly<{
  value: CalendarItem["funnelStage"];
  onChange: (value: CalendarItem["funnelStage"]) => void;
  compact?: boolean;
}>) {
  return (
    <select
      className={selectClass(compact)}
      onChange={(event) =>
        onChange(event.target.value as CalendarItem["funnelStage"])
      }
      value={value}
    >
      <option value="TOFU">TOFU</option>
      <option value="MOFU">MOFU</option>
      <option value="BOFU">BOFU</option>
    </select>
  );
}
