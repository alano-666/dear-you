// 模型抽象层 —— 铁律:页面与 route 代码不允许直接调任何 AI 供应商,所有模型调用只经过这里。
// 换模型/换供应商,只改本文件 + .env(BACKEND-致你-demo.md §6)。

export type LlmErrorCode = "NO_KEY" | "TIMEOUT" | "UPSTREAM";

export class LlmError extends Error {
  code: LlmErrorCode;
  constructor(code: LlmErrorCode, message: string) {
    super(message);
    this.name = "LlmError";
    this.code = code;
  }
}

const VISION_TIMEOUT_MS = 30_000;
const CHAT_TIMEOUT_MS = 60_000;
const RETRY_DELAY_MS = 1_000;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new LlmError("NO_KEY", `缺少环境变量 ${name}(检查 .env)`);
  return value;
}

function endpoint(base: string, path: string): string {
  return `${base.replace(/\/+$/, "")}${path}`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 只记录长度,不打印内容本身(日志纪律,§10-3) */
function truncate(text: string, max = 200): string {
  return text.length > max ? `${text.slice(0, max)}…(${text.length}字)` : text;
}

interface PostOptions {
  url: string;
  headers: Record<string, string>;
  body: unknown;
  timeoutMs: number;
}

/**
 * 统一 POST:超时(AbortController)+ 重试。
 * 重试策略:网络错误 / 5xx / 429 重试 1 次(退避 1s);超时与 4xx 参数错误不重试。
 */
async function postJson(options: PostOptions): Promise<unknown> {
  const { url, headers, body, timeoutMs } = options;

  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        const retriable = res.status >= 500 || res.status === 429;
        if (retriable && attempt === 0) {
          await sleep(RETRY_DELAY_MS);
          continue;
        }
        throw new LlmError("UPSTREAM", `上游返回 ${res.status}: ${truncate(detail)}`);
      }

      return (await res.json()) as unknown;
    } catch (err) {
      if (err instanceof LlmError) throw err;
      if (err instanceof Error && err.name === "AbortError") {
        throw new LlmError("TIMEOUT", `模型响应超时(${timeoutMs / 1000}s)`);
      }
      // 网络类错误(连接失败、DNS、socket 中断等)
      if (attempt === 0) {
        await sleep(RETRY_DELAY_MS);
        continue;
      }
      throw new LlmError("UPSTREAM", "无法连接模型服务");
    } finally {
      clearTimeout(timer);
    }
  }
  // 循环必然以 return 或 throw 结束,这里仅为类型完整
  throw new LlmError("UPSTREAM", "请求模型服务失败");
}

/** content 字段可能是 string,也可能是 content 块数组,统一取文本 */
function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((b): b is { type: string; text?: string } => typeof b === "object" && b !== null)
      .filter((b) => b.type === "text" && typeof b.text === "string")
      .map((b) => b.text)
      .join("");
  }
  return "";
}

/** 当前使用的模型名(写入响应,便于演示时展示与排查) */
export const visionModelName = () => process.env.VISION_MODEL || "glm-4v-flash";
export const chatModelName = () => process.env.TEXT_MODEL || "glm-5.3-flash";

/**
 * 视觉识别:调视觉模型,返回原始文本(调用方负责解析)。
 * @param images dataURL 数组,1 张(照片)或 3 张(视频抽帧)
 * @param prompt 全部识别指令(人设 + 任务,来自 prompts.ts)
 */
export async function vision(images: string[], prompt: string): Promise<string> {
  const key = requireEnv("ZHIPU_API_KEY");
  const base = process.env.ZHIPU_BASE_URL || "https://open.bigmodel.cn/api/paas/v4";
  const model = visionModelName();

  const data = (await postJson({
    url: endpoint(base, "/chat/completions"),
    headers: { authorization: `Bearer ${key}` },
    body: {
      model,
      messages: [
        {
          role: "user",
          content: [
            ...images.map((img) => ({ type: "image_url", image_url: { url: img } })),
            { type: "text", text: prompt },
          ],
        },
      ],
    },
    timeoutMs: VISION_TIMEOUT_MS,
  })) as {
    choices?: { message?: { content?: unknown } }[];
  };

  const text = extractText(data?.choices?.[0]?.message?.content);
  if (!text.trim()) throw new LlmError("UPSTREAM", "模型没有返回文本内容");
  return text;
}

export interface ChatOptions {
  maxTokens?: number;
  temperature?: number;
}

/**
 * 文本生成:调文本模型,返回纯文本(自动过滤 thinking 块并拼接多 content 块)。
 * 偶发:模型可能只输出 thinking 不写正文 → 空文本自动重试 1 次。
 */
export async function chat(system: string, user: string, opts: ChatOptions = {}): Promise<string> {
  const key = requireEnv("BAIZHI_API_KEY");
  const base = requireEnv("BAIZHI_BASE_URL");
  const model = chatModelName();

  for (let attempt = 0; attempt < 2; attempt++) {
    const data = (await postJson({
      url: endpoint(base, "/v1/messages"),
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: {
        model,
        // 网关强制 thinking,思考会吃掉大量预算;4000 时常被截断(模型想完没写正文),8000 实测足够
        max_tokens: opts.maxTokens ?? 8000,
        temperature: opts.temperature ?? 0.8,
        system,
        messages: [{ role: "user", content: user }],
      },
      timeoutMs: CHAT_TIMEOUT_MS,
    })) as { content?: { type?: string; text?: string }[]; stop_reason?: string };

    // ⚠️ 百智云响应 content[] 可能含 thinking 块,必须过滤 type==="text" 再拼接
    const text = extractText(data?.content);
    if (text.trim()) return text;

    // 只记录结构信息,不打印内容(日志纪律)
    const blocks = Array.isArray(data?.content)
      ? data.content.map((b) => b?.type ?? "?").join(",")
      : "none";
    console.warn(
      `[llm] chat 返回空文本(第 ${attempt + 1} 次,stop=${data?.stop_reason ?? "?"}, blocks=${blocks})`
    );
    if (attempt === 1) {
      throw new LlmError(
        "UPSTREAM",
        `模型没有返回文本内容(stop=${data?.stop_reason ?? "?"}, blocks=${blocks})`
      );
    }
  }
  throw new LlmError("UPSTREAM", "模型没有返回文本内容");
}
