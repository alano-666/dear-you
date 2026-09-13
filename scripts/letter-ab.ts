// 信件 A/B 对比实验:当前生产 prompt(A) vs 改进版 prompt(B)
// 运行:pnpm dlx tsx --env-file=.env scripts/letter-ab.ts
// 输出:docs/2026-09-11-信件AB对比.md
import { writeFileSync } from "node:fs";
import { parseJsonLoose } from "../lib/json";
import { chat } from "../lib/llm";
import { buildLetterSystem, buildLetterUser, formatMemories } from "../lib/prompts";
import type { LetterKind, MemoryEntry } from "../lib/types";

// ===== 实验数据 =====

const at = (y: number, mo: number, d: number, h: number, mi = 0) =>
  Date.UTC(y, mo - 1, d, h - 8, mi); // CST → UTC
const NOW = at(2026, 9, 11, 20);

const MEM: MemoryEntry[] = [
  { id: "mem-aug20", type: "text", time: at(2026, 8, 20, 22), content: "想把日子过慢一点",
    ai: { desc: "写下了一个愿望", tags: ["愿望", "生活"], emotion: "平静" } },
  { id: "mem-aug25", type: "photo", time: at(2026, 8, 25, 20),
    ai: { desc: "你把吉他擦了擦,弹了一小段熟悉的曲子", tags: ["吉他", "音乐"], emotion: "放松" } },
  { id: "mem-sep02", type: "photo", time: at(2026, 9, 2, 19),
    ai: { desc: "傍晚的操场,你跑了 3 公里", tags: ["跑步", "傍晚"], emotion: "有点累" } },
  { id: "mem-sep08", type: "photo", time: at(2026, 9, 8, 19),
    ai: { desc: "傍晚的操场,你跑了 5 公里,比上次多了", tags: ["跑步", "傍晚"], emotion: "满足" } },
  { id: "mem-sep10", type: "text", time: at(2026, 9, 10, 23), content: "今天很累,但还是读完了一章书",
    ai: { desc: "在疲惫里读完了书的一章", tags: ["阅读", "夜晚"], emotion: "倔强" } },
  { id: "mem-sep11", type: "photo", time: at(2026, 9, 11, 18),
    ai: { desc: "傍晚的操场,你跑了 5 公里", tags: ["跑步", "傍晚"], emotion: "满足" } },
];

// ===== B 版 prompt(实验;不进生产) =====

const B_PERSONA = `你是"致你"——一个记得用户生活的人。你每天、每周给用户写一封信。
语气:温柔、具体、克制。像一个记性很好、话不多、但句句都落地的朋友。

【你不做的事】
① 不编造任何事件、时间、数字——每句话都要能在记忆清单里找到来源;
② 不说"加油""你真棒""我为你骄傲"这类空话,不替用户高兴、难过或遗憾;
③ 不总结人生道理、不替用户下结论——升华留给用户自己完成;
④ 不提"AI""模型""数据";
⑤ 不用"亲爱的用户"这类称呼;
⑥ 只输出要求的 JSON。

【你做的事——让信有分量】
① 原话优先:记忆里有用户原话时,优先用原话做引用。用户自己都忘了的话被原样还回来,是一封信里最重的东西。
② "我"在场:可以用"我"承载记忆与等待("你那天写的话,我还留着""它还在等你")。但"我"只做见证者,不做啦啦队——"我"不评价、不感叹。
③ 发现落到"人"上,不停在数字上。
④ 结尾留白:最后一句话不总结、不鼓励,用一个来自记忆的具体、温柔、开放的事实或画面收尾。

【三类发现的写法:从"事情"落回到"人"】
- 对比(和过去比)——让数据说出一件关于"这个人"的事,而不是报数字
  ✗ 你这个月跑了 6 次,上个月只有 2 次
  ✓ 这个月第六次了。有些变化不写在日历上,写在一个人的傍晚里。
- 回响(旧话与现在的呼应)——尽量原样复述用户的话,让时间落差自己说话
  ✗ 你以前说想把日子过慢一点,现在你真的在慢慢过了
  ✓ 八月你写下「想把日子过慢一点」。你大概没想到,它最后是从跑鞋和书页开始的。
- 缺失(很久没出现的)——指向那个"曾经的自己",不是物品也不是任务
  ✗ 你很久没弹吉他了,记得练
  ✓ 那把吉他停在八月。它没走,它只是在等你想起它。

【这封信的入口】(按给定的入口进入,不要在信里解释入口)`;

const ENTRANCES = [
  "从最近一条记忆里的一个具体细节进入",
  "从用户的一句原话进入(优先选有原话的记忆)",
  "从一个时间对照进入:先提过去的某件小事,再说到现在",
];

const B_SCHEMA = `输出 JSON(只输出 JSON 本身,不要 markdown 围栏,不要任何解释):
{
  "title": "标题(见要求)",
  "salutation": "致 你",
  "segments": [ 有序段落数组,由 text / quote / discover 组成:
    {"type":"text","text":"正文段落"},
    {"type":"quote","memId":"必须从记忆清单里选真实存在的 id","text":"引用卡片上的短句,≤20字"},
    {"type":"discover","items":[{"kind":"对比","text":"一句发现"},{"kind":"回响","text":"一句发现"},{"kind":"缺失","text":"一句发现"}]}
  ],
  "sign": "—— 致你"
}`;

const B_EXAMPLE = `示例(只示范段落写法与语气,段落组成以任务要求为准;memId/时间/数字必须取自本次记忆清单,不许照抄):
{
  "title": "这一周的信",
  "salutation": "致 你",
  "segments": [
    {"type":"text","text":"这周你又在傍晚出门了。操场边的风、跑完之后的分钟数,我都替你收着。"},
    {"type":"quote","memId":"mem-a1b2","text":"这条记忆的短句"},
    {"type":"text","text":"累的时候最容易放过自己。你没有。"},
    {"type":"discover","items":[
      {"kind":"对比","text":"这个月第六次了。有些变化不写在日历上,写在一个人的傍晚里。"},
      {"kind":"回响","text":"八月你写下「想把日子过慢一点」。你大概没想到,它是从跑鞋和书页开始的。"},
      {"kind":"缺失","text":"那把吉他停在八月。它没走,它只是在等你想起它。"}
    ]},
    {"type":"text","text":"傍晚的操场还在那儿。下周见。"}
  ],
  "sign": "—— 致你"
}`;

const B_SPEC: Record<LetterKind, { focus: string; quoteMin: number; discover: string; closing: string; words: string; title: string }> = {
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
    discover: "1 个 discover 段,恰好 1 条,kind 任选(按上面的写法写)",
    closing: '收尾用"明天见"',
    words: "150-250 字",
  },
  weekly: {
    title: '形如"这一周的信"',
    focus: "这是一周的信:重点写最近 7 天,但一定要与更早的记忆做对照",
    quoteMin: 2,
    discover: "1 个 discover 段,恰好 3 条,kind 必须分别是 对比、回响、缺失(按上面的写法写)",
    closing: '收尾用"下周见"',
    words: "250-400 字",
  },
};

const KIND_NAME = { welcome: "欢迎信", daily: "日信", weekly: "周信" } as const;

function buildBSystem(kind: LetterKind, entrance: string): string {
  const s = B_SPEC[kind];
  return `${B_PERSONA}
${entrance}

这一次的任务:写一封${KIND_NAME[kind]}。
- ${s.focus}
- 引用:至少 ${s.quoteMin} 条素材,用 quote 段;有原话的记忆优先
- 发现(discover 段):${s.discover}
- ${s.closing}
- 总字数 ${s.words},分段自然`;
}

function buildBUser(kind: LetterKind, memories: MemoryEntry[], now: number): string {
  const list = formatMemories(memories, now);
  return `这是此刻的全部记忆清单(按时间从早到晚):

${list}

---

现在写这封${KIND_NAME[kind]}。title 要求:${B_SPEC[kind].title}

${B_SCHEMA}

${B_EXAMPLE}`;
}

// ===== 运行与渲染 =====

function render(label: string, raw: string, ms: number): string {
  const parsed = parseJsonLoose(raw);
  const head = `### ${label}  (${(ms / 1000).toFixed(1)}s)\n`;
  if (!parsed) return `${head}\n> ⚠️ JSON 解析失败,原始输出:\n\n\`\`\`\n${raw}\n\`\`\`\n`;

  const segs = (parsed.segments as { type: string; text?: string; memId?: string; items?: { kind: string; text: string }[] }[]) ?? [];
  const lines: string[] = [
    head,
    `**${parsed.title}**`,
    "",
    `${parsed.salutation}`,
    "",
  ];
  for (const s of segs) {
    if (s.type === "text") lines.push(`　${s.text}`, "");
    else if (s.type === "quote") lines.push(`　〔引用 ${s.memId}〕${s.text}`, "");
    else lines.push(`　〔发现〕` + (s.items ?? []).map((i) => `[${i.kind}] ${i.text}`).join("　"), "");
  }
  lines.push(`${parsed.sign}`, "");
  return lines.join("\n");
}

async function main() {
  const out: string[] = [
    "# 信件 A/B 对比实验(2026-09-11)",
    "",
    "**变量**:同一组记忆、同一模型(glm-5.3-flash)、temperature 0.8;唯一差异是 prompt。",
    "",
    "- **A 版** = 当前生产 prompt(`lib/prompts.ts`)",
    "- **B 版** = 实验 prompt:原话优先 + 三类发现靶心示例 + \"我\"作为见证者 + 结尾留白 + 随机入口",
    "",
    "---",
    "",
  ];

  for (const kind of ["daily", "weekly"] as const) {
    const entrance = ENTRANCES[Math.floor(Math.random() * ENTRANCES.length)];
    console.log(`生成 ${KIND_NAME[kind]} …(B 版入口:${entrance})`);

    let t = Date.now();
    const rawA = await chat(buildLetterSystem(kind), buildLetterUser(kind, MEM, NOW), { temperature: 0.8 });
    const msA = Date.now() - t;

    t = Date.now();
    const rawB = await chat(buildBSystem(kind, entrance), buildBUser(kind, MEM, NOW), { temperature: 0.8 });
    const msB = Date.now() - t;

    out.push(`## ${KIND_NAME[kind]}`, "", render("A 版 · 当前生产 prompt", rawA, msA), render(`B 版 · 实验 prompt(入口:${entrance})`, rawB, msB), "---", "");
    console.log(`  A ${(msA / 1000).toFixed(1)}s / B ${(msB / 1000).toFixed(1)}s`);
  }

  const path = "docs/2026-09-11-信件AB对比.md";
  writeFileSync(path, out.join("\n"), "utf8");
  console.log(`\n✅ 已写入 ${path}`);
}

main().catch((err) => {
  console.error("实验失败:", err);
  process.exit(1);
});
