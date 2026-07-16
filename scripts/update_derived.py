#!/usr/bin/env python3
"""히트맵 YTD, 펀더멘탈 YTD, 지수 미니차트 데이터를 Yahoo Finance에서 받아 갱신한다.

부하를 줄이려고 기본적으로 매시간 정각(KST 분<15) 실행분에서만 동작한다.
수동 실행(DERIVED_FORCE)일 때는 항상 동작. 외부 의존성 없이 표준 라이브러리만 사용.
"""
import json
import os
import time
import urllib.parse
import urllib.request
import urllib.error
from datetime import datetime, timezone, timedelta

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
KST = timezone(timedelta(hours=9))

# 표시명 -> Yahoo 심볼 (미니차트용 지수)
INDEX_SYMBOLS = {
    "코스피": "^KS11", "코스닥": "^KQ11", "S&P500": "^GSPC", "나스닥": "^IXIC",
    "다우존스": "^DJI", "러셀2000": "^RUT", "니케이225": "^N225",
}


def _get_json(url, attempts=3):
    last = None
    for i in range(attempts):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode("utf-8", "replace"))
        except (urllib.error.URLError, TimeoutError, OSError, ValueError) as e:
            last = e
            if i < attempts - 1:
                time.sleep(1.5 * (i + 1))
    raise last


def _chart(symbol, rng):
    url = ("https://query1.finance.yahoo.com/v8/finance/chart/"
           + urllib.parse.quote(symbol) + f"?range={rng}&interval=1d")
    return _get_json(url)


_ytd_cache = {}


def ytd(symbol):
    if symbol in _ytd_cache:
        return _ytd_cache[symbol]
    val = None
    try:
        res = _chart(symbol, "ytd")["chart"]["result"][0]
        closes = [c for c in res["indicators"]["quote"][0]["close"] if c is not None]
        if len(closes) >= 2:
            val = round((closes[-1] - closes[0]) / closes[0] * 100, 1)
    except Exception as e:  # noqa: BLE001 - 데이터 잡에서는 관대하게 처리
        print(f"[warn] YTD {symbol}: {e}")
    _ytd_cache[symbol] = val
    time.sleep(0.2)
    return val


def history(symbol, rng="1mo"):
    try:
        res = _chart(symbol, rng)["chart"]["result"][0]
        ts = res["timestamp"]
        cl = res["indicators"]["quote"][0]["close"]
        pts = [(t, c) for t, c in zip(ts, cl) if c is not None]
        time.sleep(0.2)
        return {
            "dates": [datetime.fromtimestamp(t, KST).strftime("%m/%d") for t, _ in pts],
            "closes": [round(c, 2) for _, c in pts],
        }
    except Exception as e:  # noqa: BLE001
        print(f"[warn] history {symbol}: {e}")
        return None


def update_heatmap():
    p = os.path.join(DATA, "heatmap.json")
    data = json.load(open(p, encoding="utf-8"))
    for g in data.get("groups", []):
        for it in g.get("items", []):
            v = ytd(it.get("ticker", ""))
            if v is not None:
                it["change"] = v
    data["asOf"] = datetime.now(KST).strftime("%Y-%m-%d")
    data["basis"] = "연초 대비(YTD) 등락률 · 자동 갱신 · 타일 크기는 시가총액 기준"
    with open(p, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print("[ok] heatmap.json 갱신")


def update_fundamentals():
    p = os.path.join(DATA, "indicators.json")
    data = json.load(open(p, encoding="utf-8"))
    for c in data.get("companies", []):
        v = ytd(c.get("ticker", ""))
        if v is not None:
            c["ytd"] = v
    data["asOf"] = datetime.now(KST).strftime("%Y-%m-%d")
    with open(p, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print("[ok] indicators.json YTD 갱신")


def update_charts():
    p = os.path.join(DATA, "charts.json")
    prev = {}
    if os.path.exists(p):
        try:
            prev = json.load(open(p, encoding="utf-8")).get("series", {})
        except Exception:  # noqa: BLE001
            prev = {}
    series = {}
    for name, sym in INDEX_SYMBOLS.items():
        h = history(sym, "1mo")
        series[name] = h if h else prev.get(name)
    out = {"updatedAt": datetime.now(KST).isoformat(timespec="minutes"), "series": series}
    with open(p, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print("[ok] charts.json 갱신")


def main():
    if not os.environ.get("DERIVED_FORCE") and datetime.now(KST).minute >= 15:
        print("[info] derived: 매시간 1회만 실행 — 이번 분에는 건너뜀")
        return
    update_heatmap()
    update_fundamentals()
    update_charts()


if __name__ == "__main__":
    main()
