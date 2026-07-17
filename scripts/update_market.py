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

# 표시명 -> Yahoo 심볼, 단위, 한 줄 설명 (핵심 지표·원자재)
EXTRA = [
    ("미 10년물 국채", "^TNX", "%", "장기 금리. 오르면 주식 밸류에이션·대출에 부담"),
    ("미 3개월 국채", "^IRX", "%", "단기 금리. 연준 정책금리와 비슷하게 움직임"),
    ("VIX 공포지수", "^VIX", "pt", "시장 불안이 커지면 상승(공포지수)"),
    ("금", "GC=F", "$/oz", "대표 안전자산. 불안·금리↓일 때 강세"),
    ("WTI 유가", "CL=F", "$/bbl", "오르면 물가·기업 비용 ↑"),
    ("구리", "HG=F", "$/lb", "경기 민감해 '닥터 코퍼'로 불림"),
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

    prev_extra = {}
    if os.path.exists(OUT):
        try:
            with open(OUT, encoding="utf-8") as f:
                prev_extra = {it["name"]: it for it in json.load(f).get("extra", [])}
        except (OSError, json.JSONDecodeError):
            prev_extra = {}
    extra = []
    for name, sym, unit, note in EXTRA:
        item = fetch_one(name, sym, {"unit": unit, "note": note})
        if not item and name in prev_extra:
            print(f"[info] {name} 이전 값 유지")
            item = prev_extra[name]
        if item:
            extra.append(item)

    return indices, fx, extra


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


def _pick(items, name):
    for it in items:
        if it["name"] == name:
            return it
    return None


def _dir_word(items):
    ups = [it for it in items if (it.get("change") or 0) > 0]
    downs = [it for it in items if (it.get("change") or 0) < 0]
    if ups and not downs:
        return "일제히 상승"
    if downs and not ups:
        return "일제히 하락"
    return "혼조"


def make_brief(indices, fx, extra, as_of):
    """어제 증시에 무슨 일이 있었는지 데이터로 만든 5줄 요약."""
    def g(name):
        return _pick(indices, name)

    def line(it):
        return f"{it['name']} {it['change']:+.1f}%" if it else ""

    us = [g("S&P500"), g("나스닥"), g("다우존스"), g("러셀2000")]
    us = [x for x in us if x]
    kr = [g("코스피"), g("코스닥")]
    kr = [x for x in kr if x]
    nk = g("니케이225")
    krw = _pick(fx, "원/달러")
    tnx = _pick(extra, "미 10년물 국채")

    all_idx = [x for x in indices if x.get("change") is not None]
    top = max(all_idx, key=lambda x: x["change"]) if all_idx else None
    bottom = min(all_idx, key=lambda x: x["change"]) if all_idx else None

    lines = []
    if us:
        lines.append(f"🇺🇸 뉴욕증시 {_dir_word(us)} — " + ", ".join(line(x) for x in us))
    if kr:
        lines.append(f"🇰🇷 한국증시 {_dir_word(kr)} — " + ", ".join(line(x) for x in kr))
    if nk:
        lines.append(f"🇯🇵 니케이225 {nk['change']:+.1f}%")
    fx_bits = []
    if krw:
        fx_bits.append(f"원/달러 {fmt_num(krw['close'])}원({krw['change']:+.1f}%)")
    if tnx:
        fx_bits.append(f"미 10년물 {tnx['close']}%")
    if fx_bits:
        lines.append("💱 " + " · ".join(fx_bits))
    if top and bottom:
        lines.append(f"📌 최대 상승 {top['name']} {top['change']:+.1f}% / 최대 하락 {bottom['name']} {bottom['change']:+.1f}%")
    return f"{as_of} 기준", lines[:5]


def add_spread(extra):
    """장단기 금리차(10년-3개월). 마이너스면 경기침체 신호."""
    tnx = _pick(extra, "미 10년물 국채")
    irx = _pick(extra, "미 3개월 국채")
    if tnx and irx:
        spread = round(tnx["close"] - irx["close"], 2)
        extra.append({
            "name": "장단기 금리차(10Y-3M)",
            "close": spread,
            "change": None,
            "unit": "%p",
            "note": "마이너스(역전)면 경기침체 신호로 해석돼요",
        })


def fetch_fng():
    """공포·탐욕 지수(alternative.me, 무료). 실패 시 None."""
    try:
        raw = _download("https://api.alternative.me/fng/?limit=1")
        d = json.loads(raw)["data"][0]
        return {"value": int(d["value"]), "label": d.get("value_classification", "")}
    except (urllib.error.URLError, TimeoutError, OSError, ValueError, KeyError, IndexError) as e:
        print(f"[warn] 공포탐욕지수 실패: {e}")
        return None


def main():
    indices, fx, extra = build()
    if not indices:
        print("[error] 수집된 지수가 없어 종료 (기존 파일 유지)")
        return
    add_spread(extra)
    as_of = max(it["date"] for it in indices)
    summary = make_summary(indices, fx, as_of)
    brief_as_of, brief = make_brief(indices, fx, extra, as_of)
    fng = fetch_fng()
    prev_fng = None
    if os.path.exists(OUT):
        try:
            with open(OUT, encoding="utf-8") as f:
                prev_fng = json.load(f).get("fng")
        except (OSError, json.JSONDecodeError):
            prev_fng = None
    data = {
        "asOf": as_of,
        "updatedAt": datetime.now(KST).isoformat(timespec="minutes"),
        "summary": summary,
        "brief": brief,
        "briefAsOf": brief_as_of,
        "fng": fng or prev_fng,
        "indices": indices,
        "fx": fx,
        "extra": extra,
    }
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"[ok] {OUT} 갱신: {summary}")


if __name__ == "__main__":
    main()
