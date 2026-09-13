# BACKEND 开发规划:《致你》Demo 版

> 版本:v1.0 | 日期:2026-09-11 | 配套:`docs/PRD-致你-demo.md`、`mockup/index.html`
> 本文档是 Demo 版**服务端的施工图**:接口规格、数据契约、提示词设计、兜底策略、测试计划、开发顺序。开发时以此为准。

---

## 1. 总览:Demo 后端只有三样东西

| # | 组件 | 职责 | 估计工时 |
|---|---|---|---|
| 1 | `POST /api/recognize` | 收到图片(base64)→ 调视觉模型 → 返回结构化"观察" | 1h |
| 2 | `POST /api/letter` | 收到全部记忆 → 调文本模型 → 返回结构化"信件" | 3h |
| 3 | `lib/llm.ts` | 模型抽象层(视觉 + 文本),供应商可切换 | 0.5h |

**没有的东西(刻意为之)**:
- ❌ 数据库 —— 记忆存在浏览器 localStorage,生成信件时由前端把记忆**传给**服务端
- ❌ 用户系统/登录 —— demo 单设备演示
- ❌ 服务端持久化 —— **服务端不存任何用户数据**,请求完即忘(这同时也是 demo 的隐私话术:"你的生活,我们不留底")

**为什么还需要服务端**:两个原因——① API 密钥不能放在前端(任何人查看网页源码就能偷走),必须由服务端保管;② 跨域与请求体积控制。

---

## 2. 架构与请求流

```
浏览器(前端)                          服务端(Next.js API Routes)
┌──────────────────────┐              ┌──────────────────────────────┐
│ 首页:压缩照片/抽帧    │──POST──────▶│ /api/recognize               │
│                       │  图片base64  │   └─ lib/llm.ts vision()     │
│ ◀──观察{desc,tags,    │◀────────────│        └─ 智谱 glm-4v-flash   │
│    emotion}           │              │        (密钥来自 env)         │
│ 存入 localStorage     │              └──────────────────────────────┘
│                       │
│ 信件页:打包全部记忆   │──POST──────▶┌──────────────────────────────┐
│ (只传文字,不传图)     │  memories[]  │ /api/letter                  │
│ ◀──结构化信件段落     │◀────────────│   └─ lib/llm.ts chat()       │
│ 逐字浮现渲染          │              │        └─ 百智云网关          │
└──────────────────────┘              │           glm-5.3-flash      │
                                      └──────────────────────────────┘
```

**关键设计:生成信件时只传文字**(AI 描述 + 标签 + 情绪 + 用户原文),不传图片 —— 省 token、快、够用。

---

## 3. 目录结构规划(Next.js App Router)

```
geekathon/
├─ app/
│  ├─ page.tsx                # 屏① 首页(提交)
│  ├─ river/page.tsx          # 屏② 河流
│  ├─ letter/page.tsx         # 屏③ 信件
│  ├─ deliver/page.tsx        # 屏④ 送达预览
│  └─ api/
│     ├─ recognize/route.ts   # 接口 1
│     └─ letter/route.ts      # 接口 2
├─ lib/
│  ├─ llm.ts                  # 模型抽象层(唯一与 AI 供应商对话的文件)
│  ├─ prompts.ts              # 全部提示词集中管理(人设/识别/三类信)
│  ├─ types.ts                # 共享类型(MemoryEntry / Letter / Observation)
│  ├─ memory.ts               # localStorage 读写(前端用)
│  ├─ image.ts                # 客户端压缩/视频抽帧(前端用)
│  └─ fallback-letter.ts      # 内置备用周信(预生成,离线兜底)
├─ mockup/index.html          # 已完成的静态原型(样式与结构将迁移进 app/)
└─ .env                       # 密钥(已存在,勿提交)
```

---

## 4. 接口 1:`POST /api/recognize`

**用途**:把用户交的照片/视频帧变成一条结构化"观察"。

**请求体**:
```jsonc
{
  "images": ["data:image/jpeg;base64,..."],   // 1 张(照片)或 3 张(视频抽帧)
  "kind": "photo" | "video",                   // 影响提示词写法
  "capturedAt": 1758123456789                  // 素材拍摄时间(前端提供)
}
```

**成功响应(200)**:
```jsonc
{
  "ok": true,
  "observation": {
    "desc": "傍晚的操场,你跑了 5 公里,比上周多",   // ≤35 字,第二人称
    "tags": ["跑步", "傍晚"],                      // 2-4 个
    "emotion": "满足"                              // 1 个词
  },
  "model": "glm-4v-flash",
  "durationMs": 1840
}
```

**失败响应(200,业务失败不抛 5xx)**:
```jsonc
{ "ok": false, "error": "UPSTREAM" | "TIMEOUT" | "BAD_IMAGE" | "NO_KEY", "message": "人话解释" }
```
> 用 200 + `ok:false` 的原因:前端处理统一,不和 HTTP 错误码纠缠。

**服务端逻辑**(伪代码):
```
1. 校验:images 非空、每张 ≤1.5MB、kind 合法 → 否则 BAD_IMAGE
2. 组装 vision 请求:system 提示词 + 图片 + 识别指令(prompts.ts)
3. lib.llm.vision(images, prompt) → 原始文本
4. 解析 JSON(容忍 ```json 围栏)→ 校验字段 → 失败重试 1 次
5. 仍失败 → 返回 {ok:false, error:"UPSTREAM"}
6. 超时:30s(AbortController)
```

**⚠️ Day 1 检查点**:glm-4v-flash 单请求传 3 张图是否支持(多图输入)。测试方法:curl 传 3 图看是否正常。**不支持则降级**:3 帧拆成 3 次调用,服务端合并(多花约 2s)。

---

## 5. 接口 2:`POST /api/letter`

**用途**:把记忆库写成信。三种:欢迎信 / 日信 / 周信。

**请求体**:
```jsonc
{
  "kind": "welcome" | "daily" | "weekly",
  "now": 1758123456789,
  "memories": [                                  // 全部记忆(周信按 time 过滤近 7 天)
    {
      "id": "mem-a1b2",
      "type": "photo" | "text" | "video",
      "time": 1758100000000,
      "content": "用户的原始文字(文字类才有)",     // 可空
      "ai": { "desc": "...", "tags": ["..."], "emotion": "..." }
    }
  ]
}
```
> 注意:**不含图片数据**,只传文字。单次请求体积 <50KB。

**成功响应(200)**:
```jsonc
{
  "ok": true,
  "letter": {
    "title": "9 月 11 日的信",
    "salutation": "致 你",
    "segments": [                                // 有序段落数组,前端按序渲染
      { "type": "text",  "text": "今天傍晚,你把操场的照片交给了我——" },
      { "type": "quote", "memId": "mem-a1b2",
        "text": "傍晚的操场 · 跑了 5 公里" },      // 前端渲染为可点击卡片→跳回河流
      { "type": "text",  "text": "我记得上周你只是随口提过一句……" },
      { "type": "discover", "items": [
          { "kind": "对比", "text": "上个月你只跑了 2 次,这个月已经 6 次了。" },
          { "kind": "回响", "text": "8 月你写下'想把日子过慢一点'……" },
          { "kind": "缺失", "text": "你的吉他,停在 42 天前。它还等你。" }
      ]},
      { "type": "text",  "text": "日子大多平淡,但你不是。" }
    ],
    "sign": "—— 致你",
    "model": "glm-5.3-flash",
    "degraded": false                            // true = JSON 解析失败,segments 降级为纯文本段
  }
}
```

**三种信的生成规则**:

| 维度 | welcome(欢迎信) | daily(日信) | weekly(周信) |
|---|---|---|---|
| 输入记忆 | 首次提交的 1-2 条 | 全部(重点最近 24h) | 近 7 天 |
| 引用 | 引用第一条素材 | 至少引用 1 条 | 至少引用 2 条 |
| 发现 | 无 | 1 条(任意类) | **对比/回响/缺失各 ≥1 条** |
| 附加任务 | 建立契约:"我会每天、每周给你写信" | 收尾"明天见" | 收尾"下周见" |
| 字数 | 100-150 字 | 150-250 字 | 250-400 字 |

**服务端逻辑**:
```
1. 校验:kind 合法;memories 非空(daily/weekly 且为空 → 返回友好错误)
2. 选择提示词模板(prompts.ts)→ 拼 system + user(记忆表:按时间排序,带 id)
3. lib.llm.chat(system, user) → 原始文本
4. 解析 JSON(剥 ```json 围栏)→ 按 schema 校验 → 失败重试 1 次(附"上次不是合法 JSON")
5. 仍失败 → 降级:把原始文本切成纯 text 段,degraded:true(前端不渲染引用卡与发现块,信依然能读)
6. 超时:60s
```

---

## 6. `lib/llm.ts` 抽象层设计(核心约束文件)

**铁律:页面代码和 route 代码不允许直接调任何 AI 供应商;所有模型调用只经过这里。** 以后换 Claude / 换任何模型,只改这一个文件 + `.env`。

```ts
// 对外只有两个函数
export async function vision(images: string[], prompt: string): Promise<string>
// → 调视觉模型,返回原始文本(调用方负责解析)

export async function chat(system: string, user: string, opts?: {
  maxTokens?: number; temperature?: number;
}): Promise<string>
// → 调文本模型,返回纯文本(自动拼接多 content 块)
```

**供应商实现(内部)**:

| 供应商 | 用途 | 端点 | 认证 | 关键细节 |
|---|---|---|---|---|
| 智谱 | vision | `POST https://open.bigmodel.cn/api/paas/v4/chat/completions` | `Authorization: Bearer $ZHIPU_API_KEY` | OpenAI 格式;图片放 content 数组 `{"type":"image_url","image_url":{"url":"data:..."}}`;**✅ 2026-09-11 已实测连通** |
| 百智云 | chat | `POST $BAIZHI_BASE_URL/v1/messages` | `x-api-key: $BAIZHI_API_KEY` + `anthropic-version: 2023-06-01` | Anthropic 格式;⚠️ 响应 `content[]` 含 `thinking` 块,**必须过滤 `type==="text"` 再拼接**;**✅ 已实测连通** |

**环境变量(.env 已就绪)**:
```
ZHIPU_API_KEY / ZHIPU_BASE_URL
BAIZHI_API_KEY / BAIZHI_BASE_URL
VISION_MODEL=glm-4v-flash        # 可切 glm-4.6v-flash 等
TEXT_MODEL=glm-5.3-flash         # 可切 deepseek-v4-pro(质量更高,待 A/B)
```

**统一超时与重试**:AbortController 超时(vision 30s / chat 60s);网络类错误重试 1 次(退避 1s);**不**对 4xx 参数错误重试。

---

## 7. Prompt 设计(服务的"灵魂",全部集中 prompts.ts)

### 7.1 人设 system(三种信共用)
> 你是"致你"——一个记得用户生活的人。你每天/每周给用户写一封信。
> 语气:温柔、具体、不肉麻、不评判、不油腻。像一个记性很好又不多话的朋友。
> 铁律:① 只引用我给你的记忆,不编造任何事件、时间、数字;② "发现"必须能从记忆里找到依据;③ 不提"AI""模型""数据"这些词;④ 不用"亲爱的用户"这类称呼;⑤ 只输出要求的 JSON,不输出多余内容。

### 7.2 识别 prompt(vision)
> 看这些图片(用户随手交的生活片段)。用第二人称写下你看见的:发生了什么、有什么细节、情绪如何。
> 输出 JSON:`{"desc":"≤35字,具体、有细节","tags":["2-4个短标签"],"emotion":"一个情绪词"}`
> 不确定的不要写。看不清就说"看不清",不许猜。

### 7.3 信件 prompt(chat,以周信为例)
> user 内容 = 任务说明 + 记忆清单(每条:`[id] 时间 | 类型 | 你的观察 | 用户原文`)
> 任务:写一封周信。结构要求(输出 JSON,字段见 schema):
> - salutation:"致 你"
> - segments:穿插 text 和 quote;quote 的 memId 必须是记忆清单里真实存在的 id
> - 必须包含 1 个 discover 段,里面恰好 3 条:对比(和过去比)、回响(旧愿望/旧话与现在的呼应)、缺失(很久没出现的东西——语气要温柔,不指责,像"它还等你")
> - 结尾 sign:"—— 致你",收尾句用"下周见"
> - 总字数 250-400,分段自然,不堆砌形容词

### 7.4 防幻觉三保险(对应 PRD 的 E3)
1. **引用必须带 id**:quote 段的 memId 校验——不在记忆清单里的 id 直接丢弃该段(服务端过滤)
2. **数字必须可溯源**:prompt 要求数字只能来自记忆;抽查 demo 前跑 5 次人工审
3. **降级可读**:JSON 失败时纯文本渲染,内容依然是一封完整的信

---

## 8. 数据契约(lib/types.ts)

```ts
export interface Observation { desc: string; tags: string[]; emotion: string; }

export interface MemoryEntry {
  id: string;                    // "mem-" + 随机短码
  type: "photo" | "text" | "video";
  time: number;                  // 毫秒时间戳
  content?: string;              // 用户原始文字
  thumb?: string;                // 压缩缩略图 dataURL(仅前端用,不传服务端)
  ai?: Observation;              // 识别失败时为空,稍后补
}

export type Segment =
  | { type: "text"; text: string }
  | { type: "quote"; memId: string; text: string }
  | { type: "discover"; items: { kind: "对比" | "回响" | "缺失"; text: string }[] };

export interface Letter {
  title: string; salutation: string; segments: Segment[];
  sign: string; model: string; degraded: boolean;
  kind: "welcome" | "daily" | "weekly"; generatedAt: number;
}
```

---

## 9. 错误处理与兜底(对应 PRD F10 / KR3)

| 故障 | 表现 | 兜底 |
|---|---|---|
| 识别超时/失败 | 河流里该条目无 AI 描述 | 前端显示"它还没来得及看,稍后补上";条目**不阻塞**流入;支持点击重试 |
| 写信失败(日信) | 信件页空白 | 提示"今天的信在路上",可手动重试 |
| 写信失败(周信)/现场断网 | 演示事故 | **加载内置备用周信**(`fallback-letter.ts`,预生成并人工润色),页脚标注"演示数据" |
| 百智云整体不可用 | 所有信都失败 | env 切换 TEXT_MODEL 到备用模型(deepseek-v4-pro / qwen-flash,同网关) |
| 智谱整体不可用 | 识别全挂 | 演示脚本降级:只演示文字提交(文字不需要视觉模型) |
| JSON 解析失败 | 引用卡/发现块渲染不出 | degraded 模式:纯文本信照常阅读 |

**演示前必做**:把上面每一行当成一个"故障剧本"演练一遍,确认兜底路径真实有效(demo 演示者的安全感来自这里)。

---

## 10. 安全与隐私(服务端红线)

1. **密钥永不进前端**:只读 `process.env`,不硬编码;`.env` 已在 `.gitignore`;Vercel 后台单独配置环境变量
2. **请求体积**:Vercel body 限制约 4.5MB —— 前端压缩后单图约 200-400KB,3 帧合计 <1.5MB,安全;服务端仍要校验每张 ≤1.5MB
3. **日志纪律**:错误日志只记长度/耗时/错误码,**不打印 base64 图片与用户原文**
4. **无状态承诺**:服务端不落盘、不写数据库、不缓存用户内容;demo 的隐私话术是"你的生活,我们不留底"
5. **上线前自检**:`curl` 请求线上接口,确认错误响应里不泄露任何密钥与内网信息

---

## 11. 测试计划

### 11.1 已完成的测试(记录在案)
- 智谱 glm-4v-flash:✅ base64 传图 + 返回描述(2026-09-11)
- 百智云:✅ /v1/messages 正常返回;⚠️ 发现 thinking 块需过滤(2026-09-11)

### 11.2 开发中必测(curl 样例)
```bash
# 识别(本地起服务后)
curl -s localhost:3000/api/recognize -X POST -H "Content-Type: application/json" \
  -d '{"kind":"photo","images":["data:image/jpeg;base64,<小图>"],"capturedAt":1758123456789}'

# 周信
curl -s localhost:3000/api/letter -X POST -H "Content-Type: application/json" \
  -d '{"kind":"weekly","now":1758123456789,"memories":[{"id":"mem-t1","type":"text","time":1758100000000,"content":"想把日子过慢一点","ai":{"desc":"写下了一个愿望","tags":["愿望"],"emotion":"平静"}}]}'
```

### 11.3 边界用例
| 用例 | 期望 |
|---|---|
| 空 images / 非图片 dataURL | `{ok:false,error:"BAD_IMAGE"}` |
| 超大图(>1.5MB) | `{ok:false,error:"BAD_IMAGE"}` |
| memories 为空 + daily | 友好错误提示 |
| 记忆里的 time 是未来/异常值 | 不崩溃(过滤处理) |
| 无 API key 启动 | 接口返回 `NO_KEY`,不白屏 |

### 11.4 JSON 稳定性实验(Day 2 上午做)
同一组记忆连跑 **5 次周信**,统计:JSON 合法率、三类发现齐全率、引用 id 有效率。
**目标:合法率 ≥80%、发现齐全 ≥4/5 次**;不达标就强化 prompt(给 1 个输出示例)再测一轮。

---

## 12. 开发顺序与工时(对齐 PRD 排期)

| 顺序 | 任务 | 依赖 | 工时 | 完成标志 |
|---|---|---|---|---|
| B1 | `lib/llm.ts` + `types.ts` + env 读取 | 无 | 0.5h | 本地跑通一个 hello-world 调用 |
| B2 | `/api/recognize`(照片) | B1 | 1h | curl 测试 3 张真实照片全通过 |
| B3 | 多图支持检查(视频帧) | B2 | 0.5h | 3 帧一请求 or 决定降级为 3 次调用 |
| B4 | `/api/letter`(welcome + daily) | B1 | 1.5h | curl 生成的信能读、能引用 memId |
| B5 | weekly + 三类发现 + JSON 健壮性 | B4 | 1.5h | 5 次稳定性实验达标 |
| B6 | 错误码 + 备用周信 + 超时 | B5 | 0.5h | 断网演练通过 |
| B7 | Vercel 环境变量 + 线上验证 | 全部 | 0.5h | 线上 curl 通过 |

**总计约 6 小时** —— 在 PRD 的 Day 1 上午到 Day 2 上午区间内完成,不挤压前端时间。

---

## 13. 验收清单(对应 PRD 功能 ID)

- [ ] F1 照片识别:真实照片 3 秒内返回准确观察(§4 + B2)
- [ ] F3 视频识别:3 帧输入可用(§4 Day1 检查点)
- [ ] F6/F7 日/周信:引用真实 memId;周信三类发现齐全(§5 + §11.4)
- [ ] F8 欢迎信:首次提交触发(§5 表格)
- [ ] F10 备用周信:断网演示不中断(§9)
- [ ] 安全:前端源码与网络响应中搜不到任何 key(§10-1)
