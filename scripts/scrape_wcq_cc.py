#!/usr/bin/env python3
"""Scrape CC course areas from WCQ (w5.ab.ust.hk) — authoritative ground truth.

Each WCQ area page (e.g. /2610/common_core/CC26/53 = area S for students
admitted from 2026) lists courses with that area.  We scrape:

  2610 (2026-27 Fall)  CC22 20-32, CC25 33-46, CC26 47-60
  2540 (2025-26 Summer) CC22 20-32, CC25 33-46
  2530 (2025-26 Spring) CC22 20-32, CC25 33-46
  2520 (2025-26 Winter) CC22 20-32, CC25 33-46

Merge into: {code: {title, units, prev, cc22: [areas], cc25: [areas],
cc26: [areas], terms: [term names where offered]}}
Caches pages in /tmp/wcq_cache/; writes data/wcq_cc_areas.json.
"""
import json
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# area id -> area label per group (same for all groups)
CC22_AREAS = {'20': 'CTDL', '21': 'HMW', '22': 'E-Comm', '23': 'C-Comm',
              '24': 'A', '25': 'H', '26': 'S', '27': 'T', '28': 'SA',
              '29': 'UXOP', '30': 'UXOP', '31': 'UXOP', '32': 'UXOP'}
CC25_AREAS = {'33': 'CTDL', '34': 'HMW', '35': 'E-Comm', '36': 'C-Comm',
              '37': 'A', '38': 'H', '39': 'S', '40': 'T', '41': 'SA',
              '42': 'SUS', '43': 'UXOP', '44': 'UXOP', '45': 'UXOP', '46': 'UXOP'}
CC26_AREAS = {'47': 'HAIC', '48': 'HMW', '49': 'E-Comm', '50': 'C-Comm',
              '51': 'A', '52': 'H', '53': 'S', '54': 'T', '55': 'SA',
              '56': 'SUS', '57': 'UXOP', '58': 'UXOP', '59': 'UXOP', '60': 'UXOP'}

JOBS = []  # (term, group_key, group, area_id, area)
for term in ('2610', '2540', '2530', '2520'):
    for gid, gname, gareas in (('CC22', 'cc22', CC22_AREAS),):
        for aid, area in gareas.items():
            JOBS.append((term, gid, gname, aid, area))
    for gid, gname, gareas in (('CC25', 'cc25', CC25_AREAS),):
        for aid, area in gareas.items():
            JOBS.append((term, gid, gname, aid, area))
    if term == '2610':
        for aid, area in CC26_AREAS.items():
            JOBS.append((term, 'CC26', 'cc26', aid, area))

_session = requests.Session()
_session.mount('https://', HTTPAdapter(max_retries=Retry(
    total=2, backoff_factor=1.0, status_forcelist=[500, 502, 503, 504])))

SUBJECT_RE = re.compile(
    r"""<div\s+class=['"]subject['"]>([A-Z]{2,5}\s+\d{4}[A-Z]?)\s*-\s*(.*?)\s*\((\d+)\s*units?\)</div>""")

CACHE = Path('/tmp/wcq_cache')
CACHE.mkdir(exist_ok=True)


def fetch_job(job):
    term, gid, gname, aid, area = job
    url = f'https://w5.ab.ust.hk/wcq/cgi-bin/{term}/common_core/{gid}/{aid}'
    cf = CACHE / f'{term}_{gid}_{aid}.html'
    if not cf.exists():
        for attempt in range(3):
            try:
                resp = _session.get(url, timeout=(15, 60),
                                    headers={"User-Agent": "Mozilla/5.0"})
                if resp.status_code == 404:
                    return job, None, '404'
                resp.raise_for_status()
                cf.write_text(resp.text, encoding='utf-8')
                break
            except Exception as e:
                if attempt == 2:
                    return job, None, str(e)
                time.sleep(2 * (attempt + 1))
    html = cf.read_text(encoding='utf-8')
    courses = []
    for m in SUBJECT_RE.finditer(html):
        code, title, units = m.group(1), m.group(2), int(m.group(3))
        seg = html[m.end():m.end() + 4000]
        prevm = re.search(r'<th>PREVIOUS CODE</th><td>(.*?)</td>', seg, re.S)
        prev = re.sub(r'<[^>]+>', '', prevm.group(1)).strip() if prevm else ''
        courses.append((code, {'title': title, 'units': units, 'prev': prev}))
    return job, courses, None


def main():
    results = {}
    done, failed = 0, 0
    with ThreadPoolExecutor(max_workers=6) as ex:
        futs = {ex.submit(fetch_job, j): j for j in JOBS}
        for fut in as_completed(futs):
            job, courses, err = fut.result()
            done += 1
            if err:
                failed += 1
                if err != '404':
                    print(f'FAIL {job}: {err}', flush=True)
                continue
            term, gid, gname, aid, area = job
            for code, d in courses:
                e = results.setdefault(code, {
                    'title': d['title'], 'units': d['units'], 'prev': d['prev'],
                    'cc22': [], 'cc25': [], 'cc26': [], 'terms': set()})
                if d['prev']:
                    e['prev'] = d['prev']
                e[gname].append(area)
                e['terms'].add(term)
            if done % 20 == 0:
                print(f'{done}/{len(JOBS)} done, {len(results)} courses', flush=True)

    out = {}
    for code, e in results.items():
        out[code] = {
            'title': e['title'], 'units': e['units'], 'prev': e['prev'],
            'cc22': sorted(set(e['cc22'])), 'cc25': sorted(set(e['cc25'])),
            'cc26': sorted(set(e['cc26'])),
            'terms': sorted(e['terms']),
        }
    out_path = Path(__file__).resolve().parent.parent / "data" / "wcq_cc_areas.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=1, ensure_ascii=False)
    print(f"\nDONE {done} jobs, {failed} failed, {len(out)} unique courses -> {out_path}")


if __name__ == '__main__':
    main()
