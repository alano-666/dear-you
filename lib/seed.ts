// 示例生活:一键填充 30 天的演示记忆(带埋点,让三类发现必然出现)
// 埋点设计:28 天前的旧愿望 → 回响;25 天前的吉他后再未出现 → 缺失;跑步 3km → 5km → 对比
import type { MemoryEntry } from "./types";
import { saveMemories } from "./memory";

interface SeedItem {
  daysAgo: number;
  hour: number;
  type: "photo" | "text" | "video";
  content?: string;
  desc?: string;
  tags?: string[];
  emotion?: string;
  scene?: SceneKey;
}

const SEED: SeedItem[] = [
  { daysAgo: 28, hour: 22, type: "text", content: "想把日子过慢一点", desc: "写下了一个愿望", tags: ["愿望", "夜晚"], emotion: "平静" },
  { daysAgo: 25, hour: 20, type: "photo", scene: "guitar", desc: "你把吉他擦了擦,弹了一小段熟悉的曲子", tags: ["吉他", "音乐"], emotion: "放松" },
  { daysAgo: 23, hour: 9, type: "photo", scene: "coffee", desc: "清早的第一杯咖啡,你拍了张照", tags: ["咖啡", "早晨"], emotion: "清醒" },
  { daysAgo: 21, hour: 19, type: "photo", scene: "sunset", desc: "下班路上遇到晚霞,你停下来看了一会儿", tags: ["晚霞", "下班"], emotion: "松弛" },
  { daysAgo: 18, hour: 23, type: "text", content: "最近睡得有点晚,但事情都在往前走", desc: "写下了近况", tags: ["夜晚", "自省"], emotion: "平静" },
  { daysAgo: 16, hour: 12, type: "photo", scene: "dinner", desc: "和朋友吃了顿饭,桌上有说有笑", tags: ["朋友", "聚餐"], emotion: "开心" },
  { daysAgo: 14, hour: 8, type: "photo", scene: "book", desc: "早晨的阳光里,你翻开了一本书", tags: ["阅读", "早晨"], emotion: "安宁" },
  { daysAgo: 12, hour: 20, type: "photo", scene: "rain", desc: "下雨的傍晚,你在窗边坐了很久", tags: ["雨天", "窗边"], emotion: "安静" },
  { daysAgo: 9, hour: 19, type: "photo", scene: "track", desc: "傍晚的操场,你跑了 3 公里", tags: ["跑步", "傍晚"], emotion: "有点累" },
  { daysAgo: 7, hour: 22, type: "photo", scene: "book", desc: "睡前读完了半本书,很专注", tags: ["阅读", "夜晚"], emotion: "满足" },
  { daysAgo: 5, hour: 13, type: "photo", scene: "plants", desc: "窗台的绿萝冒出了一片新叶", tags: ["植物", "窗台"], emotion: "惊喜" },
  { daysAgo: 4, hour: 15, type: "text", content: "今天把拖了很久的事做完了", desc: "完成了一件积压的事", tags: ["完成", "轻松"], emotion: "释然" },
  { daysAgo: 3, hour: 19, type: "photo", scene: "track", desc: "傍晚的操场,你跑了 5 公里,比上次多了", tags: ["跑步", "傍晚"], emotion: "满足" },
  { daysAgo: 2, hour: 21, type: "photo", scene: "cat", desc: "楼下的猫又来了,你在台阶上坐了一会儿", tags: ["猫", "夜晚"], emotion: "温柔" },
  { daysAgo: 1, hour: 23, type: "photo", scene: "desk", desc: "深夜的书桌,灯还亮着", tags: ["深夜", "书桌"], emotion: "专注" },
];

// ===== 缩略图:程序生成的极简插画(SVG,离线可用,不依赖外部图片) =====

type SceneKey =
  | "guitar" | "coffee" | "sunset" | "dinner" | "book"
  | "rain" | "track" | "plants" | "cat" | "desk";

const SCENES: Record<SceneKey, { from: string; to: string; art: string }> = {
  guitar: {
    from: "#d9b98c", to: "#a3763f",
    art: `<circle cx="205" cy="190" r="62" fill="#f4e3c6" opacity="0.92"/><circle cx="205" cy="190" r="24" fill="#a3763f" opacity="0.55"/><rect x="88" y="118" width="34" height="150" rx="10" transform="rotate(24 105 193)" fill="#f4e3c6" opacity="0.92"/>`,
  },
  coffee: {
    from: "#e8d6c0", to: "#9c6b4a",
    art: `<ellipse cx="160" cy="185" rx="70" ry="24" fill="#fdf8f0" opacity="0.95"/><path d="M96 185c0 34 24 56 64 56s64-22 64-56" fill="#fdf8f0" opacity="0.9"/><circle cx="238" cy="205" r="22" fill="none" stroke="#fdf8f0" stroke-width="9" opacity="0.9"/>`,
  },
  sunset: {
    from: "#f3b57c", to: "#7d6a9e",
    art: `<circle cx="160" cy="196" r="52" fill="#fdf3dd" opacity="0.95"/><rect x="40" y="248" width="240" height="5" rx="2.5" fill="#fdf3dd" opacity="0.6"/><rect x="86" y="264" width="148" height="5" rx="2.5" fill="#fdf3dd" opacity="0.4"/>`,
  },
  dinner: {
    from: "#f0c98f", to: "#b06a4a",
    art: `<circle cx="118" cy="188" r="46" fill="#fdf6e8" opacity="0.95"/><circle cx="212" cy="172" r="34" fill="#fdf6e8" opacity="0.85"/><circle cx="196" cy="242" r="22" fill="#fdf6e8" opacity="0.7"/>`,
  },
  book: {
    from: "#f2e7cf", to: "#c49a68",
    art: `<path d="M74 220c34-22 62-22 86 0 24-22 52-22 86 0V118c-34-20-62-20-86 0-24-20-52-20-86 0z" fill="#fdfaf2" opacity="0.95"/><path d="M160 120v100" stroke="#c49a68" stroke-width="4" opacity="0.6"/>`,
  },
  rain: {
    from: "#9fb4c8", to: "#4a637a",
    art: `<path d="M96 96l-16 40M140 88l-18 46M186 96l-16 40M232 88l-18 46" stroke="#f2f7fa" stroke-width="7" stroke-linecap="round" opacity="0.75"/><rect x="58" y="212" width="204" height="8" rx="4" fill="#f2f7fa" opacity="0.5"/>`,
  },
  track: {
    from: "#8fc0a9", to: "#2f6f5e",
    art: `<ellipse cx="160" cy="214" rx="112" ry="52" fill="none" stroke="#fdfcfa" stroke-width="11" opacity="0.9"/><ellipse cx="160" cy="214" rx="66" ry="26" fill="none" stroke="#fdfcfa" stroke-width="5" opacity="0.55"/>`,
  },
  plants: {
    from: "#a8cf9a", to: "#4a7a52",
    art: `<path d="M160 236V120" stroke="#f4faf0" stroke-width="7" stroke-linecap="round" opacity="0.9"/><ellipse cx="122" cy="150" rx="40" ry="21" transform="rotate(-28 122 150)" fill="#f4faf0" opacity="0.88"/><ellipse cx="200" cy="138" rx="40" ry="21" transform="rotate(24 200 138)" fill="#f4faf0" opacity="0.8"/><ellipse cx="140" cy="104" rx="34" ry="18" transform="rotate(-18 140 104)" fill="#f4faf0" opacity="0.7"/>`,
  },
  cat: {
    from: "#b9c3cc", to: "#5d6b78",
    art: `<circle cx="160" cy="196" r="58" fill="#f8fafb" opacity="0.95"/><path d="M118 156l-10-40 40 20zM202 156l10-40-40 20z" fill="#f8fafb" opacity="0.95"/><circle cx="140" cy="190" r="6" fill="#5d6b78"/><circle cx="180" cy="190" r="6" fill="#5d6b78"/>`,
  },
  desk: {
    from: "#f0d9a8", to: "#8a6a3f",
    art: `<rect x="92" y="130" width="136" height="86" rx="8" fill="#fdf8ec" opacity="0.95"/><rect x="150" y="216" width="20" height="26" fill="#fdf8ec" opacity="0.8"/><circle cx="222" cy="118" r="26" fill="#fdf8ec" opacity="0.6"/>`,
  },
};

function sceneThumb(scene: SceneKey): string {
  const s = SCENES[scene];
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="0.35" y2="1">` +
    `<stop offset="0" stop-color="${s.from}"/><stop offset="1" stop-color="${s.to}"/>` +
    `</linearGradient></defs>` +
    `<rect width="320" height="320" fill="url(#g)"/>${s.art}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

// ===== 构建与写入 =====

export function buildSeedMemories(now = Date.now()): MemoryEntry[] {
  return SEED.map((item, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - item.daysAgo);
    d.setHours(item.hour, (i * 7) % 60, 0, 0);
    return {
      id: `mem-seed-${i.toString().padStart(2, "0")}`,
      type: item.type,
      time: d.getTime(),
      content: item.content,
      thumb: item.scene ? sceneThumb(item.scene) : undefined,
      ai: item.desc
        ? { desc: item.desc, tags: item.tags ?? [], emotion: item.emotion ?? "" }
        : undefined,
    } satisfies MemoryEntry;
  });
}

/** 用示例生活覆盖记忆库(演示前一键准备) */
export function seedMemories(now = Date.now()): MemoryEntry[] {
  const list = buildSeedMemories(now);
  saveMemories(list);
  return list;
}
