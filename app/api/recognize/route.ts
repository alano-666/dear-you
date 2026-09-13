// 接口 1:POST /api/recognize —— 把照片/视频帧变成一条结构化"观察"(§4)
import { fail, dataUrlBytes, isDataImage, MAX_IMAGES, MAX_IMAGE_BYTES } from "@/lib/api";
import { parseJsonLoose } from "@/lib/json";
import { LlmError, vision, visionModelName } from "@/lib/llm";
import { buildVisionPrompt, VISION_RETRY_SUFFIX } from "@/lib/prompts";
import type { Observation, RecognizeRequest } from "@/lib/types";

export const maxDuration = 60;

export async function POST(req: Request) {
  const startedAt = Date.now();

  let body: Partial<RecognizeRequest>;
  try {
    body = (await req.json()) as Partial<RecognizeRequest>;
  } catch {
    return fail("BAD_REQUEST", "请求体不是合法 JSON");
  }

  const kind = body.kind === "video" ? "video" : "photo";
  const images = Array.isArray(body.images) ? body.images : [];

  if (images.length === 0) return fail("BAD_IMAGE", "没有收到图片");
  if (images.length > MAX_IMAGES) return fail("BAD_REQUEST", `一次最多 ${MAX_IMAGES} 张图片`);
  if (!images.every(isDataImage)) {
    return fail("BAD_IMAGE", "图片格式不支持(需要 jpeg/png/webp 的 base64)");
  }
  if (images.some((img) => dataUrlBytes(img) > MAX_IMAGE_BYTES)) {
    return fail("BAD_IMAGE", "单张图片超过 1.5MB,请压缩后再试");
  }

  const prompt = buildVisionPrompt(kind);

  try {
    // 解析失败重试 1 次(附"上次不是合法 JSON"),仍失败则报 UPSTREAM
    for (let attempt = 0; attempt < 2; attempt++) {
      const text = await vision(images, attempt === 0 ? prompt : prompt + VISION_RETRY_SUFFIX);
      const observation = normalizeObservation(parseJsonLoose(text));
      if (observation) {
        return Response.json({
          ok: true,
          observation,
          model: visionModelName(),
          durationMs: Date.now() - startedAt,
        });
      }
      console.warn(`[recognize] JSON 解析失败(第 ${attempt + 1} 次输出,${text.length} 字)`);
    }
    return fail("UPSTREAM", "这次没看清,稍后可以重试");
  } catch (err) {
    if (err instanceof LlmError) return fail(err.code, err.message);
    console.error("[recognize] 未预期错误:", err instanceof Error ? err.message : err);
    return fail("UPSTREAM", "识别服务暂时不可用");
  }
}

/** 宽容规范化:desc 必须有,其余字段尽量保留;desc 截到 35 字(UI 契约) */
function normalizeObservation(raw: Record<string, unknown> | null): Observation | null {
  if (!raw) return null;

  const desc = typeof raw.desc === "string" ? raw.desc.trim() : "";
  if (!desc) return null;

  const tags = (Array.isArray(raw.tags) ? raw.tags : [])
    .filter((t): t is string => typeof t === "string")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 4);

  const emotion = typeof raw.emotion === "string" ? raw.emotion.trim() : "";

  return {
    desc: [...desc].slice(0, 35).join(""),
    tags,
    emotion,
  };
}
