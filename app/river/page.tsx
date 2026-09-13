"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { loadMemories, updateMemory } from "@/lib/memory";
import { seedMemories } from "@/lib/seed";
import { formatMemTime } from "@/lib/image";
import type { MemoryEntry, RecognizeResponse } from "@/lib/types";

export default function RiverPage() {
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [retrying, setRetrying] = useState<string | null>(null);

  useEffect(() => {
    setMemories(loadMemories());
    setLoaded(true);
  }, []);

  async function retry(m: MemoryEntry) {
    if (!m.thumb || retrying) return;
    setRetrying(m.id);
    try {
      const res = await fetch("/api/recognize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ images: [m.thumb], kind: m.type === "video" ? "video" : "photo", capturedAt: m.time }),
      });
      const data = (await res.json()) as RecognizeResponse;
      if (data.ok) setMemories(updateMemory(m.id, { ai: data.observation }));
    } catch {
      // 仍然失败:保持"未识别"状态,不打扰
    } finally {
      setRetrying(null);
    }
  }

  const groups = useMemo(() => groupByDay(memories), [memories]);

  return (
    <div className="mx-auto w-full max-w-5xl px-5 md:px-8">
      <header className="flex items-baseline justify-between pt-10 md:pt-14">
        <h1 className="text-xl font-medium text-sea-deep md:text-2xl">我的时间线</h1>
        {memories.length > 0 ? (
          <span className="text-sm text-ink-soft">{memories.length} 条记忆</span>
        ) : null}
      </header>

      {loaded && memories.length === 0 ? (
        <div className="pt-24 text-center md:pt-32">
          <p className="font-letter text-lg text-ink-soft">这里还是空的。</p>
          <p className="mt-3 text-sm text-ink-soft/80">
            把你生活的第一件小事交给我,河流就会从这里开始。
          </p>
          <Link
            href="/"
            className="mt-8 inline-block rounded-full bg-sea px-7 py-2.5 text-sm text-white"
          >
            交给它一件小事
          </Link>
          <p className="mt-4">
            <button
              type="button"
              onClick={() => setMemories(seedMemories())}
              className="font-letter text-[13px] text-ink-soft/60 underline-offset-4 transition-colors hover:text-sea hover:underline"
            >
              先看看一段示例生活
            </button>
          </p>
        </div>
      ) : (
        <div className="mt-8 space-y-10 pb-8 md:mt-10 md:space-y-14">
          {groups.map(([key, items]) => (
            <section key={key}>
              <h2 className="flex items-baseline gap-3">
                <span className="text-[15px] font-medium text-sea-deep">
                  {dayLabel(items[0].time)}
                </span>
                <span className="text-xs text-ink-soft/70">{dayDate(items[0].time)}</span>
              </h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2 md:gap-4">
                {items.map((m) => (
                  <MemoryCard
                    key={m.id}
                    memory={m}
                    retrying={retrying === m.id}
                    onRetry={() => void retry(m)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function MemoryCard({
  memory,
  retrying,
  onRetry,
}: {
  memory: MemoryEntry;
  retrying: boolean;
  onRetry: () => void;
}) {
  const isNew = Date.now() - memory.time < 8_000;
  const flowIn = isNew ? { animation: "flow-in 0.7s ease-out both" } : undefined;

  if (memory.type === "text") {
    return (
      <div
        style={flowIn}
        className="rounded-2xl border border-sea-mist bg-white px-5 py-4"
      >
        <p className="border-l-2 border-sea/30 pl-3 font-letter text-[15px] leading-7 text-sea-deep">
          {memory.content}
        </p>
        <div className="mt-3 flex items-center justify-between">
          <Tags tags={memory.ai?.tags} />
          <time className="text-xs text-ink-soft/70">{formatMemTime(memory.time)}</time>
        </div>
      </div>
    );
  }

  return (
    <article
      style={flowIn}
      className="flex gap-4 rounded-2xl border border-sea-mist bg-white p-3.5"
    >
      {memory.thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={memory.thumb}
          alt=""
          className="h-[72px] w-[72px] shrink-0 rounded-xl object-cover"
        />
      ) : (
        <div className="h-[72px] w-[72px] shrink-0 rounded-xl bg-sea-mist" />
      )}

      <div className="min-w-0 flex-1 py-0.5">
        {memory.ai ? (
          <>
            <p className="text-[14px] leading-6 text-sea-deep">{memory.ai.desc}</p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <Tags tags={memory.ai.tags} />
              <time className="shrink-0 text-xs text-ink-soft/70">
                {formatMemTime(memory.time)}
              </time>
            </div>
          </>
        ) : (
          <div className="flex h-full flex-col justify-center">
            <p className="text-[13px] text-ink-soft">它还没来得及看。</p>
            <button
              type="button"
              onClick={onRetry}
              disabled={retrying}
              className="mt-1.5 self-start text-[13px] text-sea underline-offset-4 hover:underline disabled:opacity-50"
            >
              {retrying ? "正在看……" : "让它现在看"}
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

function Tags({ tags }: { tags?: string[] }) {
  if (!tags || tags.length === 0) return <span />;
  return (
    <span className="flex flex-wrap gap-1.5">
      {tags.map((t) => (
        <span key={t} className="rounded-full bg-sea-mist/80 px-2.5 py-0.5 text-xs text-sea">
          {t}
        </span>
      ))}
    </span>
  );
}

// ===== 日期工具 =====

function dayKey(time: number): string {
  const d = new Date(time);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function dayLabel(time: number): string {
  const d = new Date(time);
  const now = new Date();
  const same = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (same(d, now)) return "今天";
  if (same(d, yesterday)) return "昨天";
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日`;
}

function dayDate(time: number): string {
  const d = new Date(time);
  return `${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function groupByDay(list: MemoryEntry[]): [string, MemoryEntry[]][] {
  const sorted = [...list].sort((a, b) => b.time - a.time);
  const map = new Map<string, MemoryEntry[]>();
  for (const m of sorted) {
    const key = dayKey(m.time);
    const arr = map.get(key);
    if (arr) arr.push(m);
    else map.set(key, [m]);
  }
  return [...map.entries()];
}
