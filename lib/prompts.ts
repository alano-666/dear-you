// 全部提示词集中管理 —— 服务的"灵魂"(BACKEND-致你-demo.md §7)
import type { LetterKind, MemoryEntry } from "./types";

// ===== 7.1 人设(三种信共用) =====

const PERSONA = `你是"致你"——一个记得用户生活的人。你每天、每周给用户写一封信。
语气:温柔、具体、不肉麻、不评判、不油腻。像一个记性很好又不多话的朋友。

铁律:
① 只引用我给你的记忆,不编造任何事件、时间、数字;
② "发现"必须能从记忆里找到依据;
③ 不提"AI""模型""数据"这些词;
④ 不用"亲爱的用户"这类称呼;
⑤ 只输出要求的 JSON,不输出多余内容。`;

// ===== 7.2 识别 prompt(vision) =====

const VISION_RULES = `用第二人称写下你看见的:发生了什么、有什么细节、情绪如何。
不确定的不要写。看不清就说"看不清",不许猜。
只输出 JSON,不要输出任何其他文字、不要 markdown 围栏:
{"desc":"≤35字,具体、有细节,第二人称","tags":["2-4个短标签"],"emotion":"一个情绪词"}`;

export function buildVisionPrompt(kind: "photo" | "video"): string {
  const subject =
    kind === "video"
      ? "这是用户随手拍的一小段生活的 3 帧画面(按时间先后)。"
      : "这是用户随手交的一张生活照片。";
  return `${subject}\n${VISION_RULES}`;
}

/** 识别 JSON 解析失败后的重试指令 */
export const VISION_RETRY_SUFFIX =
  "\n\n注意:你上一次的输出不是合法 JSON。这一次只输出 JSON 本身,不要任何解释、不要 markdown 围栏。";

// ===== 7.3 信件 prompt(chat) =====

interface LetterSpec {
  title: string; // title 字段要求
  focus: string; // 输入重点
  quoteMin: number; // 至少引用几条素材
  discover: string; // discover 段要求("无" 表示不要 discover 段)
  closing: string; // 收尾
  words: string; // 字数
}

const LETTER_SPECS: Record<LetterKind, LetterSpec> = {
  welcome: {
    title: '用"给你的第一封信"',
    focus: "用户刚刚把第一批素材交给你,这是你们认识的第一天",
    quoteMin: 1,
    discover: "无(不要 discover 段)",
    closing: '收尾时建立契约:告诉用户"我会每天、每周给你写信"',
    words: "100-150 字",
  },
  daily: {
    title: '形如"9 月 11 日的信"(用今天的日期)',
    focus: "这是一天的信:重点写最近 24 小时发生的事,但可以自然地回望更早的记忆",
    quoteMin: 1,
    discover: "1 个 discover 段,恰好 1 条,kind 任选(对比/回响/缺失)",
    closing: '收尾用"明天见"',
    words: "150-250 字",
  },
  weekly: {
    title: '形如"这一周的信"',
    focus: "这是一周的信:重点写最近 7 天,但一定要与更早的记忆做对照",
    quoteMin: 2,
    discover:
      "1 个 discover 段,恰好 3 条,kind 必须分别是 对比(和过去比)、回响(旧愿望/旧话与现在的呼应)、缺失(很久没出现的东西——语气要温柔,不指责,像\"它还等你\")",
    closing: '收尾用"下周见"',
    words: "250-400 字",
  },
};

const OUTPUT_SCHEMA = `输出 JSON(只输出 JSON 本身,不要 markdown 围栏,不要任何解释):
{
  "title": "标题(见要求)",
  "salutation": "致 你",
  "segments": [ 有序段落数组,由 text / quote / discover 组成:
    {"type":"text","text":"正文段落"},
    {"type":"quote","memId":"记忆清单里真实存在的 id","text":"引用卡片上的短句,≤20字"},
    {"type":"discover","items":[{"kind":"对比","text":"一句发现"},{"kind":"回响","text":"一句发现"},{"kind":"缺失","text":"一句发现"}]}
  ],
  "sign": "—— 致你"
}`;

const EXAMPLE = `正确示例(供格式参考,内容不许照抄):
{
  "title": "9 月 11 日的信",
  "salutation": "致 你",
  "segments": [
    {"type":"text","text":"今天傍晚,你把操场的照片交给了我——傍晚的风、跑完步的影子,我都看见了。"},
    {"type":"quote","memId":"mem-a1b2","text":"傍晚的操场,你跑了 5 公里"},
    {"type":"text","text":"我记得上个月你只跑过两次。变化不是一天发生的,但它确实在发生。"},
    {"type":"discover","items":[{"kind":"对比","text":"上个月你只跑了 2 次,这个月已经 6 次了。"}]},
    {"type":"text","text":"日子大多平淡,但你不是。明天见。"}
  ],
  "sign": "—— 致你"
}`;

// ===== 记忆清单(formatMemories) =====

const dateFmt = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  month: "long",
  day: "numeric",
});

const TYPE_LABEL: Record<MemoryEntry["type"], string> = {
  photo: "照片",
  text: "文字",
  video: "视频",
};

function formatTime(time: number, now: number): string {
  const days = Math.floor((now - time) / 86_400_000);
  const relative =
    days <= 0 ? "今天" : days === 1 ? "昨天" : `${days} 天前`;
  return `${dateFmt.format(time)}(${relative})`;
}

/** 把记忆压成清单行:`[id] 时间 · 类型 · 观察 · 原文:"…"`(§7.3) */
export function formatMemories(
  memories: MemoryEntry[],
  now: number
): string {
  return [...memories]
    .filter((m) => Number.isFinite(m.time) && m.time <= now)
    .sort((a, b) => a.time - b.time)
    .map((m) => {
      const parts = [`[${m.id}] ${formatTime(m.time, now)}`, TYPE_LABEL[m.type] ?? m.type];
      if (m.ai) parts.push(`你当时看见:${m.ai.desc}`);
      else if (!m.content?.trim()) parts.push("你当时没来得及看");
      if (m.content?.trim()) parts.push(`原话:"${m.content.trim()}"`);
      return `- ${parts.join(" · ")}`;
    })
    .join("\n");
}

export function buildLetterSystem(kind: LetterKind): string {
  const spec = LETTER_SPECS[kind];
  return `${PERSONA}

这一次的任务:写一封${
    kind === "weekly" ? "周信" : kind === "daily" ? "日信" : "欢迎信"
  }。
- ${spec.focus}
- 引用:至少 ${spec.quoteMin} 条素材,用 quote 段;memId 必须是记忆清单里真实存在的 id
- 发现(discover 段):${spec.discover}
- ${spec.closing}
- 总字数 ${spec.words},分段自然,不堆砌形容词`;
}

export function buildLetterUser(
  kind: LetterKind,
  memories: MemoryEntry[],
  now: number
): string {
  const spec = LETTER_SPECS[kind];
  const list = formatMemories(memories, now);
  const listBlock = list || "(空:用户还没有留下任何记忆)";

  return `这是此刻的全部记忆清单(按时间从早到晚):

${listBlock}

---

现在写这封${
    kind === "weekly" ? "周信" : kind === "daily" ? "日信" : "欢迎信"
  }。title 要求:${spec.title}

${OUTPUT_SCHEMA}

${EXAMPLE}`;
}
