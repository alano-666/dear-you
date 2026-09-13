// B6 错误路径验证:NO_KEY / UPSTREAM(不可达)/ 快速失败(断网演练用)
// 运行:pnpm dlx tsx --env-file=.env scripts/error-paths.ts
import { chat, LlmError, vision } from "../lib/llm";

async function expectError(name: string, fn: () => Promise<unknown>, code: string) {
  const t = Date.now();
  try {
    await fn();
    console.log(`❌ ${name}: 期望抛 ${code},实际成功了`);
  } catch (err) {
    const dt = Date.now() - t;
    if (err instanceof LlmError && err.code === code) {
      console.log(`✅ ${name}: ${err.code} "${err.message}"(${dt}ms)`);
    } else {
      console.log(`❌ ${name}: 期望 ${code},实际`, err);
    }
  }
}

async function main() {
  const goodChatKey = process.env.BAIZHI_API_KEY;
  const goodVisionKey = process.env.ZHIPU_API_KEY;
  const goodChatBase = process.env.BAIZHI_BASE_URL;

  process.env.BAIZHI_API_KEY = "";
  await expectError("chat 无密钥", () => chat("s", "u"), "NO_KEY");

  process.env.ZHIPU_API_KEY = "";
  await expectError("vision 无密钥", () => vision(["data:image/png;base64,AA=="], "p"), "NO_KEY");

  // 断网/不可达:应重试 1 次后快速失败(前端据此切备用信),不拖 60s
  process.env.BAIZHI_API_KEY = goodChatKey;
  process.env.ZHIPU_API_KEY = goodVisionKey;
  process.env.BAIZHI_BASE_URL = "http://127.0.0.1:9/api/anthropic";
  await expectError("chat 服务不可达", () => chat("s", "u"), "UPSTREAM");

  process.env.BAIZHI_BASE_URL = goodChatBase;
}

main();
