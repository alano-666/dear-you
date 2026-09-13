// 共享数据契约 —— 前后端都以本文件为准(BACKEND-致你-demo.md §8)

/** AI 对一条素材(照片/视频帧)的结构化"观察" */
export interface Observation {
  desc: string; // ≤35 字,第二人称
  tags: string[]; // 2-4 个短标签
  emotion: string; // 一个情绪词
}

/** 一条记忆(存在浏览器 localStorage,生成信件时传给服务端) */
export interface MemoryEntry {
  id: string; // "mem-" + 随机短码
  type: "photo" | "text" | "video";
  time: number; // 毫秒时间戳
  content?: string; // 用户原始文字
  thumb?: string; // 压缩缩略图 dataURL(仅前端用,不传服务端)
  ai?: Observation; // 识别失败时为空,稍后补
}

/** 信件段落 */
export type Segment =
  | { type: "text"; text: string }
  | { type: "quote"; memId: string; text: string }
  | { type: "discover"; items: DiscoverItem[] };

export interface DiscoverItem {
  kind: "对比" | "回响" | "缺失";
  text: string;
}

export type LetterKind = "welcome" | "daily" | "weekly";

export interface Letter {
  title: string;
  salutation: string;
  segments: Segment[];
  sign: string;
  model: string;
  degraded: boolean; // true = JSON 解析失败,segments 降级为纯文本段
  kind: LetterKind;
  generatedAt: number;
}

// ===== API 契约 =====

/** 业务失败不抛 5xx,统一 200 + ok:false */
export type ApiError = "UPSTREAM" | "TIMEOUT" | "BAD_IMAGE" | "NO_KEY" | "BAD_REQUEST";

export interface RecognizeRequest {
  images: string[]; // dataURL,1 张(照片)或 3 张(视频抽帧)
  kind: "photo" | "video";
  capturedAt: number;
}

export type RecognizeResponse =
  | { ok: true; observation: Observation; model: string; durationMs: number }
  | { ok: false; error: ApiError; message: string };

export interface LetterRequest {
  kind: LetterKind;
  now: number;
  memories: Pick<MemoryEntry, "id" | "type" | "time" | "content" | "ai">[];
}

export type LetterResponse =
  | { ok: true; letter: Letter; durationMs: number }
  | { ok: false; error: ApiError; message: string };
