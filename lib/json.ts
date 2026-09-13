// 宽松 JSON 解析:模型输出常带 ```json 围栏或前后废话,这里尽最大努力取出对象。
export function parseJsonLoose(text: string): Record<string, unknown> | null {
  const cleaned = text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  try {
    const direct = JSON.parse(cleaned) as unknown;
    if (isRecord(direct)) return direct;
  } catch {
    // 继续尝试截取
  }

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      const sliced = JSON.parse(cleaned.slice(start, end + 1)) as unknown;
      if (isRecord(sliced)) return sliced;
    } catch {
      // 放弃
    }
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
