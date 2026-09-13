# 《致你》Dear You — Demo

**🌊 在线体验**:https://geekathon-alano-s-projects.vercel.app

没有聊天框的陪伴型 AI:用户提交照片/视频/文字,AI 观察、记忆,以信件回应。
2 天冲刺的黑客松 Demo。项目介绍见 `docs/项目介绍-致你.md`,产品规格见 `docs/PRD-致你-demo.md`,后端施工图见 `docs/BACKEND-致你-demo.md`。

## 快速开始

```bash
pnpm install
cp .env.example .env   # 填入智谱 / 百智云密钥
pnpm dev               # http://localhost:3000
```

## 后端(已就绪)

两个 API 接口 + 一个模型抽象层,无数据库、无用户系统、服务端不存任何用户数据。

| 路径 | 职责 |
|---|---|
| `POST /api/recognize` | 图片(base64)→ 结构化"观察"{desc, tags, emotion} |
| `POST /api/letter` | 全部记忆(纯文字)→ 结构化信件(welcome / daily / weekly) |
| `lib/llm.ts` | **唯一**与 AI 供应商对话的文件;换模型只改这里 + `.env` |
| `lib/prompts.ts` | 全部提示词集中管理 |
| `lib/types.ts` | 前后端共享数据契约 |
| `lib/fallback-letter.ts` | 断网/失败时的备用周信 |

接口契约、错误码、兜底策略详见 `docs/BACKEND-致你-demo.md` §4–§9;
前端对接注意事项见 §14(含实测延迟:日信 ≈20s、周信 ≈28s)。

## 测试脚本

先起 dev server,再运行:

```bash
python3 scripts/recognize-smoke.py    # 识别接口:单图/三帧/边界用例
python3 scripts/letter-smoke.py       # 三种信各生成一次,人读检查
python3 scripts/letter-stability.py 5 # 周信稳定性实验(JSON 合法率等)

pnpm dlx tsx --env-file=.env scripts/llm-smoke.ts    # 两条模型通道连通
pnpm dlx tsx --env-file=.env scripts/error-paths.ts  # NO_KEY / 断网快速失败
```

> macOS 上系统代理(Clash 等)会拦截 localhost 请求,Python 脚本已内置绕过。

## 部署到 Vercel

1. `pnpm dlx vercel login`(或 `npm i -g vercel` 后 `vercel login`)
2. 项目根目录 `vercel` 关联项目,`vercel --prod` 部署
3. 在 Vercel 项目 Settings → Environment Variables 配置 `.env.example` 中的全部变量
4. 线上验证:两个接口各 `curl` 一次,确认错误响应不泄露密钥
