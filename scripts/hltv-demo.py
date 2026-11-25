#!/usr/bin/env python3
# HLTV demo resolver/downloader for CS2 NEXUS.
# Uses curl_cffi's browser impersonation so Electron never sees a Cloudflare challenge.
import argparse
import json
import os
import re
import shutil
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.parse import urljoin

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "vendor" / "py"))

try:
    from curl_cffi import requests
    from bs4 import BeautifulSoup
except Exception as exc:  # pragma: no cover - surfaced to the Electron UI
    print(json.dumps({"type": "error", "message": f"Python 依赖不可用: {exc}"}, ensure_ascii=False), flush=True)
    raise SystemExit(1)

HLTV = "https://www.hltv.org"
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36 Edg/157.0.0.0"
)
COMMON = {
    "User-Agent": UA,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Sec-CH-UA": '"Microsoft Edge";v="157", "Chromium";v="157", "Not_A Brand";v="24"',
    "Sec-CH-UA-Mobile": "?0",
    "Sec-CH-UA-Platform": '"Windows"',
}


def emit(obj):
    print(json.dumps(obj, ensure_ascii=False), flush=True)


def fail(message, code="ERROR"):
    emit({"type": "error", "code": code, "message": message})
    raise SystemExit(1)


def is_challenge(text):
    low = (text or "")[:20000].lower()
    return (
        "just a moment" in low
        or "checking your browser" in low
        or "attention required" in low
        or "cf-challenge" in low
        or "enable javascript and cookies to continue" in low
    )


def fetch(url, referer=None, timeout=45, allow_redirects=True, accept_404=False, accept_status=(200,)):
    headers = dict(COMMON)
    if referer:
        headers["Referer"] = referer
    last = None
    # edge101 currently clears the main site; safari184 is a second good profile.
    for imp in ("edge101", "safari184", "chrome136"):
        try:
            r = requests.get(
                url,
                impersonate=imp,
                headers=headers,
                timeout=timeout,
                allow_redirects=allow_redirects,
            )
            if r.status_code == 404 and accept_404:
                return r
            if r.status_code in accept_status and not is_challenge(r.text):
                return r
            last = f"HTTP {r.status_code} ({imp})"
        except Exception as exc:
            last = f"{type(exc).__name__}: {exc} ({imp})"
    fail(f"HLTV 页面访问失败: {last}")


def norm(text):
    return re.sub(r"[^a-z0-9]+", "", (text or "").lower())


def both_teams(html, team1, team2):
    low = (html or "").lower()
    a, b = (team1 or "").strip().lower(), (team2 or "").strip().lower()
    if not a or not b:
        return False
    if a in low and b in low:
        return True
    # Some pages render logo titles with punctuation/spacing differences.
    compact = norm(html)
    return norm(a) in compact and norm(b) in compact


def match_id_from_href(href):
    m = re.search(r"/matches/(\d+)/", href or "")
    return m.group(1) if m else ""


def find_match_url(match_id, team1, team2, plan_ts):
    numeric = re.search(r"(\d+)", str(match_id or ""))
    if numeric:
        # HLTV accepts any slug after the numeric id and redirects to the canonical URL.
        # Bare /matches/{id} returns 404, so always append /x.
        url = f"{HLTV}/matches/{numeric.group(1)}/x"
        r = fetch(url, referer=f"{HLTV}/results", accept_404=True)
        if r.status_code == 200 and "/matches/" in str(r.url) and both_teams(r.text, team1, team2):
            return r.url

    # Fall back to recent results pages. Date-filtered result URLs are challenged,
    # but offset pagination works; keep only a result close to the scheduled time.
    try:
        target = int(plan_ts)
    except Exception:
        target = 0
    for offset in range(0, 900, 100):
        r = fetch(f"{HLTV}/results?offset={offset}", referer=f"{HLTV}/results")
        soup = BeautifulSoup(r.text, "lxml")
        best = None
        for a in soup.select('a[href*="/matches/"]'):
            box = a.find_parent(class_="result-con") or a.parent
            text = box.get_text(" ", strip=True) if box else ""
            if not both_teams(text, team1, team2):
                continue
            mid = match_id_from_href(a.get("href", ""))
            if not mid:
                continue
            stamp = 0
            holder = box
            while holder is not None and stamp == 0:
                raw = holder.get("data-zonedgrouping-entry-unix") if hasattr(holder, "get") else None
                if raw and str(raw).isdigit():
                    stamp = int(raw)
                holder = holder.parent
            distance = abs(stamp - target) if stamp and target else 999999
            if distance <= 172800 and (best is None or distance < best[0]):
                best = (distance, mid)
        if best:
            url = f"{HLTV}/matches/{best[1]}/x"
            page = fetch(url, referer=f"{HLTV}/results")
            if both_teams(page.text, team1, team2):
                return page.url
    return ""


def demo_link(html):
    soup = BeautifulSoup(html, "lxml")
    el = soup.select_one("[data-demo-link]")
    if el:
        value = el.get("data-demo-link") or ""
        if value:
            return value
    m = re.search(r'data-demo-link="([^"]+)"', html or "", re.I)
    if m:
        return m.group(1)
    m = re.search(r'href="(/download/demo/\d+)"', html or "", re.I)
    return m.group(1) if m else ""


def resolve(args):
    page_url = find_match_url(args.match_id, args.team1, args.team2, args.plan_ts)
    if not page_url:
        fail("HLTV 未找到对应比赛（可能尚未收录或队名不一致）", "NOT_FOUND")
    page = fetch(page_url, referer=f"{HLTV}/results")
    href = demo_link(page.text)
    if not href:
        fail("该场 HLTV 页面暂无 Demo（比赛可能尚未结束或 demo 未上传）", "NO_DEMO")
    soup = BeautifulSoup(page.text, "lxml")
    title = soup.title.get_text(" ", strip=True) if soup.title else ""
    mid = match_id_from_href(page_url)
    emit(
        {
            "type": "result",
            "ok": True,
            "matchId": args.match_id,
            "hltvId": mid,
            "pageUrl": page_url,
            "demoPage": urljoin(HLTV, href),
            "title": title,
            "team1": args.team1,
            "team2": args.team2,
        }
    )


def r2_range(location, page, start, end, timeout=35):
    headers = {
        **COMMON,
        "Accept": "*/*",
        "Accept-Encoding": "identity",
        "Connection": "close",
        "Referer": page,
        "Range": f"bytes={start}-{end}",
    }
    last = None
    # R2 currently challenges Chromium fingerprints but serves Firefox via Range.
    for imp in ("firefox144", "firefox135", "safari184", "edge101"):
        try:
            r = requests.get(
                location,
                impersonate=imp,
                headers=headers,
                timeout=timeout,
                stream=True,
                allow_redirects=True,
            )
            if r.status_code == 206:
                return r
            last = f"HTTP {r.status_code} ({imp})"
            r.close()
        except Exception as exc:
            last = f"{type(exc).__name__}: {exc} ({imp})"
    raise RuntimeError(f"R2 分段请求失败: {last}")


def download(args):
    page = args.download_page
    if not page:
        fail("缺少 Demo 下载页地址")
    r = fetch(
        page,
        referer=args.match_page or f"{HLTV}/",
        timeout=60,
        allow_redirects=False,
        accept_status=(200, 301, 302, 303, 307, 308),
    )
    location = r.headers.get("location") or ""
    if not location:
        # A direct RAR response is possible, but HLTV normally redirects to R2.
        if "rar" in (r.headers.get("content-type") or "").lower():
            location = page
        else:
            fail("HLTV 未返回 Demo 下载地址（可能被安全校验拦截）", "NO_REDIRECT")
    location = urljoin(page, location)

    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    part = out.with_suffix(out.suffix + ".part")
    for stale in [part, *part.parent.glob(part.name + ".*.chunk")]:
        try:
            stale.unlink()
        except Exception:
            pass

    probe = None
    last = None
    for imp in ("firefox144", "firefox135", "safari184", "edge101"):
        try:
            candidate = requests.get(
                location,
                impersonate=imp,
                headers={**COMMON, "Accept": "*/*", "Referer": page, "Range": "bytes=0-0"},
                timeout=60,
                stream=True,
                allow_redirects=True,
            )
            if candidate.status_code == 206:
                probe = candidate
                break
            last = f"HTTP {candidate.status_code} ({imp})"
            candidate.close()
        except Exception as exc:
            last = f"{type(exc).__name__}: {exc} ({imp})"
    if probe is None:
        fail(f"Demo 文件探测失败: {last}", "DOWNLOAD_BLOCKED")

    total = 0
    m = re.search(r"/(\d+)\s*$", probe.headers.get("content-range") or "")
    if m:
        total = int(m.group(1))
    probe.close()
    if total < 1024:
        fail("Demo 文件大小异常", "EMPTY")

    # A single long R2 connection can stall. Download bounded ranges in parallel
    # and only merge after every chunk is complete and verified.
    CHUNK = 8 * 1024 * 1024
    WORKERS = 4
    chunks = []
    for i, start in enumerate(range(0, total, CHUNK)):
        end = min(total - 1, start + CHUNK - 1)
        chunks.append((i, start, end, part.with_suffix(part.suffix + f".{i}.chunk")))

    started = time.time()
    lock = threading.Lock()
    done = [0]
    last_emit = [0.0]

    def emit_progress():
        now = time.time()
        with lock:
            received_now = done[0]
            if now - last_emit[0] < 0.35:
                return
            last_emit[0] = now
        emit({
            "type": "progress",
            "received": received_now,
            "total": total,
            "percent": received_now / total * 100.0,
        })

    def fetch_chunk(item):
        idx, start, end, dest = item
        expected = end - start + 1
        last_err = None
        for attempt in range(5):
            try:
                resp = r2_range(location, page, start, end)
                got = 0
                with open(dest, "wb") as fh:
                    for buf in resp.iter_content(1024 * 1024):
                        if not buf:
                            continue
                        fh.write(buf)
                        got += len(buf)
                resp.close()
                if got == expected:
                    with lock:
                        done[0] += got
                    emit_progress()
                    return got
                last_err = f"分段 {idx} 长度不符 {got}/{expected}"
            except Exception as exc:
                last_err = f"分段 {idx}: {type(exc).__name__}: {exc}"
            try:
                dest.unlink()
            except Exception:
                pass
            time.sleep(1 + attempt)
        raise RuntimeError(last_err or f"分段 {idx} 下载失败")

    try:
        with ThreadPoolExecutor(max_workers=WORKERS) as pool:
            futures = [pool.submit(fetch_chunk, item) for item in chunks]
            for future in as_completed(futures):
                future.result()
        with open(part, "wb") as out_fh:
            for _, _, _, dest in chunks:
                with open(dest, "rb") as src:
                    shutil.copyfileobj(src, out_fh, 1024 * 1024)
        for _, _, _, dest in chunks:
            try:
                dest.unlink()
            except Exception:
                pass
    except Exception as exc:
        for _, _, _, dest in chunks:
            try:
                dest.unlink()
            except Exception:
                pass
        try:
            part.unlink()
        except Exception:
            pass
        fail(str(exc), "DOWNLOAD_FAILED")

    received = part.stat().st_size
    if received < 1024:
        try:
            part.unlink()
        except Exception:
            pass
        fail("Demo 文件为空或下载被截断", "EMPTY")
    with open(part, "rb") as fh:
        magic = fh.read(8)
    if not magic.startswith(b"Rar!"):
        try:
            part.unlink()
        except Exception:
            pass
        fail("下载内容不是有效 RAR（可能被安全校验替换为网页）", "NOT_RAR")

    os.replace(part, out)
    emit(
        {
            "type": "result",
            "ok": True,
            "output": str(out),
            "bytes": received,
            "total": total,
            "seconds": round(time.time() - started, 1),
        }
    )


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("resolve")
    p.add_argument("--match-id", default="")
    p.add_argument("--team1", default="")
    p.add_argument("--team2", default="")
    p.add_argument("--plan-ts", type=int, default=0)

    d = sub.add_parser("download")
    d.add_argument("--download-page", required=True)
    d.add_argument("--match-page", default="")
    d.add_argument("--output", required=True)

    args = parser.parse_args()
    if args.cmd == "resolve":
        resolve(args)
    else:
        download(args)


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception as exc:
        fail(f"Demo 链路异常: {type(exc).__name__}: {exc}")
