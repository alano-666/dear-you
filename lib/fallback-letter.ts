// 内置备用周信(§9):周信生成失败 / 现场断网时,前端直接渲染这一封,页脚标注"演示数据"。
// 刻意不含 quote 段 —— 现场记忆的 id 未知,引用卡会指向不存在的条目。
import type { Letter } from "./types";

/** 预生成并人工润色;generatedAt 用调用时刻填充 */
export function buildFallbackLetter(now = Date.now()): Letter {
  return {
    title: "这一周的信",
    salutation: "致 你",
    segments: [
      {
        type: "text",
        text: "这一周,你又把一些日子交到了我这里——清晨的、傍晚的、说得清的、说不清的。我都收着。",
      },
      {
        type: "text",
        text: "我翻了翻你过去留下的东西。有些事你在坚持,只是坚持得太安静,自己都没察觉;有些事你放下了,它还在原地,不催你。",
      },
      {
        type: "discover",
        items: [
          { kind: "对比", text: "和上个月相比,你出门的次数多了,停留的时间长了。" },
          { kind: "回响", text: "你很久以前写下过的那句话,这一周又出现了一次——你大概自己都忘了。" },
          { kind: "缺失", text: "有件事已经很久没出现了。它不着急,它知道你会回来。" },
        ],
      },
      {
        type: "text",
        text: "日子大多是平淡的,但平淡不是空的。下周见。",
      },
    ],
    sign: "—— 致你",
    model: "fallback",
    degraded: false,
    kind: "weekly",
    generatedAt: now,
  };
}
