#!/usr/bin/env python3
"""산업 섹터별 최신 뉴스를 Google 뉴스 RSS(한국어 로케일)에서 받아
data/sector_news.json을 갱신한다.

한국어 로케일(hl=ko&gl=KR&ceid=KR:ko)로 조회하므로 결과가 이미 한국어라
별도 번역 API 없이 한국어 헤드라인을 얻는다. 외부 의존성 없이 표준 라이브러리만 사용.
"""
import json
import os
import time
import urllib.parse
import urllib.request
import urllib.error
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta
from email.utils import parsedate_to_datetime

# (표시 섹터, 검색어)
SECTORS = [
    ("조선", "조선업 수주"),
    ("건설", "건설업"),
    ("반도체", "반도체"),
    ("AI", "인공지능 AI"),
    ("에너지", "에너지 전력"),
    ("금융", "금융 증시"),
    ("헬스케어", "헬스케어 제약바이오"),
    ("부동산", "부동산 아파트 분양"),
    ("코인·가상자산", "비트코인 가상자산"),
    ("세계경제", "세계경제 무역 관세"),
    ("채권·금리", "국채 금리 채권"),
    ("고용·노동", "고용 실업률 취업자"),
    ("재테크", "재테크 자산관리 투자"),
    ("쉬운 경제", "경제 상식 쉽게 설명"),
]
PER_SECTOR = 6

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "sector_news.json")
KST = timezone(timedelta(hours=9))


def _download(url, attempts=3):
    last_err = None
    for i in range(attempts):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=30) as resp:
                return resp.read()
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            last_err = e
            if i < attempts - 1:
                time.sleep(2 * (i + 1))
    raise last_err


def to_date(pubdate):
    try:
        return parsedate_to_datetime(pubdate).astimezone(KST).strftime("%Y-%m-%d")
    except (TypeError, ValueError):
        return ""


def clean_title(title, source):
    # Google 뉴스는 종종 "제목 - 언론사" 형태로 준다. 뒤의 언론사명을 떼어낸다.
    if source and title.endswith(f" - {source}"):
        return title[: -(len(source) + 3)].strip()
    return title.strip()


def fetch_sector(query):
    q = urllib.parse.quote(query)
    url = f"https://news.google.com/rss/search?q={q}&hl=ko&gl=KR&ceid=KR:ko"
    raw = _download(url)
    root = ET.fromstring(raw)
    items = []
    for item in root.iter("item"):
        title = (item.findtext("title") or "").strip()
        link = (item.findtext("link") or "").strip()
        pub = item.findtext("pubDate") or ""
        src_el = item.find("source")
        source = (src_el.text or "").strip() if src_el is not None else ""
        if not title or not link:
            continue
        items.append({
            "title": clean_title(title, source),
            "source": source,
            "link": link,
            "date": to_date(pub),
        })
        if len(items) >= PER_SECTOR:
            break
    return items


def main():
    result = {}
    for name, query in SECTORS:
        try:
            items = fetch_sector(query)
            print(f"[ok] {name}: {len(items)}건")
        except (urllib.error.URLError, TimeoutError, OSError, ET.ParseError) as e:
            print(f"[warn] {name} 수집 실패, 기존값 유지 대상: {e}")
            items = None
        result[name] = items

    # 기존 파일을 읽어, 이번에 실패한 섹터는 이전 데이터를 보존한다.
    prev = {}
    if os.path.exists(OUT):
        try:
            with open(OUT, encoding="utf-8") as f:
                prev = json.load(f).get("sectors", {})
        except (OSError, json.JSONDecodeError):
            prev = {}

    sectors = {}
    for name, _ in SECTORS:
        fresh = result.get(name)
        sectors[name] = fresh if fresh else prev.get(name, [])

    if not any(sectors.values()):
        print("[error] 모든 섹터 수집 실패, 파일 유지")
        return

    data = {
        "updatedAt": datetime.now(KST).isoformat(timespec="minutes"),
        "sectors": sectors,
    }
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"[ok] {OUT} 갱신 완료")


if __name__ == "__main__":
    main()
