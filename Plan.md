# Dungeon Composer WebApp (GitHub Pages 배포) 요구사항 (MVP → 확장)

## 0. 한 줄 요약
GitHub Pages(정적 호스팅) 위에서 동작하는 **클라이언트 전용** 웹앱으로,
사용자가 몇 가지 파라미터(방 수/분기/루프/시드 등)를 입력하면 던전을 생성·시각화하고,
생성 결과를 **PNG/SVG 이미지로 저장**할 수 있게 한다.

---

## 1. 목표 / 비목표

### 1.1 목표
- 브라우저에서 던전 생성(시드 기반 재현성)
- 던전 미리보기(그래프/미니맵)
- 이미지 파일 저장(PNG 필수, SVG 옵션)
- GitHub Pages로 배포(서버 없이 동작)

### 1.2 비목표(MVP에서 제외)
- 서버 저장/공유(계정/DB)
- 실시간 멀티 편집
- UE/Unity 직접 연동(Phase 2 이후)

---

## 2. 제약 사항(필수)
- GitHub Pages는 **정적 파일만 제공**하므로, 생성/검증/렌더링은 전부 **클라이언트(브라우저)에서 수행**
- 외부 API 의존 최소화(오프라인/재현성/장기 유지보수)
- 결과 저장은 브라우저 다운로드로 제공(파일 저장)

---

## 3. 구현 대안(2안 이상)

### 대안 A: React + TypeScript + Vite + Canvas/SVG (추천)
- 장점
  - UI 구성/상태관리/컴포넌트 분리가 쉬움
  - 확장(프리셋, 히스토리, 비교, 공유 URL) 용이
  - TS로 스키마/모델 안정성 확보
- 단점
  - 빌드 파이프라인 필요(하지만 Vite로 단순)
- 적합 조건
  - 기능 확장(Validator/Scoring/Batch 등)까지 염두에 둘 때

### 대안 B: Vanilla JS(또는 Lit) + Canvas 단일 페이지
- 장점
  - 의존성 최소, 초기 구현 속도 빠름
  - GitHub Pages 배포가 매우 단순
- 단점
  - 규모 커지면 유지보수 어려움(상태/모듈/테스트)
- 적합 조건
  - MVP만 빠르게 완성하고 “작게 끝낼” 때

> 본 문서는 **대안 A(React+TS+Vite)** 를 기준으로 요구사항을 정의한다.

---

## 4. 기능 요구사항(Functional)

### 4.1 입력 UI (필수)
- 생성 파라미터
  - `seed` (number/string → 내부에서 number로 변환)
  - `roomCount` (예: 10~80)
  - `branching` (예: 0.5~3.0)
  - `loopChance` (0~1)
  - `style` (linear / branchy / loopy 프리셋)
  - `specialRooms` 예산(선택): treasure/shop/key/boss (MVP에선 boss만 필수)
- 버튼
  - **Generate**
  - **Random Seed**
  - **Download PNG**
  - (옵션) Download SVG, Copy Share Link, Save Preset

### 4.2 던전 생성(필수)
- 생성 결과는 **그래프 모델**로 표현
  - Node(Room): id, type(start/boss/normal/…)
  - Edge(Connection): from, to, lockedBy?(옵션)
- 생성 알고리즘(MVP 권장)
  - “그래프 성장 방식”
    - start에서 시작 → 방을 추가하며 분기/루프를 확률적으로 생성
    - 마지막에 boss를 배치(최소 1개)하고 start→boss 경로 보장

### 4.3 레이아웃(필수)
- 그래프를 화면에 보기 좋게 배치
  - MVP: force-directed(spring) 또는 간단한 계층형 레이아웃
  - 노드 겹침 최소화
- (옵션) 미니맵 레이아웃
  - 방을 격자에 배치(단순 그리드) + 연결선 표시

### 4.4 검증(Validator) (MVP 최소)
- start에서 boss 도달 가능(필수)
- 그래프 연결성(필수 또는 옵션)
- 방 수가 파라미터 범위 만족(필수)

> Phase 2에서 Key-Lock, 경로 길이 범위, 막다른 길 비율 등 추가

### 4.5 시각화(필수)
- 그래프 뷰
  - start/boss 강조(아이콘/두께/라벨)
  - 노드 색상/모양: room type
  - 연결선 표시(양방향 기본)
- 정보 패널(선택)
  - 방 수, 엣지 수, start→boss 거리, 분기 수 등 요약

### 4.6 이미지 저장(핵심 요구)
#### PNG 저장(필수)
- 렌더링을 Canvas 기반으로 수행하거나,
- SVG 렌더 후 Canvas로 변환하여 PNG로 저장
- 저장 옵션
  - 해상도 스케일(1x/2x/4x)
  - 배경(흰색/투명)
  - 여백(margin) 포함
- 결과 파일명 예
  - `dungeon_seed123_rooms40.png`

#### SVG 저장(옵션)
- 그래프를 SVG로 렌더링할 경우 원본 SVG 다운로드 지원

---

## 5. 비기능 요구사항(Non-Functional)
- 재현성: 같은 seed + 같은 파라미터 → 같은 결과(동일 PRNG 사용)
- 성능: roomCount 80 기준 생성+레이아웃+렌더 1초 내(목표)
- 접근성(권장): 버튼/입력 폼 키보드 조작 가능
- 유지보수: 알고리즘/렌더/UI 모듈 분리

---

## 6. 데이터 모델(초안)

### 6.1 TypeScript 타입(개념)
- `Dungeon`
  - `meta`: { seed, params, version }
  - `nodes`: RoomNode[]
  - `edges`: Edge[]
- `RoomNode`
  - `id: string`
  - `type: 'start' | 'boss' | 'normal' | ...`
  - `pos?: { x:number, y:number }` // 레이아웃 결과
- `Edge`
  - `a: string`
  - `b: string`
  - `lockedBy?: string`

### 6.2 JSON 내보내기(옵션)
- “Export JSON” 버튼으로 `dungeon.json` 다운로드(디버그/공유용)

---

## 7. PRNG(재현성) 요구사항
- 브라우저 기본 `Math.random()` 사용 금지(재현성 깨짐)
- seed 기반 PRNG 필수
  - 예: xorshift32 / mulberry32 등
- 문자열 seed 지원 시: 해시로 u32 변환(간단 해시 함수)

---

## 8. UI/UX 구성(권장)
- 좌측: 파라미터 패널(폼 + 프리셋 + Generate)
- 우측: 캔버스(그래프/미니맵 탭)
- 하단: 요약 통계 + 다운로드 버튼

---

## 9. 기술 스택(대안 A 기준)

### 9.1 프론트
- React + TypeScript
- Vite
- 상태: React state 또는 Zustand(규모 커지면)
- 렌더링(둘 중 택1)
  1) Canvas 직접 드로잉(성능 좋고 PNG 저장 쉬움)
  2) SVG 렌더링 + PNG 변환(선명/확장 유리, 변환 로직 필요)

### 9.2 그래프 레이아웃
- MVP 옵션 1: 간단 force layout 직접 구현(노드 수 적으면 충분)
- MVP 옵션 2: d3-force 사용(의존 추가, 구현 단축)

---

## 10. 폴더 구조(권장)
- `src/`
  - `app/` (UI)
  - `assets/`
    - `icons/` (start/boss/treasure 등 SVG 아이콘)
    - `textures/` (선택: 배경 패턴/타일 PNG)
  - `core/`
    - `rng.ts`
    - `model.ts`
    - `generate.ts`
    - `validate.ts`
    - `layout.ts`
  - `render/`
    - `renderCanvas.ts` 또는 `renderSvg.tsx`
    - `exportPng.ts`
  - `presets/`
    - `linear.json`, `branchy.json`, `loopy.json`

---

## 11. 테스트(권장)
- 단위 테스트
  - PRNG: 동일 seed 결과 일치
  - generate: roomCount 준수, boss 도달 가능
- 스냅샷(옵션)
  - 특정 seed의 결과 JSON을 고정해 회귀 방지

---

## 12. GitHub Pages 배포 요구사항
- `main` 브랜치에 정적 빌드 결과를 배포하거나,
- GitHub Actions로 `dist/` 생성 후 `gh-pages` 브랜치에 배포
- SPA 라우팅을 쓸 경우(권장 X): Pages 404 처리 필요  
  → MVP는 단일 페이지로 충분

---

## 13. MVP 완료 정의(DoD)
- 사용자가 파라미터 입력 → Generate → 던전 그래프가 화면에 표시됨
- 동일 seed/파라미터로 새로고침 후 Generate 시 동일 결과
- “Download PNG” 버튼으로 현재 화면이 PNG로 저장됨(해상도 2x 옵션 포함)
- GitHub Pages에 배포되어 URL로 접속 가능

---

## 14. Phase 2 (확장 아이디어)
- Key-Lock 게이팅(키 방을 얻기 전 잠긴 문 금지 규칙)
- 점수화(분기/루프/막다른 길/critical path 길이)
- Batch 생성(예: 1..200 seed) 후 상위 N개 갤러리
- 공유 URL(쿼리 스트링에 파라미터+seed 인코딩)
- 갤러리(로컬스토리지에 최근 20개 저장)

---

## 15. 필요 작업 내역(MVP 체크리스트)

### 15.1 코어 구현
- `core/rng.ts`: seed 기반 PRNG 구현(`Math.random()` 미사용)
- `core/generate.ts`: start→boss 경로 보장 그래프 생성
- `core/validate.ts`: boss 도달 가능/파라미터 범위 검증
- `core/layout.ts`: 노드 겹침 최소화 레이아웃

### 15.2 렌더/저장
- `render/renderCanvas.ts` 또는 `renderSvg.tsx` 구현
- `render/exportPng.ts`: 1x/2x/4x, 배경(흰색/투명), margin 옵션 지원
- 파일명 규칙 적용: `dungeon_seed{seed}_rooms{roomCount}.png`

### 15.3 이미지 생성 절차(Codex 활용)
1. 아이콘 목록 확정: `start`, `boss`, `normal`(선택), `treasure`(선택)
2. Codex로 SVG 생성: `src/assets/icons/*.svg`에 저장
3. 렌더 매핑 작성: room type -> 아이콘 파일 경로 매핑
4. Preload 처리: 앱 시작 또는 렌더 직전 이미지 로드 완료 보장
5. Canvas export 검증: 아이콘 포함 화면이 PNG로 정상 저장되는지 확인
6. Git 반영/배포: 생성된 이미지 자산을 커밋 후 Pages 배포

### 15.4 이미지 자산 규칙
- 외부 URL 이미지 사용 지양(캔버스 CORS/taint 방지)
- 기본은 벡터(SVG) 우선, 텍스처가 필요할 때만 PNG 사용
- 자산 네이밍 예: `icon-start.svg`, `icon-boss.svg`
- 출처/라이선스 명시(직접 생성이면 `Generated by Codex` 등 기록)

---

## 16. 구현 확정안(MVP 기본안 고정)

### 16.1 렌더/레이아웃
- 렌더링 파이프라인: **Canvas 직접 렌더링** 채택
- 레이아웃 방식: **간단 force layout 직접 구현** 채택(d3-force 미사용)

### 16.2 검증/생성 범위
- Validator 범위: start→boss 도달 가능 + **그래프 연결성 검증 포함(필수)**
- `specialRooms`: MVP는 **boss만 필수**(treasure/shop/key는 Phase 2로 이관)

### 16.3 파라미터/시드 규칙
- 파라미터 기본 범위:
  - `roomCount`: 10~80
  - `branching`: 0.5~3.0
  - `loopChance`: 0~1
- seed 정책: 문자열 seed는 해시로 u32 변환 후 PRNG 입력(구현 함수는 `core/rng.ts`에 고정)

### 16.4 상태/테스트/배포
- 상태관리: MVP는 **React state만 사용**(Zustand 미도입)
- 테스트 최소 범위: **PRNG / generate / validator** 단위 테스트 우선 구현
- 배포: **GitHub Actions + `gh-pages` 브랜치** 배포 방식 채택
- 앱 형태: **단일 페이지(SPA 라우팅 미사용)** 고정

### 16.5 이미지 저장 기본값
- PNG 저장 기본 스케일: **2x**
- 배경 기본값: **흰색**
- margin: 기본 포함(세부 px 값은 구현 시 상수로 정의)
