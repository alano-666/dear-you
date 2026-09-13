// 记忆库读写(浏览器 localStorage;服务端不存任何用户数据)
import type { Letter, MemoryEntry } from "./types";

const KEY = "dear-you:memories";
const LETTER_PREFIX = "dear-you:letter:";

export function loadMemories(): MemoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as MemoryEntry[]) : [];
  } catch {
    return [];
  }
}

export function saveMemories(list: MemoryEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // 存储满(缩略图过多)时,丢弃最早条目的缩略图重试一次
    const slim = list.map((m, i) =>
      i < list.length - 5 ? { ...m, thumb: undefined } : m
    );
    try {
      window.localStorage.setItem(KEY, JSON.stringify(slim));
    } catch {
      // 放弃:demo 场景下不阻塞
    }
  }
}

export function addMemory(entry: MemoryEntry): MemoryEntry[] {
  const next = [...loadMemories(), entry];
  saveMemories(next);
  return next;
}

export function updateMemory(id: string, patch: Partial<MemoryEntry>): MemoryEntry[] {
  const next = loadMemories().map((m) => (m.id === id ? { ...m, ...patch } : m));
  saveMemories(next);
  return next;
}

export function newMemoryId(): string {
  return "mem-" + Math.random().toString(36).slice(2, 8);
}

// ===== 信件缓存(同一周期内不重复生成:省时省钱,刷新页面即见) =====

export function loadCachedLetter(key: string): Letter | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LETTER_PREFIX + key);
    return raw ? (JSON.parse(raw) as Letter) : null;
  } catch {
    return null;
  }
}

export function saveCachedLetter(key: string, letter: Letter): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LETTER_PREFIX + key, JSON.stringify(letter));
  } catch {
    // 忽略
  }
}
