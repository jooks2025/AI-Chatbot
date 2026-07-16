#!/usr/bin/env python3
"""주요 지수 종가와 환율을 Yahoo Finance 차트 API(무료)에서 받아 data/market.json을 갱신한다.

GitHub Actions에서 15분마다 실행되며 외부 의존성 없이 표준 라이브러리만 사용한다.
"""
import json
import os
import time
import urllib.parse
import urllib.request
import urllib.error
from datetime import datetime, timezone, timedelta

# 표시명 -> Yahoo Finance 심볼 (지수)
INDICES = [
    ("코스피", "^KS11"),
    ("코스닥", "^KQ11"),
    ("S&P500", "^GSPC"),
    ("나스닥", "^IXIC"),
    ("다우존스", "^DJI"),
    ("러셀2000", "^RUT"),
    ("니케이225", "^N225"),
]

# 표시명 -> Yahoo Finance 심볼, 단위 (환율)
FX = [
    ("원/달러", "USDKRW=X", "원"),
    ("엔/달러", "USDJPY=X", "엔"),
    ("유로/달러", "EURUSD=X", "$"),
    ("파운드/달러", "GBPUSD=X", "$"),
    ("위안/달러", "USDCNY=X", "위안"),
]

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "market.json")
KST = timezone(timedelta(hours=9))


def _download(url, attempts=3):
    """네트워크 흔들림에 대비해 몇 번 재시도하며 본문을 받아온다."""
    last_err = None
    for i in range(attempts):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=30) as resp:
                return resp.read().decode("utf-8", "replace").strip()
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            last_err = e
            if i < attempts - 1:
                time.sleep(2 * (i + 1))
    raise last_err


def fetch_last_two(symbol):
    """Yahoo Finance 차트 API에서 (date, close, prev_close)를 반환. 실패 시 None."""
    url = (
        "https://query1.finance.yahoo.com/v8/finance/chart/"
        + urllib.parse.quote(symbol)
        + "?range=7d&interval=1d"
    )
    data = json.loads(_download(url))
    results = (data.get("chart") or {}).get("result") or []
    if not results:
        return None
    result = results[0]
    quote = ((result.get("indicators") or {}).get("quote") or [{}])[0]
    closes = quote.get("close") or []
    stamps = result.get("timestamp") or []
    pairs = [(t, c) for t, c in zip(stamps, closes) if c is not None]
    if len(pairs) >= 2:
        prev_close = float(pairs[-2][1])
        last_t, last_c = pairs[-1]
        date = datetime.fromtimestamp(last_t, KST).strftime("%Y-%m-%d")
        return date, float(last_c), prev_close
    # 폴백: 값이 하나뿐이면 meta의 전일 종가를 쓴다.
    meta = result.get("meta") or {}
    last_c = meta.get("regularMarketPrice")
    prev_close = meta.get("chartPreviousClose", meta.get("previousClose"))
    if last_c is None or prev_close is None:
        return None
    t = meta.get("regularMarketTime")
    date = datetime.fromtimestamp(t, KST).strftime("%Y-%m-%d") if t else ""
    return date, float(last_c), float(prev_close)


def fetch_one(name, sym, extra=None):
    """한 종목의 최신 스냅샷 dict를 반환. 실패 시 None."""
    try:
        res = fetch_last_two(sym)
    except (urllib.error.URLError, TimeoutError, OSError,
            ValueError, KeyError, IndexError, TypeError) as e:
        print(f"[warn] {name}({sym}) 조회 실패: {e}")
        return None
    if not res:
        print(f"[warn] {name}({sym}) 데이터 없음")
        return None
    date, close, prev_close = res
    change = (close - prev_close) / prev_close * 100 if prev_close else 0.0
    # 환율처럼 값이 작으면 소수 자릿수를 더 준다.
    precision = 4 if abs(close) < 10 else 2
    item = {"name": name, "close": round(close, precision), "change": round(change, 2), "date": date}
    if extra:
        item.update(extra)
    print(f"[ok] {name}: {close} ({change:+.2f}%)")
    return item


def load_prev():
    if not os.path.exists(OUT):
        return {}, {}
    try:
        with open(OUT, encoding="utf-8") as f:
            data = json.load(f)
        idx = {it["name"]: it for it in data.get("indices", [])}
        fx = {it["name"]: it for it in data.get("fx", [])}
        return idx, fx
    except (OSError, json.JSONDecodeError):
        return {}, {}


def build():
    prev_idx, prev_fx = load_prev()
    indices = []
    for name, sym in INDICES:
        item = fetch_one(name, sym)
        if not item and name in prev_idx:
            print(f"[info] {name} 이전 값 유지")
            item = prev_idx[name]
        if item:
            indices.append(item)

    fx = []
    for name, sym, unit in FX:
        item = fetch_one(name, sym, {"unit": unit})
        if not item and name in prev_fx:
            print(f"[info] {name} 이전 값 유지")
            item = prev_fx[name]
        if item:
            fx.append(item)

    return indices, fx


def fmt_num(v):
    return f"{v:,.2f}" if v < 10000 else f"{v:,.0f}"


def make_summary(indices, fx, as_of):
    parts = [f"{it['name']} {fmt_num(it['close'])}({it['change']:+.1f}%)" for it in indices]
    text = f"{as_of} 마감 — " + ", ".join(parts)
    fx_parts = [
        f"{it['name']} {fmt_num(it['close'])}({it['change']:+.1f}%)"
        for it in fx if it.get("change") is not None
    ]
    if fx_parts:
        text += " · " + ", ".join(fx_parts)
    return text + "."


def main():
    indices, fx = build()
    if not indices:
        print("[error] 수집된 지수가 없어 종료 (기존 파일 유지)")
        return
    as_of = max(it["date"] for it in indices)
    summary = make_summary(indices, fx, as_of)
    data = {
        "asOf": as_of,
        "updatedAt": datetime.now(KST).isoformat(timespec="minutes"),
        "summary": summary,
        "indices": indices,
        "fx": fx,
    }
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"[ok] {OUT} 갱신: {summary}")


if __name__ == "__main__":
    main()
