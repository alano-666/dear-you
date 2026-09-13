// B1 冒烟测试:验证 lib/llm.ts 两条通道真实可用
// 运行:pnpm dlx tsx --env-file=.env scripts/llm-smoke.ts
import { chat, vision } from "../lib/llm";

// 1x1 像素 PNG(仅验证链路连通,模型应回答"看不清"而非编造)
const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

async function main() {
  console.log("—— vision 通道(智谱)——");
  let t = Date.now();
  const v = await vision(
    [TINY_PNG],
    '看这张图片,用第二人称写下你看见的。输出 JSON:{"desc":"≤35字","tags":["短标签"],"emotion":"一个情绪词"}\n不确定的不要写,看不清就说"看不清",不许猜。'
  );
  console.log(`  ${Date.now() - t}ms | ${v.slice(0, 200)}`);

  console.log("—— chat 通道(百智云,验证 thinking 过滤)——");
  t = Date.now();
  const c = await chat('你是测试助手,严格只输出 JSON,不输出任何其他内容。', '输出:{"hello":"你好","ok":true}');
  console.log(`  ${Date.now() - t}ms | ${c.slice(0, 300)}`);

  console.log("\n✅ B1 冒烟通过:两条通道均返回文本");
}

main().catch((err) => {
  console.error("\n❌ 冒烟失败:", err);
  process.exit(1);
});
