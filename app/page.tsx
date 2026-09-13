"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { addMemory, loadMemories, newMemoryId } from "@/lib/memory";
import { compressImage, extractVideoFrames } from "@/lib/image";
import { seedMemories } from "@/lib/seed";
import type { MemoryEntry, Observation, RecognizeResponse } from "@/lib/types";

type Phase =
  | { step: "idle" }
  | { step: "recognizing"; preview: string; label: string }
  | { step: "text" };

const STEPS = ["识别图片内容", "分析场景与情绪", "生成记忆条目"];

export default function Home() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ step: "idle" });
  const [progress, setProgress] = useState(0);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const photoInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);

  // 识别中的三步进度(纯前端节奏,请求返回即完成)
  useEffect(() => {
    if (phase.step !== "recognizing") return;
    setProgress(0);
    const t = setInterval(() => setProgress((p) => Math.min(p + 1, STEPS.length - 1)), 900);
    return () => clearInterval(t);
  }, [phase.step]);

  function finish(entry: MemoryEntry) {
    const isFirst = loadMemories().length === 1; // 已包含刚加入的这条
    addMemory(entry);
    setProgress(STEPS.length);
    setTimeout(() => {
      router.push(isFirst ? "/letter?welcome=1" : "/river");
    }, 450);
  }

  async function recognize(
    images: string[],
    kind: "photo" | "video",
    preview: string,
    label: string
  ) {
    const capturedAt = Date.now();
    let observation: Observation | undefined;
    try {
      const res = await fetch("/api/recognize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ images, kind, capturedAt }),
      });
      const data = (await res.json()) as RecognizeResponse;
      if (data.ok) observation = data.observation;
    } catch {
      // 识别失败不阻塞:条目无 AI 描述,稍后可在时间线补
    }
    finish({
      id: newMemoryId(),
      type: kind,
      time: capturedAt,
      thumb: preview,
      ai: observation,
    });
  }

  async function handlePhoto(file: File) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const dataUrl = await compressImage(file);
      setPhase({ step: "recognizing", preview: dataUrl, label: "照片" });
      await recognize([dataUrl], "photo", dataUrl, "照片");
    } catch {
      setError("这张照片没能读出来,换一张试试");
      setPhase({ step: "idle" });
    } finally {
      setBusy(false);
    }
  }

  async function handleVideo(file: File) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const frames = await extractVideoFrames(file, 3);
      const preview = frames[0];
      setPhase({ step: "recognizing", preview, label: "视频" });
      await recognize(frames, "video", preview, "视频");
    } catch {
      setError("这段视频没能读出来,换一段试试");
      setPhase({ step: "idle" });
    } finally {
      setBusy(false);
    }
  }

  function handleText() {
    const content = text.trim();
    if (!content) return;
    const now = Date.now();
    setProgress(STEPS.length);
    finish({
      id: newMemoryId(),
      type: "text",
      time: now,
      content,
    });
  }

  function handleSeed() {
    seedMemories();
    router.push("/river");
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-5 md:px-8">
      <input
        ref={photoInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handlePhoto(f);
          e.target.value = "";
        }}
      />
      <input
        ref={videoInput}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleVideo(f);
          e.target.value = "";
        }}
      />

      {phase.step === "recognizing" ? (
        <Recognizing preview={phase.preview} label={phase.label} progress={progress} />
      ) : phase.step === "text" ? (
        <TextSubmit
          value={text}
          onChange={setText}
          onBack={() => setPhase({ step: "idle" })}
          onSubmit={handleText}
        />
      ) : (
        <>
          {/* Hero:海与信 */}
          <section className="pt-12 pb-9 text-center md:pt-20 md:pb-14 md:text-left">
            <p className="font-letter text-3xl tracking-[0.08em] text-sea md:text-4xl">
              致你
            </p>
            <h1 className="mt-7 text-2xl font-medium leading-relaxed text-sea-deep md:mt-9 md:text-[2.1rem]">
              今天,有什么想交给我的?
            </h1>
            <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-ink-soft md:mx-0 md:max-w-lg md:text-[15px]">
              把生活中的照片、文字、视频交给我。
              我会把它们变成一条流动的时间线,并在每天、每周给你写一封信。
            </p>
          </section>

          {/* 三个入口 */}
          <section className="grid gap-3 md:grid-cols-3 md:gap-5">
            <SubmitCard
              title="拍照照片"
              desc="记录此刻的美好"
              onClick={() => photoInput.current?.click()}
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                  <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.2a1 1 0 0 0 .83-.45l.94-1.4A1 1 0 0 1 10.3 3.7h3.4a1 1 0 0 1 .83.45l.94 1.4a1 1 0 0 0 .83.45h1.2A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-8Z" />
                  <circle cx="12" cy="12.5" r="3.4" />
                </svg>
              }
            />
            <SubmitCard
              title="写几句话"
              desc="分享你的心情"
              onClick={() => setPhase({ step: "text" })}
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                  <path d="M5 19.5 16.6 7.9a2.1 2.1 0 0 0-3-3L2 16.5v3h3Z" strokeLinejoin="round" />
                  <path d="M14 6.5 17.5 10" strokeLinecap="round" />
                </svg>
              }
            />
            <SubmitCard
              title="传段视频"
              desc="让更多回忆被看见"
              onClick={() => videoInput.current?.click()}
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                  <rect x="3" y="6" width="13" height="12" rx="2.5" />
                  <path d="m16 10.5 4.2-2.7a.7.7 0 0 1 1.05.6v7.2a.7.7 0 0 1-1.05.6L16 13.5" strokeLinejoin="round" />
                </svg>
              }
            />
          </section>

          {error ? (
            <p className="mt-5 text-center text-sm text-dawn md:text-left">{error}</p>
          ) : null}

          <p className="mt-14 text-center font-letter text-sm italic tracking-wide text-ink-soft/80 md:mt-20">
            我会记得,也会写给你
          </p>
          <p className="mt-3 text-center">
            <button
              type="button"
              onClick={handleSeed}
              className="font-letter text-[13px] text-ink-soft/60 underline-offset-4 transition-colors hover:text-sea hover:underline"
            >
              或者,先看看一段示例生活
            </button>
          </p>
        </>
      )}
    </div>
  );
}

function SubmitCard({
  title,
  desc,
  icon,
  onClick,
}: {
  title: string;
  desc: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-4 rounded-2xl border border-sea-mist bg-white/70 px-5 py-4 text-left transition-colors hover:border-sea/40 hover:bg-white md:flex-col md:items-start md:gap-6 md:px-6 md:py-7"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sea-mist/70 text-sea transition-colors group-hover:bg-sea-mist md:h-12 md:w-12">
        <span className="h-6 w-6 md:h-[26px] md:w-[26px]">{icon}</span>
      </span>
      <span className="md:order-first">
        <span className="block text-[15px] font-medium text-sea-deep md:text-base">
          {title}
        </span>
        <span className="mt-0.5 block text-[13px] text-ink-soft md:mt-1.5">{desc}</span>
      </span>
    </button>
  );
}

function Recognizing({
  preview,
  label,
  progress,
}: {
  preview: string;
  label: string;
  progress: number;
}) {
  return (
    <section className="mx-auto max-w-md pt-10 md:pt-16">
      <div className="overflow-hidden rounded-2xl border border-sea-mist bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={preview} alt={`刚交给它的${label}`} className="h-56 w-full object-cover md:h-72" />
      </div>

      <div className="mt-7">
        <p className="text-[15px] font-medium text-sea-deep">AI 正在看……</p>
        <ul className="mt-4 space-y-3">
          {STEPS.map((step, i) => {
            const done = progress > i;
            const active = progress === i;
            return (
              <li key={step} className="flex items-center gap-3 text-sm">
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full border text-[10px] transition-colors ${
                    done
                      ? "border-sea bg-sea text-white"
                      : active
                        ? "border-sea text-sea"
                        : "border-sea-mist text-transparent"
                  }`}
                >
                  ✓
                </span>
                <span className={done || active ? "text-sea-deep" : "text-ink-soft/70"}>
                  {step}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-6 text-xs text-ink-soft/80">大约需要 2-4 秒,请稍等~</p>
      </div>
    </section>
  );
}

function TextSubmit({
  value,
  onChange,
  onBack,
  onSubmit,
}: {
  value: string;
  onChange: (v: string) => void;
  onBack: () => void;
  onSubmit: () => void;
}) {
  return (
    <section className="mx-auto max-w-2xl pt-8 md:pt-14">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-ink-soft transition-colors hover:text-sea-deep"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        回去
      </button>

      <h1 className="mt-6 text-xl font-medium text-sea-deep">写几句话</h1>
      <p className="mt-2 text-sm text-ink-soft">
        说说今天发生了什么。不用讲究,想到什么写什么。
      </p>

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={7}
        autoFocus
        placeholder="今天……"
        className="mt-5 w-full resize-none rounded-2xl border border-sea-mist bg-white px-5 py-4 font-letter text-[15px] leading-8 text-sea-deep placeholder:text-ink-soft/40 focus:border-sea/50 focus:outline-none"
      />

      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs text-ink-soft/70">{value.trim().length} 字</span>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!value.trim()}
          className="rounded-full bg-sea px-7 py-2.5 text-sm text-white transition-opacity disabled:opacity-35"
        >
          交给它
        </button>
      </div>
    </section>
  );
}
