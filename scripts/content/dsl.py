"""레시피 작성용 짧은 표기.

R(...)   레시피 하나.
G(...)   재료 그룹. items는 "이름 수량단위" 문자열 목록. 수량이 없으면 이름만.
         subs는 {재료이름: [(대체재이름 또는 (이름, 이름), fit, 메모), ...]}.
steps    (문장, 타이머초 또는 None) 목록.
water    (이름, ml) 목록.
"""
from __future__ import annotations

import re

_ITEM = re.compile(r'^(?P<name>.+?)(?:\s+(?P<amt>\d+(?:\.\d+)?)\s*(?P<unit>g|ml|개|장|줄|큰술|작은술|컵|모|봉|통|쪽|꼬집|조각|대)?)?$')

UNIT_MAP = {None: '', '개': '개', '장': '장', '줄': '줄', '큰술': '큰술', '작은술': '작은술', '컵': '컵', '모': '모',
            '봉': '봉', '통': '통', '쪽': '쪽', '꼬집': '꼬집', '조각': '조각', '대': '대', 'g': 'g', 'ml': 'ml'}


def _parse_item(s: str) -> tuple[str, float | None, str]:
    m = _ITEM.match(s.strip())
    if not m:
        raise ValueError(f'재료 표기를 못 읽음: {s!r}')
    name = m.group('name').strip()
    amt = float(m.group('amt')) if m.group('amt') else None
    unit = UNIT_MAP[m.group('unit')]
    if amt is not None and amt == int(amt):
        amt = int(amt)
    return name, amt, unit


def G(name: str, role: str, items: list[str], *, rule: str | None = None, weight: float | None = None,
      min_count: int | None = None, subs: dict[str, list[tuple]] | None = None, gid: str | None = None) -> dict:
    default_w = {'core': 10, 'major': 4, 'support': 2, 'optional': 1}[role]
    if rule is None:
        rule = 'optional' if role == 'optional' else 'one_of'
    parsed = []
    for s in items:
        n, a, u = _parse_item(s)
        sub_list = []
        for sub in (subs or {}).get(n, []):
            target, fit, note = (sub + (None,))[:3]
            ids = list(target) if isinstance(target, tuple) else [target]
            sub_list.append({'ingredientNames': ids, 'fit': fit, 'note': note})
        parsed.append({'ingredientName': n, 'amount': a, 'unit': u, 'substitutions': sub_list})
    g = {
        'id': gid, 'name': name, 'role': role, 'isCoreGate': role == 'core', 'matchRule': rule,
        'weight': default_w if weight is None else weight, 'items': parsed,
    }
    if rule == 'at_least':
        g['minCount'] = min_count or 1
    return g


def R(*, title: str, tier: str, kind: str, cuisine: str, meal: list[str], method: str, minutes: int,
      difficulty: str, summary: str, groups: list[dict], steps: list[tuple[str, int | None]],
      tools: list[str] | None = None, aliases: list[str] | None = None, water: list[tuple[str, int]] | None = None,
      source: str | None = None, status: str = 'reviewed') -> dict:
    used = set()
    for i, g in enumerate(groups, start=1):
        if g['id'] is None:
            g['id'] = f'g{i}'
        if g['id'] in used:
            raise ValueError(f'{title}: 그룹 ID 중복 {g["id"]}')
        used.add(g['id'])
    return {
        'title': title, 'aliases': aliases or [], 'summary': summary, 'tier': tier, 'kind': kind, 'cuisine': cuisine,
        'meal': meal, 'method': method, 'minutes': minutes, 'difficulty': difficulty, 'baseServings': 1,
        'tools': tools or [], 'groups': groups,
        **({'water': [{'name': n, 'amountMl': ml} for n, ml in water]} if water else {}),
        'steps': [{'text': t, 'timerSeconds': sec} for t, sec in steps],
        'contentStatus': status, **({'sourceId': source} if source else {}),
    }
