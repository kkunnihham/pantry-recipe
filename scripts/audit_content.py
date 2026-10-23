"""레시피 내용 감사. validate_catalog가 구조를 보면, 이건 내용의 앞뒤를 본다.

- 타이머 합이 총 조리 시간을 넘는 레시피
- 재료 그룹에 있지만 단계 문장 어디에도 안 나오는 재료 (선택 그룹 제외)
- 단계 문장에 나오는데 재료 목록에 없는 흔한 재료 단어
- 핵심 그룹이 1개뿐이면서 가중치 비율이 낮은 레시피
사용: python -I scripts/audit_content.py
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

CAT = Path(__file__).resolve().parent.parent / 'src' / 'data' / 'catalog.json'

# 단계 문장에서 재료를 찾을 때 쓰는 짧은 별칭. 사전 이름이 길어 문장에선 줄여 쓰는 것들.
SHORT = {
    '돼지고기 (볶음·찌개용)': ['돼지고기', '고기', '등심'],
    '소고기 (불고기·볶음용)': ['소고기', '고기'],
    '소고기 국거리': ['소고기', '고기'],
    '통조림 햄 (스팸)': ['스팸', '햄'],
    '뼈 있는 닭다리': ['닭'],
    '닭다리살': ['닭'],
    '닭가슴살': ['닭'],
    '배추김치': ['김치'],
    '마른 미역': ['미역'],
    '국물용 멸치': ['멸치'],
    '멸치 코인육수': ['코인육수', '육수'],
    '슬라이스 치즈': ['치즈'],
    '체다치즈': ['치즈'],
    '모짜렐라치즈': ['치즈'],
    '파르메산치즈': ['치즈', '파르메산'],
    '토마토 통조림': ['토마토', '홀토마토'],
    '옥수수 통조림': ['옥수수'],
    '참치 통조림': ['참치'],
    '베이크드빈 통조림': ['베이크드빈'],
    '냉동 만두': ['만두'],
    '냉동 새우': ['새우'],
    '토마토케첩': ['케첩'],
    '오코노미야키소스': ['소스'],
    '돈가스소스': ['소스'],
    '토마토소스': ['토마토소스', '소스'],
    '비엔나소시지': ['소시지'],
    '스파게티면': ['스파게티', '면'],
    '우동면': ['우동'],
    '칼국수면': ['칼국수'],
    '떡볶이떡': ['떡'],
    '떡국떡': ['떡'],
    '식용유': ['기름', '식용유'],
    '올리브유': ['올리브유', '기름'],
    '다진 돼지고기': ['돼지고기', '고기'],
    '다진 소고기': ['소고기', '고기'],
    '건조 파슬리': ['파슬리'],
    '말린 월계수잎': ['월계수잎'],
    '베이킹파우더': ['베이킹파우더'],
    '플레인 요거트': ['요거트'],
    '매운 긴 풋고추': ['고추'],
    '청양고추': ['고추', '청양고추'],
    '풋고추': ['고추'],
    '칠리플레이크': ['고추', '칠리'],
    '커민가루': ['커민'],
    '파프리카가루': ['파프리카가루', '파프리카'],
    '강황가루': ['강황'],
    '계피가루': ['계피'],
    '건조 바질': ['바질'],
    '전분': ['전분', '전분물'],
    '맛술': ['맛술', '미림'],
    '올리고당': ['올리고당', '단맛'],
    '국간장': ['국간장', '간장'],
    '깨': ['깨'],
    '마늘': ['마늘'],
    '생강': ['생강'],
    '밥': ['밥'],
    '쌀': ['쌀'],
    '김': ['김'],
    '라면': ['라면', '면', '사리'],
    '잔멸치': ['멸치'],
    '생 바질': ['바질'],
    '양송이버섯': ['양송이'],
    '새송이버섯': ['새송이', '버섯'],
    '표고버섯': ['표고', '버섯'],
    '느타리버섯': ['느타리', '버섯'],
    '팽이버섯': ['팽이', '버섯'],
}


def mentions(text: str, name: str, aliases: list[str]) -> bool:
    keys = [name, *aliases, *SHORT.get(name, [])]
    keys += [k.replace(' ', '') for k in keys]
    return any(k and k in text for k in keys)


def main() -> int:
    cat = json.loads(CAT.read_text(encoding='utf-8'))
    ing = {i['id']: i for i in cat['ingredients']}
    issues = 0
    for r in cat['recipes']:
        p = f"{r['id']} {r['title']}"
        steps = ' '.join(s['text'] for s in r['steps'])
        compact = steps.replace(' ', '')
        timer_sum = sum((s['timerSeconds'] or 0) for s in r['steps'])
        if timer_sum > r['minutes'] * 60:
            print(f"TIMER  {p}: 타이머 합 {timer_sum // 60}분 > 총 {r['minutes']}분")
            issues += 1
        for g in r['groups']:
            if g['role'] == 'optional' or g['matchRule'] == 'optional':
                continue
            for it in g['items']:
                i = ing[it['ingredientId']]
                if not mentions(steps + ' ' + compact, i['name'], i['aliases']) and not mentions(compact, i['name'].replace(' ', ''), []):
                    # 그룹 이름으로 언급된 경우는 통과 (예: '양념', '소스', '드레싱', '튀김옷', '밑간')
                    gname = g['name']
                    if gname and (gname in steps or gname.replace(' ', '') in compact):
                        continue
                    print(f"UNUSED {p}: '{i['name']}' ({g['name']}, {g['role']}) 이 단계에 안 나옴")
                    issues += 1
        core = [g for g in r['groups'] if g['isCoreGate']]
        if len(core) == 1 and len(r['groups']) >= 5:
            total = sum(g['weight'] for g in r['groups'])
            if core[0]['weight'] / total < 0.45:
                print(f"CORE   {p}: 핵심 그룹 1개, 비율 {core[0]['weight'] / total:.0%}")
                issues += 1
        for s in r['steps']:
            if re.search(r'[!！]', s['text']):
                print(f"TONE   {p}: 느낌표 사용")
                issues += 1
    print(f"지적 {issues}건 / 레시피 {len(cat['recipes'])}개")
    return 0


if __name__ == '__main__':
    sys.exit(main())
