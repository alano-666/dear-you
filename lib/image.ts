// 客户端图片压缩 / 视频抽帧(不依赖 ffmpeg,全部在浏览器完成)

/** 压缩图片为 dataURL(最长边 ≤ maxEdge,JPEG) */
export async function compressImage(
  file: File,
  maxEdge = 1280,
  quality = 0.82
): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法创建画布");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  return canvas.toDataURL("image/jpeg", quality);
}

/** 从视频抽取 n 帧(默认首/中/尾),返回 dataURL 数组 */
export async function extractVideoFrames(
  file: File,
  count = 3,
  maxEdge = 1024
): Promise<string[]> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("视频无法读取"));
    });

    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 1;
    const positions =
      count <= 1 ? [0] : Array.from({ length: count }, (_, i) => (duration * (i + 0.5)) / count);

    const scale = Math.min(1, maxEdge / Math.max(video.videoWidth || maxEdge, video.videoHeight || maxEdge));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round((video.videoWidth || maxEdge) * scale));
    canvas.height = Math.max(1, Math.round((video.videoHeight || maxEdge) * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("无法创建画布");

    const frames: string[] = [];
    for (const t of positions) {
      await new Promise<void>((resolve, reject) => {
        const onSeeked = () => {
          video.removeEventListener("seeked", onSeeked);
          resolve();
        };
        video.addEventListener("seeked", onSeeked);
        video.onerror = () => reject(new Error("视频抽帧失败"));
        video.currentTime = Math.min(Math.max(t, 0), Math.max(duration - 0.05, 0));
      });
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      frames.push(canvas.toDataURL("image/jpeg", 0.8));
    }
    return frames;
  } finally {
    URL.revokeObjectURL(url);
    video.removeAttribute("src");
  }
}

export function formatMemTime(time: number): string {
  const d = new Date(time);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function formatMemDay(time: number): string {
  const d = new Date(time);
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日`;
}
