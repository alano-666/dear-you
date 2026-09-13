// 诊断:偶发"模型没有返回文本内容"的根因(看 stop_reason 是否 = max_tokens 截断)
// 运行:pnpm dlx tsx --env-file=.env scripts/diag-stop.ts
import { buildLetterSystem, buildLetterUser } from "../lib/prompts";
import type { MemoryEntry } from "../lib/types";

const at = (y: number, mo: number, d: number, h: number) => Date.UTC(y, mo - 1, d, h - 8);
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

async function run(i: number, kind: "daily" | "weekly", maxTokens: number) {
  const t = Date.now();
  const res = await fetch(`${process.env.BAIZHI_BASE_URL}/v1/messages`, {
    method: "POST",
    headers: {
      "x-api-key": process.env.BAIZHI_API_KEY!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.TEXT_MODEL || "glm-5.3-flash",
      max_tokens: maxTokens,
      temperature: 0.8,
      system: buildLetterSystem(kind),
      messages: [{ role: "user", content: buildLetterUser(kind, MEM, NOW) }],
    }),
  });
  const dt = Date.now() - t;
  const data = (await res.json()) as {
    stop_reason?: string;
    content?: { type: string; text?: string; thinking?: string }[];
    usage?: Record<string, unknown>;
  };
  const blocks = (data.content ?? []).map(
    (b) => `${b.type}(${b.text?.length ?? b.thinking?.length ?? 0}字)`
  );
  console.log(
    `run${i} [${kind} max=${maxTokens}] ${dt}ms HTTP${res.status} stop=${data.stop_reason ?? "?"} blocks=[${blocks.join(", ")}]`
  );
  if (res.status !== 200) console.log("  ", JSON.stringify(data).slice(0, 240));
}

async function main() {
  await run(1, "daily", 4000);
  await run(2, "daily", 4000);
  await run(3, "daily", 8000);
}

main().catch(console.error);
