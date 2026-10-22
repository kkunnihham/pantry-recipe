"""옛 Codex 카탈로그에서 파일럿 레시피를 새 구조로 추출한다.

사용: python -I scripts/extract_pilot.py
입력: E:/Codex/Workspaces/pantry-recipe-app/android/app/src/debug/assets/recipe_catalog.json.gz
출력: src/data/catalog.json (식재료 + 레시피)

재실행해도 같은 결과가 나오도록 ID는 결정적으로 부여한다.
2단계에서 본문을 고칠 때는 이 스크립트가 아니라 catalog.json을 직접 수정하므로,
이 스크립트는 "초안 생성용"이며 catalog.json이 reviewed 상태가 된 뒤엔 다시 실행하지 않는다.
"""
from __future__ import annotations

import gzip
import json
import re
import sys
from collections import OrderedDict
from datetime import datetime, timezone
from pathlib import Path

SRC = Path('E:/Codex/Workspaces/pantry-recipe-app/android/app/src/debug/assets/recipe_catalog.json.gz')
OUT = Path(__file__).resolve().parent.parent / 'src' / 'data' / 'catalog.json'

# ---------------------------------------------------------------------------
# 파일럿 레시피: (옛 ID 또는 None, 새 제목, tier, kind)
# ---------------------------------------------------------------------------
PILOT = [
    # 기본 10
    ('GRC-008', '제육볶음', 'basic', 'stirfry'),
    ('GRC-301', '삼겹살구이', 'basic', 'grill'),
    ('GRC-051', '계란볶음밥', 'basic', 'rice'),
    ('GRC-023', '미역국', 'basic', 'soup'),
    ('GRC-263', '오이냉국', 'basic', 'soup'),
    ('GRC-019', '김치찌개', 'basic', 'soup'),
    ('GRC-022', '부대찌개', 'basic', 'soup'),
    (None, '계란후라이', 'basic', 'grill'),
    (None, '스팸구이', 'basic', 'grill'),
    ('GRC-032', '김밥', 'basic', 'rice'),
    # 발견 20
    ('GRC-034', '토마토달걀볶음', 'discovery', 'stirfry'),
    ('GRC-045', '샥슈카', 'discovery', 'soup'),
    ('GRC-811', '치킨 난반', 'discovery', 'fried'),
    ('GRC-035', '오야코동', 'discovery', 'rice'),
    ('GRC-462', '부타동', 'discovery', 'rice'),
    ('GRC-111', '부타노쇼가야키', 'discovery', 'stirfry'),
    ('GRC-976', '톤페이야키', 'discovery', 'grill'),
    ('GRC-112', '데리야키 치킨', 'discovery', 'grill'),
    ('GRC-160', '스페인식 감자 토르티야', 'discovery', 'grill'),
    ('GRC-716', '수플레 오믈렛', 'discovery', 'grill'),
    ('GRC-574', '크레프', 'discovery', 'bread'),
    ('GRC-714', '에그 인 어 홀', 'discovery', 'bread'),
    ('GRC-092', '식빵 마늘빵', 'discovery', 'bread'),
    ('GRC-293', '떠먹는 치즈감자', 'discovery', 'snack'),
    ('GRC-663', '유린기', 'discovery', 'fried'),
    ('GRC-135', '치킨 아도보', 'discovery', 'soup'),
    ('GRC-1414', '치킨 아프리타다', 'discovery', 'soup'),
    ('GRC-631', '코울슬로', 'discovery', 'salad'),
    ('GRC-1192', '마살라 오믈렛', 'discovery', 'grill'),
    ('GRC-110', '니쿠자가', 'discovery', 'soup'),
]

# ---------------------------------------------------------------------------
# 식재료 통합: 옛 이름 -> 새 이름. 여기 없으면 옛 이름 그대로.
# ---------------------------------------------------------------------------
MERGE = {
    '양조간장': '간장', '진간장': '간장',
    '생마늘': '마늘', '다진 마늘': '마늘', '통마늘': '마늘',
    '돼지 앞다리살': '돼지고기 (볶음·찌개용)', '돼지 뒷다리살': '돼지고기 (볶음·찌개용)',
    '돼지 목살': '돼지고기 (볶음·찌개용)', '돼지 등심': '돼지고기 (볶음·찌개용)',
    '얇게 썬 돼지 등심': '돼지고기 (볶음·찌개용)',
    '대패삼겹살': '삼겹살',
    '소고기 불고기용': '소고기 (불고기·볶음용)', '얇은 소고기': '소고기 (불고기·볶음용)',
    '뼈 없는 생 닭다리살': '닭다리살', '뼈 있는 생 닭다리': '뼈 있는 닭다리',
    '즉석밥': '밥', '조리된 밥': '밥', '따뜻한 밥': '밥', '조리된 찬밥': '밥', '찬밥': '밥', '차갑게 식힌 밥': '밥',
    '통조림 햄': '통조림 햄 (스팸)', '런천미트': '통조림 햄 (스팸)',
    '일반 햄': '햄',
    '완전가열 비엔나소시지': '비엔나소시지',
    '가공 슬라이스 치즈': '슬라이스 치즈',
    '단단한 두부': '두부',
    '중성 식용유': '식용유',
    '중력분': '밀가루', '박력분': '밀가루',
    '생토마토': '토마토',
    '무가향 토마토 통조림': '토마토 통조림', '토마토 통조림(홀 또는 다이스)': '토마토 통조림',
    '시판 토마토소스': '토마토소스', '조미 토마토소스': '토마토소스',
    '무염버터': '버터', '가염버터': '버터',
    '생 대파': '대파',
    '다진 생강': '생강',
    '참깨': '깨', '볶은 참깨': '깨',
    '레몬즙': '레몬', '생레몬': '레몬',
    '쌀식초': '식초', '무가당 식초': '식초',
    '맛술': '맛술', '미림': '맛술',
    '달걀': '달걀', '계란': '달걀',
}

# 새 이름 -> 범주. 규칙으로 못 잡는 것만 적는다.
CATEGORY_OVERRIDE = {
    '마늘': 'veg', '생강': 'veg', '대파': 'veg', '토마토': 'veg', '청양고추': 'veg', '오이': 'veg',
    '김치': 'processed', '배추김치': 'processed', '두부': 'processed', '순두부': 'processed',
    '어묵': 'processed', '떡볶이떡': 'grain', '떡국떡': 'grain', '단무지': 'processed',
    '마른 미역': 'seafood', '김': 'seafood',
    '레몬': 'fruit_etc', '깨': 'seasoning', '깻잎': 'veg',
    '달걀': 'meat_egg',
    '우유': 'dairy', '버터': 'dairy', '생크림': 'dairy', '플레인 요거트': 'dairy',
    '마요네즈': 'seasoning', '토마토케첩': 'seasoning', '토마토소스': 'seasoning', '토마토 통조림': 'processed',
    '카레가루': 'seasoning', '빵가루': 'grain', '감자전분': 'seasoning', '전분': 'seasoning', '튀김가루': 'grain',
    '쌈장': 'seasoning', '참기름': 'seasoning', '들기름': 'seasoning',
    '통조림 햄 (스팸)': 'processed', '햄': 'processed', '소시지': 'processed', '비엔나소시지': 'processed', '베이컨': 'processed',
    '베이크드빈 통조림': 'processed', '냉동 감자튀김': 'processed',
    '고춧가루': 'seasoning', '커민가루': 'seasoning', '파프리카가루': 'seasoning', '건조 파슬리': 'seasoning',
    '말린 월계수잎': 'seasoning', '오코노미야키소스': 'seasoning', '감자전분': 'seasoning',
}

CATEGORY_RULES = [
    ('seafood', r'새우|오징어|조개|홍합|굴|생선|연어|참치|고등어|멸치|명태|대구|갈치|삼치|꽁치|장어|해물|미역|다시마|김$|젓갈|피시|액젓|전복|가리비|주꾸미|명란'),
    ('dairy', r'우유|치즈|버터|생크림|요거트|요구르트|크림'),
    ('meat_egg', r'돼지|삼겹살|소고기|닭|달걀|계란|오리|양고기|갈비|등뼈|족'),
    ('processed', r'햄|소시지|스팸|베이컨|통조림|김치|두부|어묵|만두|단무지|냉동|완제품|시판'),
    ('grain', r'밥|쌀|면$|국수|식빵|빵|밀가루|가루|전분|떡|라면|소면|당면|파스타|스파게티|또띠아|토르티야|오트'),
    ('seasoning', r'간장|된장|고추장|고춧가루|소금|설탕|식초|기름|유$|마요네즈|케첩|맛술|후추|깨|올리고당|물엿|꿀|소스|육수|스톡|카레|향신료|가루|파우더|시럽|머스타드|겨자|고추냉이|와사비|액|장$'),
    ('fruit_etc', r'레몬|라임|사과|바나나|견과|땅콩|아몬드|호두|건포도|대추|과일|딸기|포도'),
    ('veg', r'.'),
]

STAPLES = {'소금', '설탕', '간장', '국간장', '식용유', '후추', '참기름', '고춧가루', '고추장', '된장', '식초', '마늘', '깨', '맛술', '올리고당', '마요네즈', '토마토케첩', '올리브유', '버터'}

TOOL_MAP = {
    'TOOL-AIR-FRYER': 'air_fryer', 'TOOL-MICROWAVE': 'microwave', 'TOOL-RICE-COOKER': 'rice_cooker',
    'TOOL-PRESSURE-COOKER': 'pressure_cooker', 'TOOL-BLENDER-FOOD-PROCESSOR': 'blender', 'TOOL-OVEN': 'oven',
}
CUISINE_MAP = {
    'KOREAN': 'korean', 'CHINESE': 'chinese', 'JAPANESE': 'japanese', 'EUROPEAN': 'western', 'AMERICAS': 'western',
    'GLOBAL': 'other', 'SOUTHEAST_ASIAN': 'southeast_asian', 'SOUTH_ASIAN': 'south_asian', 'MIDDLE_EASTERN': 'middle_eastern',
    'AFRICAN': 'other',
}
MEAL_MAP = {'MAIN': 'main', 'SIDE': 'side', 'SOUP_STEW': 'soup', 'RICE': 'main', 'SNACK_DESSERT': 'snack', 'BREAKFAST': 'breakfast', 'ANJU': 'snack'}
METHOD_MAP = {'BOIL_SIMMER': 'boil', 'STIR_FRY': 'stirfry', 'PAN_GRILL': 'grill', 'DEEP_FRY': 'fry', 'STEAM': 'steam', 'NO_COOK': 'no_cook', 'AIR_FRY': 'air_fry', 'MICROWAVE': 'microwave'}
DIFF_MAP = {'VERY_EASY': 'very_easy', 'EASY': 'easy', 'NORMAL': 'normal', 'MEDIUM': 'normal', 'HARD': 'hard'}
ROLE_MAP = {'CORE': 'core', 'MAJOR': 'major', 'SUPPORT': 'support', 'OPTIONAL': 'optional'}
RULE_MAP = {'ONE_OF': 'one_of', 'ALL_OF': 'all_of', 'AT_LEAST_N': 'at_least', 'OPTIONAL': 'optional'}


def categorize(name: str) -> str:
    if name in CATEGORY_OVERRIDE:
        return CATEGORY_OVERRIDE[name]
    for cat, pat in CATEGORY_RULES:
        if re.search(pat, name):
            return cat
    return 'fruit_etc'


def main() -> None:
    data = json.load(gzip.open(SRC, 'rt', encoding='utf-8'))['catalog']
    old_recipes = {r['id']: r for r in data['recipes']}
    old_ings = {i['id']: i for i in data['ingredients']}

    # 식재료 사전: 새 이름 기준으로 모은다.
    ing_by_name: 'OrderedDict[str, dict]' = OrderedDict()

    def ingredient_for(old_id: str) -> str:
        old = old_ings[old_id]
        new_name = MERGE.get(old['nameKo'], old['nameKo'])
        if new_name not in ing_by_name:
            ing_by_name[new_name] = {'name': new_name, 'aliases': [], 'sourceIds': [], 'category': categorize(new_name)}
        entry = ing_by_name[new_name]
        if old_id not in entry['sourceIds']:
            entry['sourceIds'].append(old_id)
        for a in [old['nameKo']] + old.get('aliasesKo', []):
            if a != new_name and a not in entry['aliases']:
                entry['aliases'].append(a)
        return new_name

    recipes_out = []
    for idx, (old_id, title, tier, kind) in enumerate(PILOT, start=1):
        rid = f'R{idx:03d}'
        if old_id is None:
            recipes_out.append({
                'id': rid, 'title': title, 'aliases': [], 'summary': '2단계에서 작성',
                'tier': tier, 'kind': kind, 'cuisine': 'korean', 'meal': ['main'], 'method': 'grill',
                'minutes': 10, 'difficulty': 'very_easy', 'baseServings': 1, 'tools': [],
                'groups': [], 'steps': [], 'contentStatus': 'draft',
            })
            continue
        r = old_recipes[old_id]
        tags = r['tags']
        cuisine = next((CUISINE_MAP[t.replace('FACET_CUISINE_', '')] for t in tags if t.startswith('FACET_CUISINE_')), 'other')
        meals = []
        for t in tags:
            if t.startswith('FACET_MEAL_'):
                m = MEAL_MAP.get(t.replace('FACET_MEAL_', ''))
                if m and m not in meals:
                    meals.append(m)
        method = next((METHOD_MAP[t.replace('FACET_METHOD_', '')] for t in tags if t.startswith('FACET_METHOD_') and t.replace('FACET_METHOD_', '') in METHOD_MAP), 'boil')

        groups = []
        for g in r['groups']:
            items = []
            for it in g['items']:
                amt = it['amounts'][0]['suggestedAmount'] if it['amounts'] else None
                subs = []
                for s in it['substitutions']:
                    subs.append({
                        'ingredientIds': [ingredient_for(c['ingredientId']) for c in s['components']],
                        'fit': s['fitScore'],
                        'note': s.get('reasonKo') or None,
                    })
                items.append({'ingredientId': ingredient_for(it['ingredientId']), 'amount': amt, 'unit': it['unit'], 'substitutions': subs})
            # 통합으로 같은 재료가 한 그룹에 중복되면 하나만 남긴다.
            seen = set()
            dedup = []
            for it in items:
                if it['ingredientId'] in seen:
                    continue
                seen.add(it['ingredientId'])
                it['substitutions'] = [s for s in it['substitutions'] if s['ingredientIds'] != [it['ingredientId']]]
                dedup.append(it)
            groups.append({
                'id': g['id'].split('-G-')[-1].lower() if '-G-' in g['id'] else g['id'].lower(),
                'name': g['nameKo'], 'role': ROLE_MAP[g['role']], 'isCoreGate': g['isCoreGate'],
                'matchRule': RULE_MAP[g['matchRule']],
                **({'minCount': g['minimumCount']} if g['matchRule'] == 'AT_LEAST_N' else {}),
                'weight': g['weight'], 'items': dedup,
            })

        water = []
        for s in r.get('systemIngredients') or []:
            if s['amounts']:
                water.append({'name': s['nameKo'], 'amountMl': s['amounts'][0]['amount']})

        recipes_out.append({
            'id': rid, 'sourceId': old_id, 'title': title, 'aliases': [a for a in r.get('searchAliasesKo', []) if a != title],
            'summary': r['summaryKo'], 'tier': tier, 'kind': kind, 'cuisine': cuisine, 'meal': meals or ['main'],
            'method': method, 'minutes': r['totalMinutes'], 'difficulty': DIFF_MAP[r['difficulty']], 'baseServings': 1,
            'tools': [TOOL_MAP[t] for t in r['requiredToolIds'] if t in TOOL_MAP],
            'groups': groups, **({'water': water} if water else {}),
            'steps': [{'text': s['instructionKo'], 'timerSeconds': s['timerSeconds']} for s in sorted(r['steps'], key=lambda s: s['order'])],
            'contentStatus': 'draft',
        })

    # 식재료 ID 부여 (이름 정렬로 결정적)
    ingredients_out = []
    name_to_id = {}
    for i, name in enumerate(sorted(ing_by_name), start=1):
        iid = f'I{i:03d}'
        name_to_id[name] = iid
        e = ing_by_name[name]
        ingredients_out.append({
            'id': iid, 'name': name, 'aliases': e['aliases'], 'category': e['category'],
            **({'staple': True} if name in STAPLES else {}), 'sourceIds': e['sourceIds'],
        })
    for rec in recipes_out:
        for g in rec['groups']:
            for it in g['items']:
                it['ingredientId'] = name_to_id[it['ingredientId']]
                for s in it['substitutions']:
                    s['ingredientIds'] = [name_to_id[n] for n in s['ingredientIds']]

    out = {
        'version': 'pilot-30-draft',
        'generatedAt': datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'ingredients': ingredients_out,
        'recipes': recipes_out,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'레시피 {len(recipes_out)}개, 식재료 {len(ingredients_out)}개 -> {OUT}')
    by_cat: dict[str, list[str]] = {}
    for e in ingredients_out:
        by_cat.setdefault(e['category'], []).append(e['name'])
    for cat, names in by_cat.items():
        print(f'[{cat}] {len(names)}: {", ".join(names)}')


if __name__ == '__main__':
    sys.exit(main())
