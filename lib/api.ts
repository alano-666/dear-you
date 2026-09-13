// API 路由共享小工具:统一失败响应格式(200 + ok:false)与图片校验
import type { ApiError } from "./types";

export const MAX_IMAGES = 3;
/** 单张图片上限:1.5MB(服务端红线,§10-2) */
export const MAX_IMAGE_BYTES = 1.5 * 1024 * 1024;

/** 业务失败不抛 5xx:统一 200 + ok:false,前端处理分支单一 */
export function fail(error: ApiError, message: string): Response {
  return Response.json({ ok: false, error, message });
}

const DATA_IMAGE_RE = /^data:image\/(jpeg|jpg|png|webp|gif);base64,/i;

export function isDataImage(value: unknown): value is string {
  return typeof value === "string" && DATA_IMAGE_RE.test(value);
}

/** 从 dataURL 估算原始字节数(只做校验,不落盘、不打印内容) */
export function dataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(",");
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : "";
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - padding;
}
