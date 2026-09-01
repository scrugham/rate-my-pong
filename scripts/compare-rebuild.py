"""Replay production games.csv: logged board vs full rebuild. Not imported by the app."""

from __future__ import annotations

import csv
import json
import re
from collections import defaultdict

CSV_PATH = r"c:\Users\DanielScrugham\Downloads\games.csv"
UUID = re.compile(
    r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
    re.I,
)

START = 1000


def expected(a: float, b: float) -> float:
    return 1 / (1 + 10 ** ((b - a) / 400))


def parse_ids(cell: str) -> list[str]:
    return UUID.findall(cell)


def parse_score(cell: str) -> int | None:
    cell = (cell or "").strip()
    if cell == "":
        return None
    return int(cell)


def margin_mult(score_a, score_b, deuce, intercept, lo, hi):
    if score_a is None or score_b is None:
        m = 2 if deuce else 4
    else:
        m = abs(score_a - score_b)
        if deuce and m < 2:
            m = 2
    return min(hi, max(lo, intercept + m * 0.06))


def orig_delta(w_elo, l_elo, sa, sb, deuce):
    mov = margin_mult(sa, sb, deuce, 0.64, 0.72, 1.28)
    return max(1, round(32 * mov * (1 - expected(w_elo, l_elo))))


def new_delta(w_elo, l_elo, sa, sb, deuce, k):
    mov = margin_mult(sa, sb, deuce, 0.70, 0.82, 1.18)
    auto = 2.5 / ((w_elo - l_elo) / 400 + 2.5)
    return max(1, round(k * mov * auto * (1 - expected(w_elo, l_elo))))


def team(ids, elos, weighted: bool):
    vals = [elos[i] for i in ids]
    if len(vals) == 1:
        return vals[0]
    if not weighted:
        return sum(vals) / len(vals)
    weaker, stronger = min(vals), max(vals)
    return weaker * 0.65 + stronger * 0.35


rows = []
with open(CSV_PATH, newline="", encoding="utf-8") as f:
    for r in csv.DictReader(f):
        rows.append(r)

rows.sort(key=lambda r: r["played_at"])

logged: dict[str, dict] = {}
for r in rows:
    raw = r["elo_changes"]
    try:
        changes = json.loads(raw)
    except json.JSONDecodeError:
        changes = json.loads(raw.replace('""', '"'))
    for pid, snap in changes.items():
        prev = logged.get(pid, {"games": 0})
        logged[pid] = {"elo": snap["after"], "games": prev["games"] + 1}

orig = defaultdict(lambda: {"elo": START, "g": 0})
new = defaultdict(lambda: {"elo": START, "g": 0})

for r in rows:
    a = parse_ids(r["side_a"])
    b = parse_ids(r["side_b"])
    sa, sb = parse_score(r["score_a"]), parse_score(r["score_b"])
    deuce = r["went_to_deuce"].lower() == "true"
    winner = r["winner"]

    ta = team(a, {i: orig[i]["elo"] for i in a + b}, False)
    tb = team(b, {i: orig[i]["elo"] for i in a + b}, False)
    w, l = (ta, tb) if winner == "A" else (tb, ta)
    d = orig_delta(w, l, sa, sb, deuce)
    for pid in a:
        orig[pid]["elo"] += d if winner == "A" else -d
        orig[pid]["g"] += 1
    for pid in b:
        orig[pid]["elo"] += d if winner == "B" else -d
        orig[pid]["g"] += 1

    elos = {i: new[i]["elo"] for i in a + b}
    ta = team(a, elos, True)
    tb = team(b, elos, True)
    w, l = (ta, tb) if winner == "A" else (tb, ta)
    win_ids = a if winner == "A" else b
    lose_ids = b if winner == "A" else a
    for pid in win_ids:
        k = 64 if new[pid]["g"] < 10 else 32
        dlt = new_delta(w, l, sa, sb, deuce, k)
        new[pid]["elo"] += dlt
        new[pid]["g"] += 1
    for pid in lose_ids:
        k = 64 if new[pid]["g"] < 10 else 32
        dlt = new_delta(w, l, sa, sb, deuce, k)
        new[pid]["elo"] -= dlt
        new[pid]["g"] += 1

ids = sorted(logged, key=lambda i: -logged[i]["elo"])
print(f"{'id':10} {'G':>3} {'logged':>7} {'orig replay':>12} {'rebuild':>8} {'d vs now':>10}")
print("-" * 56)
for pid in ids:
    short = pid[:8]
    g = logged[pid]["games"]
    cur = logged[pid]["elo"]
    o = orig[pid]["elo"]
    n = new[pid]["elo"]
    print(f"{short:10} {g:3} {cur:7} {o:12} {n:8} {n - cur:+10}")

print()
print("logged pool", sum(v["elo"] for v in logged.values()), "n", len(logged))
print("orig pool  ", sum(orig[i]["elo"] for i in logged))
print("new pool   ", sum(new[i]["elo"] for i in logged))
print()
logged_rank = {pid: i + 1 for i, pid in enumerate(ids)}
new_order = sorted(logged, key=lambda i: (-new[i]["elo"], i))
print(f"{'id':10} {'now#':>4} {'new#':>4} {'shift':>6} {'now':>6} {'new':>6}")
for i, pid in enumerate(new_order, start=1):
    old = logged_rank[pid]
    print(
        f"{pid[:8]:10} {old:4} {i:4} {old - i:+6} {logged[pid]['elo']:6} {new[pid]['elo']:6}"
    )
