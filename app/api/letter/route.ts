// 接口 2:POST /api/letter —— 把记忆库写成信(§5)
import { fail } from "@/lib/api";
import { parseJsonLoose } from "@/lib/json";
import { chat, chatModelName, LlmError } from "@/lib/llm";
import { buildLetterSystem, buildLetterUser } from "@/lib/prompts";
import type { DiscoverItem, Letter, LetterKind, MemoryEntry, Segment } from "@/lib/types";

export const maxDuration = 60;

const KINDS: LetterKind[] = ["welcome", "daily", "weekly"];

export async function POST(req: Request) {
  const startedAt = Date.now();

  let body: { kind?: unknown; now?: unknown; memories?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return fail("BAD_REQUEST", "请求体不是合法 JSON");
  }

  const kind = body.kind as LetterKind;
  if (!KINDS.includes(kind)) return fail("BAD_REQUEST", "kind 必须是 welcome / daily / weekly");

  const memories = normalizeMemories(body.memories);
  const now =
    typeof body.now === "number" && Number.isFinite(body.now) ? body.now : Date.now();

  if (memories.length === 0) {
    return fail("BAD_REQUEST", "还没有记忆,先去交一张照片、写一句话吧");
  }

  const system = buildLetterSystem(kind);
  const user = buildLetterUser(kind, memories, now);
  const validIds = new Set(memories.map((m) => m.id));

  try {
    let lastText = "";
    // 解析失败重试 1 次(附"上次不是合法 JSON")
    for (let attempt = 0; attempt < 2; attempt++) {
      const prompt =
        attempt === 0
          ? user
          : `${user}\n\n注意:你上一次的输出不是合法 JSON。这一次只输出 JSON 本身,不要任何解释、不要 markdown 围栏。`;

      lastText = await chat(system, prompt, { temperature: 0.8 });
      const letter = normalizeLetter(parseJsonLoose(lastText), kind, validIds);
      if (letter) {
        return Response.json({
          ok: true,
          letter: { ...letter, model: chatModelName(), degraded: false, kind, generatedAt: Date.now() },
          durationMs: Date.now() - startedAt,
        });
      }
      console.warn(
        `[letter] ${kind} JSON 解析/校验失败(第 ${attempt + 1} 次输出,${lastText.length} 字)`
      );
    }

    // 兜底:纯文本信照常能读(degraded:true,前端不渲染引用卡与发现块)
    const degraded = degradeToLetter(lastText, kind, now);
    if (degraded) {
      return Response.json({
        ok: true,
        letter: { ...degraded, model: chatModelName(), degraded: true, kind, generatedAt: Date.now() },
        durationMs: Date.now() - startedAt,
      });
    }
    return fail("UPSTREAM", "今天的信在路上,稍后再来");
  } catch (err) {
    if (err instanceof LlmError) return fail(err.code, err.message);
    console.error("[letter] 未预期错误:", err instanceof Error ? err.message : err);
    return fail("UPSTREAM", "写信的服务暂时不可用");
  }
}

// ===== 校验与规范化 =====

type Raw = Record<string, unknown>;

function isRaw(value: unknown): value is Raw {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** 过滤前端传来的非法记忆(time 异常/字段缺失),不让脏数据中断写信 */
function normalizeMemories(raw: unknown): MemoryEntry[] {
  if (!Array.isArray(raw)) return [];
  const now = Date.now();
  const out: MemoryEntry[] = [];
  for (const item of raw) {
    if (!isRaw(item)) continue;
    const id = str(item.id);
    const type = item.type;
    const time = item.time;
    if (!id) continue;
    if (type !== "photo" && type !== "text" && type !== "video") continue;
    if (typeof time !== "number" || !Number.isFinite(time) || time > now + 60_000) continue;

    const aiRaw = isRaw(item.ai) ? item.ai : null;
    const desc = aiRaw ? str(aiRaw.desc) : "";
    out.push({
      id,
      type,
      time,
      content: str(item.content) || undefined,
      ai: desc
        ? {
            desc,
            tags: Array.isArray(aiRaw!.tags)
              ? aiRaw!.tags.filter((t): t is string => typeof t === "string").slice(0, 4)
              : [],
            emotion: str(aiRaw!.emotion),
          }
        : undefined,
    });
  }
  return out;
}

/** 结构化校验:字段不缺、quote 的 memId 必须真实存在(§7.4 第一保险) */
function normalizeLetter(
  raw: Raw | null,
  kind: LetterKind,
  validIds: Set<string>
): Omit<Letter, "model" | "degraded" | "kind" | "generatedAt"> | null {
  if (!raw) return null;

  const segments: Segment[] = [];
  for (const item of Array.isArray(raw.segments) ? raw.segments : []) {
    if (!isRaw(item)) continue;

    if (item.type === "text") {
      const text = str(item.text);
      if (text) segments.push({ type: "text", text });
    } else if (item.type === "quote") {
      const memId = str(item.memId);
      const text = str(item.text);
      // 不在记忆清单里的 id 直接丢弃该段(防幻觉)
      if (text && validIds.has(memId)) segments.push({ type: "quote", memId, text });
      else if (memId) console.warn(`[letter] 丢弃无效引用 memId=${memId.slice(0, 12)}`);
    } else if (item.type === "discover") {
      const items: DiscoverItem[] = [];
      for (const d of Array.isArray(item.items) ? item.items : []) {
        if (!isRaw(d)) continue;
        const text = str(d.text);
        const k = str(d.kind);
        if (text && (k === "对比" || k === "回响" || k === "缺失")) {
          items.push({ kind: k, text });
        }
      }
      if (items.length > 0) segments.push({ type: "discover", items });
    }
  }

  if (segments.length === 0) return null; // 全空视为失败,走重试

  return {
    title: str(raw.title) || defaultTitle(kind),
    salutation: str(raw.salutation) || "致 你",
    segments,
    sign: str(raw.sign) || "—— 致你",
  };
}

/** 降级:把原始文本切成纯 text 段,信依然完整可读 */
function degradeToLetter(
  text: string,
  kind: LetterKind,
  now: number
): Omit<Letter, "model" | "degraded" | "kind" | "generatedAt"> | null {
  const clean = text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .replace(/^\s*[{}\[\],]+\s*$/gm, "")
    .replace(/"[a-zA-Z]+"\s*:/g, "")
    .replace(/[{}\[\]"]/g, "")
    .trim();

  const paragraphs = clean
    .split(/\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 1);

  if (paragraphs.length === 0) return null;

  return {
    title: defaultTitle(kind, now),
    salutation: "致 你",
    segments: paragraphs.map((text) => ({ type: "text" as const, text })),
    sign: "—— 致你",
  };
}

function defaultTitle(kind: LetterKind, now = Date.now()): string {
  if (kind === "welcome") return "给你的第一封信";
  if (kind === "weekly") return "这一周的信";
  const d = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "long",
    day: "numeric",
  }).format(now);
  return `${d}的信`;
}
