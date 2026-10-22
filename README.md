# 냉장고 레시피

집에 있는 재료를 있음/부족/없음으로 기록하면 지금 만들 수 있는 요리와 안 해본 요리를 추천하는 개인용 웹앱(PWA).
계획과 결정 사항은 [PLAN.md](PLAN.md)에 있다.

## 개발

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # 추천 엔진 테스트
npm run typecheck
npm run build        # dist/
```

레시피 내용은 `scripts/content/` 아래 파이썬 파일로 작성하고, 아래 명령으로 `src/data/catalog.json`을 다시 만든다.

```bash
npm run data:build   # 작성 모듈 → catalog.json → 무결성 검사
npm run scenario -- "달걀,밥,배추김치"   # 가상의 냉장고로 추천 결과 확인
```

## 배포

`main`에 푸시하면 GitHub Actions가 빌드해서 GitHub Pages에 올린다.
주소는 `https://<아이디>.github.io/pantry-recipe/`. 저장소 이름을 바꾸면
`.github/workflows/deploy.yml`의 `BASE_PATH`도 바꾼다.

폰에서 그 주소를 열고 브라우저 메뉴의 "홈 화면에 추가"를 누르면 앱처럼 설치된다.
사용자 데이터는 폰 안에만 저장되고 서버로 가지 않는다.
