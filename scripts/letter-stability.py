#!/usr/bin/env python3
"""周信 JSON 稳定性实验(§11.4):同一组记忆连跑 5 次,统计三项指标
用法:先起 dev server,再 python3 scripts/letter-stability.py [N]
"""
import json
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone

BASE = "http://localhost:3000/api/letter"
OPENER = urllib.request.build_opener(urllib.request.ProxyHandler({}))
CST = timezone(timedelta(hours=8))
RUNS = int(sys.argv[1]) if len(sys.argv) > 1 else 5


def ts(y, m, d, h=12):
    return int(datetime(y, m, d, h, tzinfo=CST).timestamp() * 1000)


NOW = ts(2026, 9, 11, 20)

MEMORIES = [
    {"id": "mem-aug20", "type": "text", "time": ts(2026, 8, 20, 22), "content": "想把日子过慢一点",
     "ai": {"desc": "写下了一个愿望", "tags": ["愿望", "生活"], "emotion": "平静"}},
    {"id": "mem-aug25", "type": "photo", "time": ts(2026, 8, 25, 20),
     "ai": {"desc": "你把吉他擦了擦,弹了一小段熟悉的曲子", "tags": ["吉他", "音乐"], "emotion": "放松"}},
    {"id": "mem-sep02", "type": "photo", "time": ts(2026, 9, 2, 19),
     "ai": {"desc": "傍晚的操场,你跑了 3 公里", "tags": ["跑步", "傍晚"], "emotion": "有点累"}},
    {"id": "mem-sep08", "type": "photo", "time": ts(2026, 9, 8, 19),
     "ai": {"desc": "傍晚的操场,你跑了 5 公里,比上次多了", "tags": ["跑步", "傍晚"], "emotion": "满足"}},
    {"id": "mem-sep10", "type": "text", "time": ts(2026, 9, 10, 23), "content": "今天很累,但还是读完了一章书",
     "ai": {"desc": "在疲惫里读完了书的一章", "tags": ["阅读", "夜晚"], "emotion": "倔强"}},
    {"id": "mem-sep11", "type": "photo", "time": ts(2026, 9, 11, 18),
     "ai": {"desc": "傍晚的操场,你跑了 5 公里", "tags": ["跑步", "傍晚"], "emotion": "满足"}},
]
VALID_IDS = {m["id"] for m in MEMORIES}


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


runs = []
for i in range(1, RUNS + 1):
    t = time.time()
    status, data = call({"kind": "weekly", "now": NOW, "memories": MEMORIES})
    dt = time.time() - t

    if status != 200 or not isinstance(data, dict) or not data.get("ok"):
        runs.append({"i": i, "valid": False, "full": False, "quotes": 0, "dt": dt,
                     "bad_quote": 0, "note": str(data)[:120]})
        print(f"run {i}: ✗ 请求失败({str(data)[:100]})")
        continue

    letter = data["letter"]
    quotes, bad_quote, kinds = 0, 0, []
    for seg in letter["segments"]:
        if seg["type"] == "quote":
            quotes += 1
            if seg["memId"] not in VALID_IDS:
                bad_quote += 1
        elif seg["type"] == "discover":
            kinds += [d["kind"] for d in seg["items"]]

    valid = not letter["degraded"]
    full = {"对比", "回响", "缺失"}.issubset(set(kinds))
    runs.append({"i": i, "valid": valid, "full": full, "quotes": quotes,
                 "bad_quote": bad_quote, "dt": dt, "note": "+".join(kinds)})
    print(f"run {i}: JSON{'✓' if valid else '✗降级'}  发现{'齐全' if full else '缺:'+str(set(kinds))}"
          f"  引用{quotes}条  无效{kinds and bad_quote}  {dt:.1f}s")

ok_valid = sum(1 for r in runs if r["valid"])
ok_full = sum(1 for r in runs if r["full"])
ok_quote = sum(1 for r in runs if r["quotes"] >= 2 and r["bad_quote"] == 0)
avg_dt = sum(r["dt"] for r in runs) / len(runs)

print(f"\n{'='*56}")
print(f"JSON 合法率   {ok_valid}/{RUNS}  ({ok_valid/RUNS:.0%})   目标 ≥80%   {'✅' if ok_valid/RUNS >= 0.8 else '❌'}")
print(f"发现齐全率     {ok_full}/{RUNS}  ({ok_full/RUNS:.0%})   目标 ≥4/5   {'✅' if ok_full/RUNS >= 0.8 else '❌'}")
print(f"引用有效率     {ok_quote}/{RUNS}  (≥2 条且 id 全部有效)")
print(f"平均耗时       {avg_dt:.1f}s")
