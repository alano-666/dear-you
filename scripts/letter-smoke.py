#!/usr/bin/env python3
"""写信接口冒烟测试:三种信各生成一次,人读检查(§11.2)
用法:先起 dev server,再 python3 scripts/letter-smoke.py
"""
import json
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone

BASE = "http://localhost:3000/api/letter"
OPENER = urllib.request.build_opener(urllib.request.ProxyHandler({}))
CST = timezone(timedelta(hours=8))


def ts(y, m, d, h=12):
    return int(datetime(y, m, d, h, tzinfo=CST).timestamp() * 1000)


NOW = ts(2026, 9, 11, 20)

# 一组有跨时间线的演示记忆:旧愿望(回响)、跑步渐增(对比)、吉他停更(缺失)
MEMORIES = [
    {"id": "mem-aug20", "type": "text", "time": ts(2026, 8, 20, 22),
     "content": "想把日子过慢一点",
     "ai": {"desc": "写下了一个愿望", "tags": ["愿望", "生活"], "emotion": "平静"}},
    {"id": "mem-aug25", "type": "photo", "time": ts(2026, 8, 25, 20),
     "ai": {"desc": "你把吉他擦了擦,弹了一小段熟悉的曲子", "tags": ["吉他", "音乐"], "emotion": "放松"}},
    {"id": "mem-sep02", "type": "photo", "time": ts(2026, 9, 2, 19),
     "ai": {"desc": "傍晚的操场,你跑了 3 公里", "tags": ["跑步", "傍晚"], "emotion": "有点累"}},
    {"id": "mem-sep08", "type": "photo", "time": ts(2026, 9, 8, 19),
     "ai": {"desc": "傍晚的操场,你跑了 5 公里,比上次多了", "tags": ["跑步", "傍晚"], "emotion": "满足"}},
    {"id": "mem-sep10", "type": "text", "time": ts(2026, 9, 10, 23),
     "content": "今天很累,但还是读完了一章书",
     "ai": {"desc": "在疲惫里读完了书的一章", "tags": ["阅读", "夜晚"], "emotion": "倔强"}},
    {"id": "mem-sep11", "type": "photo", "time": ts(2026, 9, 11, 18),
     "ai": {"desc": "傍晚的操场,你跑了 5 公里", "tags": ["跑步", "傍晚"], "emotion": "满足"}},
]


def call(payload, timeout=120):
    req = urllib.request.Request(
        BASE, data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"}
    )
    try:
        with OPENER.open(req, timeout=timeout) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:300]
    except Exception as e:  # noqa: BLE001
        return -1, f"{type(e).__name__}: {e}"


def show(name, payload):
    t = time.time()
    status, data = call(payload)
    dt = time.time() - t
    print(f"\n{'='*66}\n### {name}  →  HTTP {status}  ({dt:.1f}s)\n{'='*66}")
    if isinstance(data, str):
        print(data)
        return
    if not data.get("ok"):
        print(json.dumps(data, ensure_ascii=False))
        return
    letter = data["letter"]
    print(f"title: {letter['title']}   model: {letter['model']}   degraded: {letter['degraded']}")
    print(f"{letter['salutation']}\n")
    for seg in letter["segments"]:
        if seg["type"] == "text":
            print(f"  {seg['text']}")
        elif seg["type"] == "quote":
            print(f"  〔引用 {seg['memId']}〕{seg['text']}")
        else:
            print("  〔发现〕" + " / ".join(f"[{i['kind']}]{i['text']}" for i in seg["items"]))
    print(f"\n{letter['sign']}")


show("欢迎信 welcome(首次提交,仅 1 条素材)",
     {"kind": "welcome", "now": NOW, "memories": [MEMORIES[-1]]})
show("日信 daily(全部记忆)",
     {"kind": "daily", "now": NOW, "memories": MEMORIES})
show("周信 weekly(全部记忆)",
     {"kind": "weekly", "now": NOW, "memories": MEMORIES})
print()
