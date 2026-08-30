"use client";

import {
  Check,
  LoaderCircle,
  Mic,
  PencilLine,
  Save,
  Square,
  Sparkles,
} from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";

import {
  generateVoiceProfileAction,
  saveVoiceProfileAction,
  transcribeVoiceAnswerAction,
  type VoiceActionResult,
} from "@/app/app/interview/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  INTERVIEW_QUESTION_COUNT,
  nextInterviewQuestion,
  type InterviewAnswer,
} from "@/lib/voice/interview";
import { type VoiceProfile } from "@/lib/voice/schema";

type Stage = "editing" | "recording" | "transcribing" | "generating" | "saving";

type ListField =
  | "toneAdjectives"
  | "signaturePhrases"
  | "bannedWords"
  | "formattingHabits"
  | "exampleSentences";

const displayError = <A,>(result: VoiceActionResult<A>) =>
  result.ok
    ? null
    : result.retryAfterSeconds
      ? `${result.message} Try again in about ${result.retryAfterSeconds} seconds.`
      : result.message;

const supportedMimeType = () => {
  if (typeof MediaRecorder === "undefined") return undefined;
  return ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find((type) =>
    MediaRecorder.isTypeSupported(type),
  );
};

export function VoiceInterview({
  initialProfile,
}: Readonly<{ initialProfile: VoiceProfile | null }>) {
  const [answers, setAnswers] = useState<ReadonlyArray<InterviewAnswer>>([]);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [pastPosts, setPastPosts] = useState("");
  const [profile, setProfile] = useState<VoiceProfile | null>(initialProfile);
  const [stage, setStage] = useState<Stage>("editing");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const retry = useRef<(() => void) | null>(null);

  useEffect(
    () => () => {
      recorder.current?.stop();
      stream.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  const currentQuestion = nextInterviewQuestion(answers);
  const completedAnswers = answers.length;
  const progress = Math.round(
    (completedAnswers / INTERVIEW_QUESTION_COUNT) * 100,
  );
  const busy = stage !== "editing" || isPending;

  const continueInterview = () => {
    if (!currentQuestion || !currentAnswer.trim()) return;
    setAnswers((current) => [
      ...current,
      {
        questionId: currentQuestion.id,
        question: currentQuestion.prompt,
        answer: currentAnswer.trim(),
      },
    ]);
    setCurrentAnswer("");
  };

  const stopRecording = () => recorder.current?.stop();

  const transcribeBlob = async (blob: Blob) => {
    setStage("transcribing");
    setError(null);
    retry.current = () => void transcribeBlob(blob);
    const formData = new FormData();
    formData.set(
      "audio",
      new File(
        [blob],
        `founder-answer.${blob.type.includes("mp4") ? "m4a" : "webm"}`,
        { type: blob.type || "audio/webm" },
      ),
    );
    const result = await transcribeVoiceAnswerAction(formData);
    if (result.ok) setCurrentAnswer(result.value);
    else setError(displayError(result));
    setStage("editing");
  };

  const startRecording = async () => {
    setError(null);
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setError(
        "Recording is not available in this browser. Type your answer instead.",
      );
      return;
    }

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      stream.current = mediaStream;
      const mimeType = supportedMimeType();
      const mediaRecorder = mimeType
        ? new MediaRecorder(mediaStream, { mimeType })
        : new MediaRecorder(mediaStream);
      const chunks: BlobPart[] = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      mediaRecorder.onstop = () => {
        mediaStream.getTracks().forEach((track) => track.stop());
        stream.current = null;
        recorder.current = null;
        void transcribeBlob(
          new Blob(chunks, { type: mediaRecorder.mimeType || "audio/webm" }),
        );
      };
      recorder.current = mediaRecorder;
      mediaRecorder.start();
      setStage("recording");
    } catch {
      setError(
        "Microphone access was blocked. You can type your answer instead.",
      );
      setStage("editing");
    }
  };

  const generate = () => {
    const interview = {
      answers,
      pastPosts: pastPosts
        .split(/\n\s*\n/)
        .map((post) => post.trim())
        .filter(Boolean)
        .slice(0, 3),
    };
    setError(null);
    setStage("generating");
    retry.current = generate;
    startTransition(async () => {
      const result = await generateVoiceProfileAction(interview);
      if (result.ok) setProfile(result.value);
      else setError(displayError(result));
      setStage("editing");
    });
  };

  const updateList = (field: ListField, value: string) => {
    setProfile((current) =>
      current
        ? {
            ...current,
            [field]: value
              .split(field === "exampleSentences" ? "\n" : ",")
              .map((item) => item.trim())
              .filter(Boolean),
          }
        : current,
    );
  };

  const saveProfile = () => {
    if (!profile) return;
    setError(null);
    setStage("saving");
    retry.current = saveProfile;
    startTransition(async () => {
      const result = await saveVoiceProfileAction(profile);
      if (result.ok) setProfile(result.value);
      else setError(displayError(result));
      setStage("editing");
    });
  };

  if (profile) {
    return (
      <section className="pb-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[var(--muted-foreground)]">
              Your voice, captured
            </p>
            <h1 className="mt-1 text-3xl font-black tracking-[-0.05em]">
              Voice profile
            </h1>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--muted)] px-3 py-1 text-xs font-bold text-[var(--primary)]">
            <Check size={14} aria-hidden="true" /> Saved
          </span>
        </div>
        <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">
          Edit anything that does not feel like you. Every pack will use this
          profile.
        </p>

        <div className="mt-6 grid gap-4">
          <ProfileListEditor
            label="Tone adjectives"
            value={profile.toneAdjectives.join(", ")}
            onChange={(value) => updateList("toneAdjectives", value)}
            hint="Comma-separated"
          />
          <label className="grid gap-2 text-sm font-bold">
            Average sentence length
            <Input
              min="1"
              onChange={(event) =>
                setProfile({
                  ...profile,
                  averageSentenceLength: Math.max(
                    1,
                    Number(event.target.value) || 1,
                  ),
                })
              }
              type="number"
              value={profile.averageSentenceLength}
            />
          </label>
          <ProfileListEditor
            label="Signature phrases"
            value={profile.signaturePhrases.join(", ")}
            onChange={(value) => updateList("signaturePhrases", value)}
            hint="Comma-separated"
          />
          <ProfileListEditor
            label="Words to avoid"
            value={profile.bannedWords.join(", ")}
            onChange={(value) => updateList("bannedWords", value)}
            hint="Comma-separated"
          />
          <label className="grid gap-2 text-sm font-bold">
            Emoji policy
            <select
              className="h-12 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 text-base"
              onChange={(event) =>
                setProfile({
                  ...profile,
                  emojiPolicy: event.target
                    .value as VoiceProfile["emojiPolicy"],
                })
              }
              value={profile.emojiPolicy}
            >
              <option value="none">No emoji</option>
              <option value="sparing">Use sparingly</option>
              <option value="frequent">Use often</option>
            </select>
          </label>
          <ProfileListEditor
            label="Formatting habits"
            value={profile.formattingHabits.join(", ")}
            onChange={(value) => updateList("formattingHabits", value)}
            hint="Comma-separated"
          />
          <label className="grid gap-2 text-sm font-bold">
            Point of view
            <select
              className="h-12 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 text-base"
              onChange={(event) =>
                setProfile({
                  ...profile,
                  pointOfView: event.target
                    .value as VoiceProfile["pointOfView"],
                })
              }
              value={profile.pointOfView}
            >
              <option value="first-person">First person</option>
              <option value="second-person">Second person</option>
              <option value="third-person">Third person</option>
              <option value="mixed">Mixed</option>
            </select>
          </label>
          <ProfileListEditor
            label="Example sentences"
            value={profile.exampleSentences.join("\n")}
            onChange={(value) => updateList("exampleSentences", value)}
            hint="One sentence per line"
            multiline
          />
        </div>
        <VoiceError error={error} onRetry={() => retry.current?.()} />
        <Button className="mt-6 w-full" disabled={busy} onClick={saveProfile}>
          {stage === "saving" ? (
            <LoaderCircle className="animate-spin" size={18} />
          ) : (
            <Save size={18} />
          )}
          Save voice profile
        </Button>
      </section>
    );
  }

  return (
    <section className="pb-8">
      <p className="text-sm font-semibold text-[var(--muted-foreground)]">
        Five minutes, your words
      </p>
      <h1 className="mt-1 text-3xl font-black tracking-[-0.05em]">
        Teach us how you sound.
      </h1>
      <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">
        Record a short answer or type it. You can fix the profile before it is
        used.
      </p>

      <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
        <div className="flex items-center justify-between text-sm font-bold">
          <span>Interview progress</span>
          <span>
            {completedAnswers}/{INTERVIEW_QUESTION_COUNT}
          </span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--muted)]">
          <div
            className="h-full rounded-full bg-[var(--accent)] transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-3 text-xs font-medium text-[var(--muted-foreground)]">
          {stage === "recording"
            ? "Recording your answer…"
            : stage === "transcribing"
              ? "Transcribing with care…"
              : stage === "generating"
                ? "Building your voice profile…"
                : "Each answer shapes the next question."}
        </p>
      </div>

      <div className="mt-5 grid gap-4">
        {currentQuestion ? (
          <label
            className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4"
          >
            <span className="flex items-center gap-3 text-sm font-black">
              <span className="grid size-6 place-items-center rounded-full bg-[var(--muted)] text-xs text-[var(--primary)]">
                {completedAnswers + 1}
              </span>
              {currentQuestion.prompt}
            </span>
            <span className="mt-2 block text-xs leading-5 text-[var(--muted-foreground)]">
              {currentQuestion.helper}
            </span>
            <textarea
              className="mt-3 min-h-28 w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--background)] p-3 text-base leading-6 outline-none focus:border-[var(--ring)] focus:ring-2 focus:ring-[color:var(--ring)]/20"
              disabled={busy}
              onChange={(event) => setCurrentAnswer(event.target.value)}
              placeholder="Tap the mic or type here…"
              value={currentAnswer}
            />
            <div className="mt-3 flex justify-between gap-3">
              {stage === "recording" && recorder.current ? (
                <Button onClick={stopRecording} variant="outline">
                  <Square size={16} /> Stop recording
                </Button>
              ) : (
                <Button
                  disabled={busy}
                  onClick={() => void startRecording()}
                  variant="outline"
                >
                  <Mic size={16} /> Record answer
                </Button>
              )}
              <Button
                disabled={busy || !currentAnswer.trim()}
                onClick={continueInterview}
              >
                Continue
              </Button>
            </div>
          </label>
        ) : (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 text-sm leading-6 text-[var(--muted-foreground)]">
            All five answers are ready. Add past posts if you have them, then
            generate your profile.
          </div>
        )}
      </div>

      <label className="mt-5 grid gap-2 rounded-2xl border border-dashed border-[var(--border)] p-4 text-sm font-bold">
        Optional: paste up to three past posts
        <span className="text-xs font-medium leading-5 text-[var(--muted-foreground)]">
          Separate posts with a blank line. They help tune real phrasing, never
          become public content.
        </span>
        <textarea
          className="min-h-32 w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 text-base font-normal leading-6 outline-none focus:border-[var(--ring)] focus:ring-2 focus:ring-[color:var(--ring)]/20"
          disabled={busy}
          onChange={(event) => setPastPosts(event.target.value)}
          placeholder="Paste a post…"
          value={pastPosts}
        />
      </label>

      <VoiceError error={error} onRetry={() => retry.current?.()} />
      <Button
        className="mt-6 w-full"
        disabled={busy || currentQuestion !== null}
        onClick={generate}
      >
        {stage === "generating" ? (
          <LoaderCircle className="animate-spin" size={18} />
        ) : (
          <Sparkles size={18} />
        )}
        Generate my voice profile
      </Button>
    </section>
  );
}

function ProfileListEditor({
  label,
  value,
  onChange,
  hint,
  multiline = false,
}: Readonly<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint: string;
  multiline?: boolean;
}>) {
  return (
    <label className="grid gap-2 text-sm font-bold">
      {label}
      <span className="text-xs font-medium text-[var(--muted-foreground)]">
        {hint}
      </span>
      {multiline ? (
        <textarea
          className="min-h-28 w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 text-base font-normal leading-6 outline-none focus:border-[var(--ring)] focus:ring-2 focus:ring-[color:var(--ring)]/20"
          onChange={(event) => onChange(event.target.value)}
          value={value}
        />
      ) : (
        <Input
          onChange={(event) => onChange(event.target.value)}
          value={value}
        />
      )}
    </label>
  );
}

function VoiceError({
  error,
  onRetry,
}: Readonly<{ error: string | null; onRetry: () => void }>) {
  if (!error) return null;
  return (
    <div
      aria-live="polite"
      className="mt-5 rounded-2xl border border-[#efb4a3] bg-[#fff1ed] p-4 text-sm leading-6 text-[#8b301c]"
    >
      <p className="font-bold">Something needs your attention</p>
      <p className="mt-1">{error}</p>
      <Button className="mt-3" onClick={onRetry} variant="outline">
        <PencilLine size={16} /> Retry
      </Button>
    </div>
  );
}
