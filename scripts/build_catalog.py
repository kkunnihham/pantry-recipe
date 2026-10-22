"""content/ 아래 작성 모듈을 합쳐 src/data/catalog.json 을 만든다.

사용: python -I scripts/build_catalog.py
이후: python -I scripts/validate_catalog.py
"""
from __future__ import annotations

import importlib.util
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CONTENT = ROOT / 'content'
OUT = ROOT.parent / 'src' / 'data' / 'catalog.json'
VERSION = 'pilot-30'


def load(name: str):
    spec = importlib.util.spec_from_file_location(name, CONTENT / f'{name}.py')
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


def main() -> int:
    sys.path.insert(0, str(CONTENT))
    ingredients = load('ingredients').INGREDIENTS
    basic = load('basic').BASIC
    discovery = load('discovery').DISCOVERY

    # 식재료: 작성 순서대로 ID 부여 (범주별로 묶여 있어 냉장고 화면 순서로도 쓴다)
    name_to_id: dict[str, str] = {}
    alias_to_name: dict[str, str] = {}
    ing_out = []
    for i, (name, cat, aliases, staple) in enumerate(ingredients, start=1):
        if name in name_to_id:
            print(f'ERROR 식재료 이름 중복: {name}')
            return 1
        iid = f'I{i:03d}'
        name_to_id[name] = iid
        for a in aliases:
            if a in alias_to_name and alias_to_name[a] != name:
                print(f'ERROR 별칭 "{a}" 가 {alias_to_name[a]} 와 {name} 에 모두 있음')
                return 1
            alias_to_name[a] = name
        ing_out.append({'id': iid, 'name': name, 'aliases': aliases, 'category': cat, **({'staple': True} if staple else {})})

    def resolve(n: str, where: str) -> str:
        if n in name_to_id:
            return name_to_id[n]
        if n in alias_to_name:
            return name_to_id[alias_to_name[n]]
        raise KeyError(f'{where}: 사전에 없는 식재료 "{n}"')

    recipes_out = []
    errors = 0
    for idx, r in enumerate(basic + discovery, start=1):
        rid = f'R{idx:03d}'
        try:
            for g in r['groups']:
                for it in g['items']:
                    it['ingredientId'] = resolve(it.pop('ingredientName'), r['title'])
                    for s in it['substitutions']:
                        s['ingredientIds'] = [resolve(n, r['title']) for n in s.pop('ingredientNames')]
                        if s.get('note') is None:
                            s.pop('note', None)
        except KeyError as e:
            print('ERROR', e)
            errors += 1
            continue
        recipes_out.append({'id': rid, **r})

    if errors:
        return 1
    out = {
        'version': VERSION,
        'generatedAt': datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'ingredients': ing_out,
        'recipes': recipes_out,
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'레시피 {len(recipes_out)}개, 식재료 {len(ing_out)}개 -> {OUT}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
