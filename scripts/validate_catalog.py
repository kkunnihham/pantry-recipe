"""catalog.json 무결성 검사. 2단계 본문 수정 뒤에도 계속 쓴다.

사용: python -I scripts/validate_catalog.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

CAT = Path(__file__).resolve().parent.parent / 'src' / 'data' / 'catalog.json'
CATEGORIES = {'veg', 'meat_egg', 'seafood', 'dairy', 'processed', 'grain', 'seasoning', 'fruit_etc'}
ROLES = {'core', 'major', 'support', 'optional'}
RULES = {'one_of', 'all_of', 'at_least', 'optional'}
TOOLS = {'air_fryer', 'microwave', 'rice_cooker', 'pressure_cooker', 'blender', 'oven'}
KINDS = {'soup', 'stirfry', 'grill', 'rice', 'noodle', 'side', 'bread', 'snack', 'salad', 'fried'}
CUISINES = {'korean', 'chinese', 'japanese', 'western', 'southeast_asian', 'south_asian', 'middle_eastern', 'other'}
MEALS = {'main', 'side', 'soup', 'snack', 'breakfast'}
METHODS = {'boil', 'stirfry', 'grill', 'fry', 'steam', 'no_cook', 'air_fry', 'microwave'}
DIFFS = {'very_easy', 'easy', 'normal', 'hard'}
HEDGES = ['가진 ', '선택한 ', '선택해 ', '필요한 경우', '℃', '도마와 칼', '승인된']


def main() -> int:
    cat = json.loads(CAT.read_text(encoding='utf-8'))
    errors: list[str] = []
    warns: list[str] = []
    ing_ids = set()
    names = set()
    for i in cat['ingredients']:
        if i['id'] in ing_ids:
            errors.append(f"식재료 ID 중복: {i['id']}")
        ing_ids.add(i['id'])
        if i['name'] in names:
            errors.append(f"식재료 이름 중복: {i['name']}")
        names.add(i['name'])
        if i['category'] not in CATEGORIES:
            errors.append(f"{i['id']} 범주 오류: {i['category']}")
    used = set()
    rids = set()
    titles = set()
    for r in cat['recipes']:
        p = f"{r['id']} {r['title']}"
        if r['id'] in rids:
            errors.append(f'레시피 ID 중복: {p}')
        rids.add(r['id'])
        if r['title'] in titles:
            errors.append(f'레시피 제목 중복: {p}')
        titles.add(r['title'])
        for key, allowed in [('kind', KINDS), ('cuisine', CUISINES), ('method', METHODS), ('difficulty', DIFFS)]:
            if r[key] not in allowed:
                errors.append(f'{p}: {key}={r[key]} 허용 안 됨')
        if not r['meal'] or any(m not in MEALS for m in r['meal']):
            errors.append(f"{p}: meal={r['meal']}")
        if any(t not in TOOLS for t in r['tools']):
            errors.append(f"{p}: tools={r['tools']}")
        if 'oven' in r['tools']:
            errors.append(f'{p}: 오븐 레시피는 제외하기로 했음')
        if r['baseServings'] != 1:
            errors.append(f'{p}: baseServings는 1')
        if r['contentStatus'] == 'reviewed' and not r['steps']:
            errors.append(f'{p}: reviewed인데 단계가 없음')
        if r['contentStatus'] == 'reviewed' and not any(g['isCoreGate'] for g in r['groups']):
            errors.append(f'{p}: 핵심 관문 그룹이 없음')
        total_w = sum(g['weight'] for g in r['groups'])
        core_w = sum(g['weight'] for g in r['groups'] if g['role'] == 'core')
        if r['groups'] and core_w / total_w < 0.4:
            warns.append(f'{p}: 핵심 가중치 비율 {core_w / total_w:.0%} (40% 미만)')
        gids = set()
        for g in r['groups']:
            if g['id'] in gids:
                errors.append(f"{p}: 그룹 ID 중복 {g['id']}")
            gids.add(g['id'])
            if g['role'] not in ROLES or g['matchRule'] not in RULES:
                errors.append(f"{p}: 그룹 {g['id']} role/rule 오류")
            if (g['role'] == 'core') != g['isCoreGate']:
                errors.append(f"{p}: 그룹 {g['id']} role=core 와 isCoreGate 불일치")
            if g['matchRule'] == 'at_least' and not g.get('minCount'):
                errors.append(f"{p}: 그룹 {g['id']} at_least 인데 minCount 없음")
            if not g['items']:
                errors.append(f"{p}: 그룹 {g['id']} 항목 없음")
            for it in g['items']:
                if it['ingredientId'] not in ing_ids:
                    errors.append(f"{p}: 없는 식재료 {it['ingredientId']}")
                used.add(it['ingredientId'])
                for s in it['substitutions']:
                    if not (0 < s['fit'] < 1):
                        errors.append(f"{p}: 대체재 fit 범위 오류 {s['fit']}")
                    for sid in s['ingredientIds']:
                        if sid not in ing_ids:
                            errors.append(f'{p}: 없는 대체 식재료 {sid}')
                        used.add(sid)
                    if g['isCoreGate'] and s['fit'] < 0.75:
                        warns.append(f"{p}: 핵심 그룹 대체재 fit {s['fit']} < 0.75 (관문 통과 못 함)")
        for n, s in enumerate(r['steps'], start=1):
            if not s['text'].strip():
                errors.append(f'{p}: {n}단계 비어 있음')
            if r['contentStatus'] == 'reviewed':
                for h in HEDGES:
                    if h in s['text']:
                        warns.append(f'{p}: {n}단계 헤징 문구 "{h}"')
    unused = ing_ids - used
    if unused:
        warns.append(f"쓰이지 않는 식재료 {len(unused)}개: {', '.join(sorted(unused))}")
    for e in errors:
        print('ERROR', e)
    for w in warns:
        print('WARN ', w)
    print(f"레시피 {len(cat['recipes'])}, 식재료 {len(cat['ingredients'])}, reviewed {sum(1 for r in cat['recipes'] if r['contentStatus']=='reviewed')}, 오류 {len(errors)}, 경고 {len(warns)}")
    return 1 if errors else 0


if __name__ == '__main__':
    sys.exit(main())
