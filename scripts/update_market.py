#!/usr/bin/env python3
"""매일 주요 지수 종가를 Stooq(무료)에서 받아 data/market.json을 갱신하고,
NTFY_TOPIC 환경변수가 있으면 ntfy.sh로 증시 요약 푸시를 보낸다.

GitHub Actions에서 실행되며 외부 의존성 없이 표준 라이브러리만 사용한다.
"""
import json
import os
import time
import urllib.request
import urllib.error
from datetime import datetime, timezone, timedelta

# 표시명 -> Stooq 심볼 (지수)
INDICES = [
    ("코스피", "^kospi"),
    ("코스닥", "^kosdaq"),
    ("S&P500", "^spx"),
    ("나스닥", "^ndq"),
    ("다우존스", "^dji"),
    ("러셀2000", "^rut"),
    ("니케이225", "^nkx"),
]

# 표시명 -> Stooq 심볼, 단위 (환율)
FX = [
    ("원/달러", "usdkrw", "원"),
    ("엔/달러", "usdjpy", "엔"),
    ("유로/달러", "eurusd", "$"),
    ("파운드/달러", "gbpusd", "$"),
    ("위안/달러", "usdcny", "위안"),
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
    """Stooq 일봉 CSV에서 (date, close, prev_close)를 반환. 실패 시 None."""
    url = f"https://stooq.com/q/d/l/?s={symbol}&i=d"
    text = _download(url)
    lines = [ln for ln in text.splitlines() if ln.strip()]
    if len(lines) < 3 or not lines[0].lower().startswith("date"):
        return None
    # Date,Open,High,Low,Close,Volume
    last = lines[-1].split(",")
    prev = lines[-2].split(",")
    try:
        date = last[0]
        close = float(last[4])
        prev_close = float(prev[4])
    except (IndexError, ValueError):
        return None
    return date, close, prev_close


def fetch_one(name, sym, extra=None):
    """한 종목의 최신 스냅샷 dict를 반환. 실패 시 None."""
    try:
        res = fetch_last_two(sym)
    except (urllib.error.URLError, TimeoutError, OSError) as e:
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


def should_notify():
    """알림은 하루 1번(07:00 KST 아침 브리핑)만. 수동 실행(NTFY_FORCE)은 항상 전송."""
    if os.environ.get("NTFY_FORCE", "").strip():
        return True
    return datetime.now(KST).hour == 7


def notify(summary):
    topic = os.environ.get("NTFY_TOPIC", "").strip()
    if not topic:
        print("[info] NTFY_TOPIC 미설정, 알림 건너뜀")
        return
    if not should_notify():
        print("[info] 아침 브리핑 시간이 아니라 알림 건너뜀 (데이터만 갱신)")
        return
    payload = json.dumps({
        "topic": topic,
        "title": "Daily Market Brief",
        "message": summary,
        "tags": ["chart_with_upwards_trend"],
    }).encode("utf-8")
    for i in range(3):
        try:
            req = urllib.request.Request(
                "https://ntfy.sh",
                data=payload,
                headers={"Content-Type": "application/json"},
            )
            with urllib.request.urlopen(req, timeout=30) as resp:
                print(f"[ok] ntfy 전송 완료 ({resp.status})")
            return
        except (urllib.error.URLError, OSError) as e:
            print(f"[warn] ntfy 전송 실패({i + 1}/3): {e}")
            if i < 2:
                time.sleep(2 * (i + 1))


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
    notify(summary)


if __name__ == "__main__":
    main()
