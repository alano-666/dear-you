// 验证 seed 数据能否稳定产出三类发现(跑在本地 dev server 上)
// 用法:pnpm dlx tsx scripts/seed-verify.ts
import { buildSeedMemories } from "../lib/seed";
import type { LetterResponse } from "../lib/types";

async function main() {
  const mems = buildSeedMemories();
  const times = mems.map((m) => m.time);
  const span = Math.round((Math.max(...times) - Math.min(...times)) / 86_400_000);
  console.log(`seed 数据:${mems.length} 条,跨度 ${span} 天\n`);

  for (const kind of ["daily", "weekly"] as const) {
    const t = Date.now();
    const res = await fetch("http://localhost:3000/api/letter", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind, now: Date.now(), memories: mems }),
    });
    const data = (await res.json()) as LetterResponse;
    if (!data.ok) {
      console.log(`❌ ${kind} 失败:`, JSON.stringify(data));
      continue;
    }
    const l = data.letter;
    const kinds = l.segments
      .filter((s) => s.type === "discover")
      .flatMap((s) => (s.type === "discover" ? s.items.map((i) => i.kind) : []));
    const quotes = l.segments.filter((s) => s.type === "quote").length;

    console.log(`=== ${kind}  ${((Date.now() - t) / 1000).toFixed(1)}s  degraded:${l.degraded}  引用 ${quotes} 条  发现 [${kinds.join(",")}] ===`);
    for (const s of l.segments) {
      if (s.type === "text") console.log("  " + s.text);
      else if (s.type === "quote") console.log(`  〔引用 ${s.memId}〕${s.text}`);
      else for (const i of s.items) console.log(`  〔${i.kind}〕${i.text}`);
    }
    console.log();
  }
}

main().catch(console.error);
