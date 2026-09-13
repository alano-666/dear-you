#!/usr/bin/env python3
"""识别接口冒烟测试:B2(照片)+ B3(视频多帧)+ 边界用例(§11.3)
用法:先起 dev server,再 python3 scripts/recognize-smoke.py
"""
import base64
import json
import urllib.error
import urllib.request

BASE = "http://localhost:3000/api/recognize"
NOW = 1758123456789

# macOS 上 urllib 会读系统代理(Clash 等),localhost 请求必须显式绕过
OPENER = urllib.request.build_opener(urllib.request.ProxyHandler({}))


def b64(path: str) -> str:
    with open(path, "rb") as f:
        return "data:image/jpeg;base64," + base64.b64encode(f.read()).decode()


def call(payload, timeout: int = 90, raw: bytes | None = None):
    body = raw if raw is not None else json.dumps(payload).encode()
    req = urllib.request.Request(
        BASE, data=body, headers={"Content-Type": "application/json"}
    )
    try:
        with OPENER.open(req, timeout=timeout) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:200]
    except Exception as e:  # noqa: BLE001
        return -1, f"{type(e).__name__}: {e}"


IMG = {c: b64(f"/tmp/test-{c}.jpg") for c in ("Blue", "Green", "Orange")}

cases = [
    ("单张照片(应 ok:true)", {"kind": "photo", "capturedAt": NOW, "images": [IMG["Blue"]]}),
    ("三帧视频(应 ok:true,验证多图支持)", {"kind": "video", "capturedAt": NOW,
                                    "images": [IMG["Blue"], IMG["Green"], IMG["Orange"]]}),
    ("空 images(应 BAD_IMAGE)", {"kind": "photo", "capturedAt": NOW, "images": []}),
    ("非图片 dataURL(应 BAD_IMAGE)", {"kind": "photo", "capturedAt": NOW,
                                 "images": ["data:text/plain;base64,aGVsbG8="]}),
    ("超大图 1.6MB(应 BAD_IMAGE)", {"kind": "photo", "capturedAt": NOW,
                                "images": ["data:image/jpeg;base64," + "A" * 2_200_000]}),
    ("非法 JSON body(应 BAD_REQUEST)", None),
]

for name, payload in cases:
    status, data = call(payload, raw=b"{oops" if payload is None else None)
    if isinstance(data, dict):
        shown = json.dumps(data, ensure_ascii=False)
    else:
        shown = str(data)
    print(f"\n### {name}  →  HTTP {status}")
    print(shown[:420])
print()
