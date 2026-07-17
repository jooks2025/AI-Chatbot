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


def _chart(symbol, rng, interval="1d"):
    url = ("https://query1.finance.yahoo.com/v8/finance/chart/"
           + urllib.parse.quote(symbol) + f"?range={rng}&interval={interval}")
    return _get_json(url)

# 차트 기간 -> (Yahoo range, interval)
RANGES = [
    ("1d", "1d", "5m"),
    ("1mo", "1mo", "1d"),
    ("3mo", "3mo", "1d"),
    ("6mo", "6mo", "1d"),
    ("1y", "1y", "1d"),
    ("3y", "3y", "1wk"),
    ("5y", "5y", "1wk"),
    ("10y", "10y", "1mo"),
]


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


def daily_change(symbol):
    """전일 대비(1일) 등락률(%). 실패 시 None."""
    try:
        res = _chart(symbol, "5d", "1d")["chart"]["result"][0]
        cl = [c for c in res["indicators"]["quote"][0]["close"] if c is not None]
        if len(cl) >= 2 and cl[-2]:
            return round((cl[-1] - cl[-2]) / cl[-2] * 100, 1)
    except Exception as e:  # noqa: BLE001
        print(f"[warn] daily {symbol}: {e}")
    return None


def history(symbol, rng, interval):
    intraday = interval.endswith("m") or interval.endswith("h")
    fmt = "%H:%M" if intraday else ("%y/%m" if interval in ("1wk", "1mo") else "%m/%d")
    try:
        res = _chart(symbol, rng, interval)["chart"]["result"][0]
        ts = res["timestamp"]
        cl = res["indicators"]["quote"][0]["close"]
        pts = [(t, c) for t, c in zip(ts, cl) if c is not None]
        time.sleep(0.2)
        return {
            "dates": [datetime.fromtimestamp(t, KST).strftime(fmt) for t, _ in pts],
            "closes": [round(c, 2) for _, c in pts],
        }
    except Exception as e:  # noqa: BLE001
        print(f"[warn] history {symbol} {rng}: {e}")
        return None


def update_heatmap():
    p = os.path.join(DATA, "heatmap.json")
    data = json.load(open(p, encoding="utf-8"))
    for g in data.get("groups", []):
        for it in g.get("items", []):
            v = daily_change(it.get("ticker", ""))
            if v is not None:
                it["change"] = v
    data["asOf"] = datetime.now(KST).strftime("%Y-%m-%d")
    data["basis"] = "전일 대비(1일) 등락률 · 자동 갱신 · 타일 크기는 시가총액 기준"
    with open(p, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print("[ok] heatmap.json 갱신")


def _fmt_cap(n):
    if not n:
        return None
    if n >= 1e12:
        return f"${n / 1e12:.2f}T"
    if n >= 1e9:
        return f"${n / 1e9:.0f}B"
    return f"${n / 1e6:.0f}M"


def fetch_quote_map(symbols):
    """Yahoo 시세 API에서 PER·PBR·시총을 배치로 받아온다. 막히면 빈 dict."""
    out = {}
    if not symbols:
        return out
    url = ("https://query1.finance.yahoo.com/v7/finance/quote?symbols="
           + urllib.parse.quote(",".join(symbols)))
    try:
        res = _get_json(url)["quoteResponse"]["result"]
        for q in res:
            trailing, forward = q.get("trailingPE"), q.get("forwardPE")
            per = round(trailing, 1) if trailing else (round(forward, 1) if forward else None)
            out[q.get("symbol")] = {
                "per": per,
                "perType": "후행" if trailing else ("선행" if forward else ""),
                "pbr": round(q["priceToBook"], 1) if q.get("priceToBook") else None,
                "mktcap": _fmt_cap(q.get("marketCap")),
            }
    except Exception as e:  # noqa: BLE001
        print(f"[warn] 시세(PER/PBR/시총) 조회 실패: {e}")
    return out


def update_fundamentals():
    p = os.path.join(DATA, "indicators.json")
    data = json.load(open(p, encoding="utf-8"))
    companies = data.get("companies", [])
    quotes = fetch_quote_map([c["ticker"] for c in companies if c.get("ticker")])
    for c in companies:
        v = ytd(c.get("ticker", ""))
        if v is not None:
            c["ytd"] = v
        q = quotes.get(c.get("ticker"))
        if q:
            if q["per"] is not None:
                c["per"], c["perType"] = q["per"], q["perType"]
            if q["pbr"] is not None:
                c["pbr"] = q["pbr"]
            if q["mktcap"]:
                c["mktcap"] = q["mktcap"]
    data["asOf"] = datetime.now(KST).strftime("%Y-%m-%d")
    with open(p, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print("[ok] indicators.json 갱신 (YTD + PER/PBR/시총 시도)")


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
        ranges = {}
        for key, rng, interval in RANGES:
            h = history(sym, rng, interval)
            ranges[key] = h if h else (prev.get(name, {}) or {}).get(key)
        series[name] = ranges
    out = {"updatedAt": datetime.now(KST).isoformat(timespec="minutes"), "series": series}
    with open(p, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print("[ok] charts.json 갱신 (8개 기간)")


def main():
    force = os.environ.get("DERIVED_FORCE")
    minute = datetime.now(KST).minute
    hour = datetime.now(KST).hour
    if not force and minute >= 15:
        print("[info] derived: 매시간 1회만 실행 — 이번 분에는 건너뜀")
        return
    update_heatmap()
    # 차트(8개 기간 x 7지수)는 호출이 많아 하루 2회(07·15시)만 갱신
    if force or hour in (7, 15):
        update_charts()
    else:
        print("[info] 차트는 07·15시에만 갱신 — 건너뜀")


if __name__ == "__main__":
    main()
