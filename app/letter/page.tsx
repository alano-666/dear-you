"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadCachedLetter, loadMemories, saveCachedLetter } from "@/lib/memory";
import { buildFallbackLetter } from "@/lib/fallback-letter";
import type { Letter, LetterResponse, MemoryEntry, Segment } from "@/lib/types";

type Kind = "welcome" | "daily" | "weekly";
type Status = "idle" | "loading" | "error" | "fallback";

export default function LetterPage() {
  return (
    <Suspense fallback={<Waiting text="正在翻开你的信……" />}>
      <LetterView />
    </Suspense>
  );
}

function LetterView() {
  const searchParams = useSearchParams();
  const [kind, setKind] = useState<Kind>("daily");
  const [letter, setLetter] = useState<Letter | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [playKey, setPlayKey] = useState(0);
  const memories = useRef<MemoryEntry[]>([]);

  const generate = useCallback(async (k: Kind, force = false) => {
    const cacheKey = letterCacheKey(k);
    if (!force) {
      const cached = loadCachedLetter(cacheKey);
      if (cached) {
        setLetter(cached);
        setStatus("idle");
        setPlayKey((x) => x + 1);
        return;
      }
    }

    const mems = loadMemories();
    memories.current = mems;
    if (mems.length === 0) {
      setStatus("error");
      setLetter(null);
      return;
    }

    setLetter(null);
    setStatus("loading");
    try {
      const res = await fetch("/api/letter", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: k, now: Date.now(), memories: mems }),
      });
      const data = (await res.json()) as LetterResponse;
      if (data.ok) {
        saveCachedLetter(cacheKey, data.letter);
        setLetter(data.letter);
        setStatus("idle");
        setPlayKey((x) => x + 1);
        return;
      }
      throw new Error(data.error);
    } catch {
      // 兜底:周信直接给备用信;日信提示重试
      if (k === "weekly") {
        setLetter(buildFallbackLetter());
        setStatus("fallback");
      } else {
        setStatus("error");
      }
    }
  }, []);

  useEffect(() => {
    const initial: Kind = searchParams.get("welcome") === "1" ? "welcome" : "daily";
    setKind(initial);
    void generate(initial);
  }, [generate, searchParams]);

  const findMem = useCallback(
    (id: string) => memories.current.find((m) => m.id === id),
    []
  );

  const total = useMemo(
    () => (letter ? letter.segments.reduce((n, s) => n + segmentCost(s), 0) : 0),
    [letter]
  );
  const revealed = useTypewriter(total, playKey);
  const done = total > 0 && revealed >= total;

  return (
    <div className="mx-auto w-full max-w-2xl px-5 md:px-8">
      {/* 信种切换 */}
      {kind !== "welcome" ? (
        <div className="flex items-center justify-center gap-1 pt-8 md:pt-12">
          <TabButton active={kind === "daily"} onClick={() => switchKind("daily")}>
            今天的信
          </TabButton>
          <TabButton active={kind === "weekly"} onClick={() => switchKind("weekly")}>
            本周的信
          </TabButton>
        </div>
      ) : (
        <p className="pt-8 text-center font-letter text-sm text-ink-soft md:pt-12">
          第一封信,从今天开始
        </p>
      )}

      {/* 信纸 */}
      <div className="mt-6 md:mt-8">
        {status === "loading" ? (
          <Waiting text={kind === "weekly" ? "它正在把这一周的日子,写成给你的信……" : "它正在读今天的记忆,写今天的信……"} />
        ) : status === "error" ? (
          <ErrorState
            message={letter ? "今天的信在路上,稍后再来。" : "要先交给它一些东西,才能收到信。"}
            onRetry={letter || kind === "welcome" ? undefined : () => void generate(kind, true)}
          />
        ) : letter ? (
          <article className="rounded-3xl border border-sea-mist bg-paper-warm px-6 py-8 md:px-10 md:py-11">
            <header className="flex items-baseline justify-between">
              <h1 className="font-letter text-xl text-sea-deep md:text-[1.4rem]">
                {letter.title}
              </h1>
              <span className="text-xs text-ink-soft/70">
                {new Date(letter.generatedAt).getMonth() + 1} 月{" "}
                {new Date(letter.generatedAt).getDate()} 日
              </span>
            </header>

            <p className="mt-5 font-letter text-[15px] text-ink-soft">{letter.salutation}</p>

            <div className="mt-3 space-y-5">
              {renderSegments(letter, revealed, findMem, done)}
            </div>

            {done ? (
              <p className="mt-8 text-right font-letter text-[15px] text-sea-deep">
                {letter.sign}
              </p>
            ) : null}

            {status === "fallback" ? (
              <p className="mt-6 border-t border-sea-mist pt-4 text-center text-xs text-ink-soft/60">
                演示数据 · 网络恢复后,下一封信会照常生成
              </p>
            ) : null}
          </article>
        ) : null}
      </div>

      {/* 贴纸回应 */}
      {letter && done ? <Stickers /> : null}

      {/* 送达入口 */}
      {letter && done ? (
        <div className="pb-6 text-center">
          <Link
            href="/deliver"
            className="font-letter text-[13px] text-ink-soft/80 underline-offset-4 transition-colors hover:text-sea hover:underline"
          >
            这封信,也可以这样送到你手里
          </Link>
        </div>
      ) : null}
    </div>
  );

  function switchKind(k: "daily" | "weekly") {
    if (k === kind) return;
    setKind(k);
    void generate(k);
  }
}

// ===== 逐字浮现 =====

function useTypewriter(total: number, playKey: number, speed = 2, intervalMs = 55) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    if (total <= 0) return;
    const t = setInterval(() => {
      setN((prev) => {
        const next = prev + speed;
        if (next >= total) {
          clearInterval(t);
          return total;
        }
        return next;
      });
    }, intervalMs);
    return () => clearInterval(t);
  }, [total, playKey, speed, intervalMs]);
  return n;
}

function segmentCost(s: Segment): number {
  if (s.type === "discover") return s.items.reduce((n, i) => n + i.text.length, 0);
  return s.text.length;
}

function renderSegments(
  letter: Letter,
  revealed: number,
  findMem: (id: string) => MemoryEntry | undefined,
  done: boolean
) {
  let budget = revealed;
  const out: React.ReactNode[] = [];

  for (let i = 0; i < letter.segments.length; i++) {
    const s = letter.segments[i];
    const cost = segmentCost(s);

    if (s.type === "text") {
      const visible = Math.min(s.text.length, Math.max(0, budget));
      budget -= s.text.length;
      if (visible > 0) {
        out.push(
          <p key={i} className="font-letter text-[15px] leading-8 text-sea-deep md:text-base md:leading-9">
            {s.text.slice(0, visible)}
            {visible < s.text.length ? <Caret /> : null}
          </p>
        );
      }
    } else {
      if (budget <= 0) break;
      budget -= cost;
      if (s.type === "quote") {
        const mem = findMem(s.memId);
        out.push(
          <Link
            key={i}
            href="/river"
            className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 transition-colors hover:bg-sea-mist/50"
          >
            {mem?.thumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mem.thumb} alt="" className="h-12 w-12 rounded-lg object-cover" />
            ) : (
              <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-sea-mist font-letter text-lg text-sea">
                ”
              </span>
            )}
            <span className="min-w-0 flex-1 font-letter text-[14px] leading-6 text-sea-deep">
              {s.text}
            </span>
          </Link>
        );
      } else {
        out.push(
          <div key={i} className="rounded-2xl border border-sea-mist bg-white/70 px-4 py-4">
            <p className="text-xs text-ink-soft/80">我发现了</p>
            <ul className="mt-3 space-y-3">
              {s.items.map((item, j) => (
                <li key={j} className="flex gap-3">
                  <span className={discoverTagClass(item.kind)}>{item.kind}</span>
                  <span className="flex-1 font-letter text-[14px] leading-6 text-sea-deep/90">
                    {item.text}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      }
    }
  }

  if (!done && out.length === 0 && revealed === 0) {
    out.push(<p key="wait" className="font-letter text-[15px] text-ink-soft/50">……</p>);
  }
  return out;
}

function discoverTagClass(kind: string): string {
  const base = "mt-0.5 h-fit shrink-0 rounded-md px-2 py-0.5 text-[11px] tracking-wide";
  if (kind === "对比") return `${base} bg-sea-mist text-sea`;
  if (kind === "回响") return `${base} bg-dawn/15 text-dawn`;
  return `${base} bg-ink-soft/10 text-ink-soft`;
}

function Caret() {
  return <span className="ml-0.5 inline-block h-[1em] w-[2px] animate-pulse bg-sea align-middle" />;
}

// ===== 底部贴纸回应 =====

const STICKERS: { key: string; label: string; reply: string; face: string }[] = [
  { key: "moved", label: "被戳中了", reply: "嗯,我也觉得。那天的你,值得被记住。", face: "●" },
  { key: "more", label: "多讲点", reply: "好。下一次,我会多讲一点。", face: "○" },
  { key: "wrong", label: "你记错了", reply: "谢谢你告诉我。我会改过来,记准你的生活。", face: "◐" },
];

function Stickers() {
  const [picked, setPicked] = useState<string | null>(null);
  const reply = STICKERS.find((s) => s.key === picked);

  return (
    <div className="mt-8 pb-4 text-center">
      {reply ? (
        <p className="mb-5 font-letter text-[14px] leading-6 text-sea">{reply.reply}</p>
      ) : (
        <p className="mb-5 text-xs text-ink-soft/70">读到这里,想说点什么吗</p>
      )}
      <div className="flex justify-center gap-3">
        {STICKERS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setPicked(picked === s.key ? null : s.key)}
            className={`flex flex-col items-center gap-1.5 rounded-2xl border px-4 py-3 transition-colors ${
              picked === s.key
                ? "border-sea/50 bg-sea-mist/60"
                : "border-sea-mist bg-white/70 hover:border-sea/30"
            }`}
          >
            <span className="font-letter text-lg leading-none text-sea">{s.face}</span>
            <span className="text-xs text-sea-deep">{s.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ===== 状态块 =====

function Waiting({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-sea-mist bg-paper-warm px-8 py-20">
      <span className="relative flex h-3 w-3">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sea/40" />
        <span className="relative inline-flex h-3 w-3 rounded-full bg-sea/70" />
      </span>
      <p className="mt-6 font-letter text-[15px] text-ink-soft">{text}</p>
      <p className="mt-2 text-xs text-ink-soft/60">大约需要十几秒,信在路上</p>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-3xl border border-sea-mist bg-paper-warm px-8 py-16 text-center">
      <p className="font-letter text-[15px] text-ink-soft">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-6 rounded-full border border-sea/30 px-6 py-2 text-sm text-sea transition-colors hover:bg-sea-mist/50"
        >
          再试一次
        </button>
      ) : (
        <Link
          href="/"
          className="mt-6 inline-block rounded-full bg-sea px-6 py-2 text-sm text-white"
        >
          去交给它
        </Link>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-5 py-2 text-sm transition-colors ${
        active ? "bg-white text-sea-deep shadow-[0_1px_2px_rgba(20,48,75,0.06)]" : "text-ink-soft hover:text-sea-deep"
      }`}
    >
      {children}
    </button>
  );
}

// ===== 缓存键 =====

function letterCacheKey(kind: Kind): string {
  if (kind === "welcome") return "welcome";
  const d = new Date();
  if (kind === "daily") {
    return `daily:${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  }
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return `weekly:${monday.getFullYear()}-${monday.getMonth() + 1}-${monday.getDate()}`;
}
