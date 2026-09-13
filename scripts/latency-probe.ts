// 延迟探测:找出最短的写信耗时组合(thinking 开关 / 模型选择)
// 运行:pnpm dlx tsx --env-file=.env scripts/latency-probe.ts
const BASE = process.env.BAIZHI_BASE_URL!;
const KEY = process.env.BAIZHI_API_KEY!;

const SYSTEM =
  "你是\"致你\"——一个记得用户生活的人。语气温柔、具体、不肉麻。只输出要求的 JSON。";
const USER = `记忆清单:
- [mem-1] 8月25日(17 天前) · 照片 · 你把吉他擦了擦,弹了一小段熟悉的曲子
- [mem-2] 9月2日(9 天前) · 照片 · 傍晚的操场,你跑了 3 公里
- [mem-3] 9月8日(3 天前) · 照片 · 傍晚的操场,你跑了 5 公里

写一封周信。输出 JSON:{"title":"这一周的信","salutation":"致 你","segments":[{"type":"text","text":"..."},{"type":"quote","memId":"mem-x","text":"≤20字"},{"type":"discover","items":[{"kind":"对比","text":"..."},{"kind":"回响","text":"..."},{"kind":"缺失","text":"..."}]}],"sign":"—— 致你"}`;

interface Probe {
  label: string;
  model: string;
  extra?: Record<string, unknown>;
}

const probes: Probe[] = [
  { label: "glm-5.3-flash 默认        ", model: "glm-5.3-flash" },
  { label: "glm-5.3-flash 关thinking  ", model: "glm-5.3-flash", extra: { thinking: { type: "disabled" } } },
  { label: "glm-5.3-flash 限512预算   ", model: "glm-5.3-flash", extra: { thinking: { type: "enabled", budget_tokens: 512 } } },
  { label: "glm-5.3-flash 不传thinking参数", model: "glm-5.3-flash", extra: { temperature: 0.8 } },
  { label: "deepseek-v4-pro 默认      ", model: "deepseek-v4-pro" },
];

async function probe(p: Probe) {
  const t = Date.now();
  try {
    const res = await fetch(`${BASE}/v1/messages`, {
      method: "POST",
      headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: p.model,
        max_tokens: 4000,
        system: SYSTEM,
        messages: [{ role: "user", content: USER }],
        ...(p.extra ?? {}),
      }),
    });
    const dt = Date.now() - t;
    if (!res.ok) {
      console.log(`${p.label} | HTTP ${res.status} | ${(await res.text()).slice(0, 120)}`);
      return;
    }
    const data = (await res.json()) as {
      usage?: Record<string, number>;
      content?: { type: string; text?: string; thinking?: string }[];
    };
    const blocks = data.content ?? [];
    const textLen = blocks.filter((b) => b.type === "text").reduce((n, b) => n + (b.text?.length ?? 0), 0);
    const thinkLen = blocks.filter((b) => b.type === "thinking").reduce((n, b) => n + (b.thinking?.length ?? 0), 0);
    console.log(
      `${p.label} | ${String(dt).padStart(6)}ms | blocks: ${blocks.map((b) => b.type).join("+") || "-"} | ` +
        `text ${textLen}字 thinking ${thinkLen}字 | usage ${JSON.stringify(data.usage ?? {})}`
    );
  } catch (err) {
    console.log(`${p.label} | 失败: ${err instanceof Error ? err.message : err}`);
  }
}

async function main() {
  for (const p of probes) await probe(p);
}

main().catch(console.error);
