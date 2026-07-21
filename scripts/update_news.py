#!/usr/bin/env python3
"""홈 '뉴스' 피드용 최신 기사를 Google 뉴스 RSS(한국어)에서 받아
data/auto_news.json을 갱신한다.

손으로 쓴 깊이 있는 해설(posts.json)은 그대로 두고, 이 파일은 매일 자동으로
갱신되는 '가벼운 뉴스 카드'를 담는다. 카드마다 카테고리별로 미리 준비한
'내 삶에 미치는 영향' 한 줄과 배경 설명을 붙여, 초보도 왜 봐야 하는지 알 수 있게 한다.

외부 의존성 없이 표준 라이브러리만 사용.
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

# (카테고리, 검색어, 난이도, 내 삶에 미치는 영향, 배경 설명)
CATEGORIES = [
    ("거시경제", "물가 CPI GDP 경제성장", "기본",
     "물가·성장률 흐름은 내 월급의 실질 가치와 소비 여력에 직결돼요.",
     "물가(CPI)·성장률(GDP)·고용 같은 '큰 그림' 지표를 다루는 뉴스예요. 경제의 체온을 보여줘요."),
    ("금리·통화정책", "기준금리 한국은행 연준 통화정책", "기본",
     "금리가 움직이면 대출이자·예금이자, 그리고 주식·부동산까지 함께 출렁여요.",
     "중앙은행(한국은행·미국 연준)의 금리 결정과 그 배경을 다루는 뉴스예요."),
    ("증시", "코스피 코스닥 증시 주가", "기본",
     "내 주식·펀드·퇴직연금 수익률에 바로 영향을 줘요.",
     "국내외 주식시장이 오르내린 이유와 흐름을 짚어주는 뉴스예요."),
    ("환율", "환율 원달러 달러", "기본",
     "환율이 오르면 해외직구·여행 경비와 수입 물가가 같이 올라가요.",
     "원/달러 등 환율 변동과 배경을 다루는 뉴스예요. 수출입·물가와 밀접해요."),
    ("부동산", "부동산 아파트 집값 분양", "기본",
     "집값·전세·대출 조건 변화는 내 집 마련 계획을 좌우해요.",
     "주택 가격, 분양, 대출 규제 등 부동산 시장 소식이에요."),
    ("반도체", "반도체 삼성전자 SK하이닉스", "기본",
     "한국 경제의 기둥 산업이라 수출·고용·증시 전반에 파급돼요.",
     "AI·스마트폰의 핵심인 반도체 산업 소식이에요. 한국 수출의 큰 축이에요."),
    ("AI·기술", "AI 인공지능 빅테크", "기본",
     "관련 기업 주가와 일자리 지형, 서비스 이용 방식까지 바꿔요.",
     "인공지능과 기술 기업 관련 뉴스예요. 투자·일자리 트렌드와 연결돼요."),
    ("코인·가상자산", "비트코인 이더리움 가상자산", "기본",
     "변동성이 커요 — 투자한다면 감당 가능한 범위인지 꼭 확인하세요.",
     "비트코인 등 디지털 자산 시세와 이슈를 다루는 뉴스예요."),
    ("고용·노동", "고용 취업자 실업률 임금", "기본",
     "일자리·임금 흐름은 취업·이직과 내 소득에 직접 영향을 줘요.",
     "일자리, 임금, 실업률 등 노동시장 지표 뉴스예요. 경기의 체온계예요."),
    ("재테크", "재테크 ISA 연금 절세 투자", "왕초보",
     "예적금·ETF·절세 전략 등 내 돈을 지키고 불리는 실전 정보예요.",
     "월급 외 자산을 불리는 실전 재테크 정보예요. 초보도 바로 써먹을 수 있어요."),
]
PER_CATEGORY = 2  # 카테고리당 최신 기사 수

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "auto_news.json")
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
    if source and title.endswith(f" - {source}"):
        return title[: -(len(source) + 3)].strip()
    return title.strip()


def fetch_category(query):
    q = urllib.parse.quote(query)
    url = f"https://news.google.com/rss/search?q={q}&hl=ko&gl=KR&ceid=KR:ko"
    raw = _download(url)
    root = ET.fromstring(raw)
    out = []
    for item in root.iter("item"):
        title = (item.findtext("title") or "").strip()
        link = (item.findtext("link") or "").strip()
        pub = item.findtext("pubDate") or ""
        src_el = item.find("source")
        source = (src_el.text or "").strip() if src_el is not None else ""
        if not title or not link:
            continue
        out.append({
            "title": clean_title(title, source),
            "source": source,
            "link": link,
            "date": to_date(pub),
        })
        if len(out) >= PER_CATEGORY:
            break
    return out


def main():
    posts = []
    ok_any = False
    for category, query, level, impact, context in CATEGORIES:
        try:
            items = fetch_category(query)
            ok_any = ok_any or bool(items)
            print(f"[ok] {category}: {len(items)}건")
        except (urllib.error.URLError, TimeoutError, OSError, ET.ParseError) as e:
            print(f"[warn] {category} 수집 실패: {e}")
            items = []
        for it in items:
            summary = (
                f"{context}\n"
                f"💡 {impact}\n"
                f"자세한 내용은 아래 '원문 보기'에서 확인하세요."
            )
            posts.append({
                "id": f"auto-{category}-{abs(hash(it['link'])) % (10 ** 10)}",
                "title": it["title"],
                "source": it["source"] or "Google 뉴스",
                "url": it["link"],
                "category": category,
                "level": level,
                "impact": impact,
                "date": it["date"],
                "summary": summary,
                "auto": True,
            })

    # 이번에 전부 실패하면 기존 파일을 보존한다.
    if not ok_any:
        print("[error] 전체 수집 실패 — 기존 auto_news.json 유지")
        return

    posts.sort(key=lambda p: p.get("date", ""), reverse=True)
    data = {
        "updatedAt": datetime.now(KST).isoformat(timespec="minutes"),
        "posts": posts,
    }
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"[ok] {OUT} 갱신 완료 ({len(posts)}건)")


if __name__ == "__main__":
    main()
