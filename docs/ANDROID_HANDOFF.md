# Android 전환 인계

## 현재 상태와 경계

2026-11-13 로컬 AIMI 작업본에서 선별 복사했다. 원본 Git HEAD 이후의 미커밋 수정도 포함했으므로 원본의 특정 커밋을 그대로 복제한 저장소는 아니다. 앱 소스를 이식하기 위한 출발점이며 Android 동작·Play 출시를 완료한 결과물이 아니다.

이미 구현된 공유 로직은 재사용하되, 토스 호스트에 의존하는 부분은 교체한다. 테스트 계정이나 클라이언트가 임의로 지정한 사용자 ID를 Android 운영 인증으로 재사용하지 않는다.

## 먼저 읽을 코드

| 위치 | 확인/변경 사항 |
| --- | --- |
| `apps/miniapp/src/lib/runtime.ts` | 현재 DEV localhost만 로컬로 인정. Capacitor 호스트를 토스로 오인하지 않도록 Android 런타임 추가 |
| `apps/miniapp/src/app/App.tsx` | 앱 시작·인증·세션 복원·화면·TDS Provider 분기 |
| `apps/miniapp/src/ui/toss-provider.tsx` | 토스 Provider. Android 번들에 포함하지 않기 |
| `apps/miniapp/src/ui/primitives/index.tsx` | TDS Button 정적 import 포함. 조건부 렌더링만으로 분리가 충분하다고 가정하지 않기 |
| `apps/miniapp/src/lib/toss/bridge.ts` | 토스 익명 인증·호스트 SDK 호출. Android용 어댑터로 대체 |
| `apps/miniapp/src/lib/api/client.ts` | API URL·세션·요청 처리 |
| `apps/miniapp/src/lib/safe-area.ts` 및 `safe-area-policy.ts` | 토스 내비게이션 예약 공간을 Android 상태바·인셋에 맞게 변경 |
| `apps/miniapp/src/lib/scale-policy.ts` | 화면 확대/축소 정책. 실제 Android 키보드와 함께 확인 |
| `apps/miniapp/src/games/shared/` | Canvas 렌더러·입력·게임 결과 |
| `apps/api/src/services/toss/` | 기존 토스용 서버 인증. Android 인증 경로를 별도로 추가 |
| `apps/api/src/modules/` | 사용자·게임·챌린지·EP·친구 API |
| `packages/contracts/` | 공유 입력·출력 스키마 |
| `packages/game-core/` | 클라이언트/서버 replay가 공유하는 규칙 |
| `packages/recommender/` | 모델 필터·추천 코드 |

정확한 함수와 현재 구현은 코드를 우선한다. `rg '@apps-in-toss|@toss|intoss|tossRuntime' apps/miniapp/src`로 토스 경계를 함께 확인한다.

## 권장 구현 순서

1. 새 Android 런타임과 플랫폼 어댑터를 정의한다. 기존 토스 분기를 무작정 웹 데모로 치환하지 않는다.
2. TDS/토스 SDK 의존성이 없는 웹 번들을 먼저 만든다. 폰트·CSS·에셋은 유지한다.
3. Capacitor를 추가하고 웹 빌드 출력물을 `webDir`로 연결한다. 현재 `apps/miniapp/dist`는 참고 경로이며 프로젝트 기준 상대 경로를 맞춘다.
4. Android 계정 인증을 서버까지 연결한다. Supabase 익명 인증 또는 Google 로그인 등은 아직 결정하지 않았다. 검증된 인증 주체와 내부 UUID의 연결을 DB에 추가하고 토스 계정과 자동 병합하지 않는다.
5. 뒤로가기·종료·공유·클립보드·세션 저장·안전 영역·키보드를 구현한다. 게임 중단 및 챌린지 상태를 보존한다.
6. 별도 API/DB 환경에서 거래·동시 요청·일일 제한·소셜 접근 권한을 확인한다.
7. Android 실기기와 서명 AAB로 내부 테스트한다. APK는 직접 설치 시험용으로 만들 수 있다.

## 개발과 서버 환경

- `npm run dev`: 로컬 메모리 API와 Vite를 함께 실행. `AIMI_AI_MODE=fixture`로 실제 Gemini 호출 없이 화면 확인.
- 실제 AI 연결: 서버 `AIMI_GEMINI_API_KEY`, `GEMINI_TEXT_MODEL` 사용. `VITE_`로 키를 만들지 않는다.
- 한도: 프롬프트 개선 `OPTIMIZER_DAILY_LIMIT=5`, 모델 추천 `RECOMMENDATION_DAILY_LIMIT=5`. 코드 및 서버 정책과 함께 검증.
- 실제 DB: 별도 PostgreSQL/Supabase 연결, 서버 세션 키, 저장소 권한 설정 필요. `.env.example`의 토스 mTLS 설정은 기존 토스 경로용이며 Android 인증 자체의 필수 설정이 아니다.
- Android API 주소는 HTTPS의 별도 개발 API로 지정한다. 실제 기기에서 `127.0.0.1`은 Mac이 아니라 그 기기 자신이다. 현재 Vite `/api` 프록시는 배포된 Android 앱에 존재하지 않는다.
- 개발 fixture의 초기 재화·예시 친구·AI 응답은 운영 기능으로 노출하지 않는다.
- migration 파일은 전체 이력이다. 이미 적용된 운영 DB에 복사해 다시 실행하지 않는다.

## 콘텐츠·에셋과 제외한 파일

앱이 읽는 `public/content`, 폰트와 폰트 라이선스, 서버용 콘텐츠·10일 해설·공유 패키지를 포함했다. `content/challenges/**/manifest.private.json`은 서버용 정답 자료이며 서비스 비밀키 파일은 아니다. 이 자료를 Android 공개 정적 파일에 복사하지 않는다.

`output/model-audit/openrouter-current.json`은 모델 스냅샷 재생성 도구가 읽는 입력이라 포함했다. 수집 시점 자료이며 최신 판매 상태나 가격을 보장하지 않는다. 실제 앱은 준비된 콘텐츠 스냅샷을 읽는다.

원본의 `.git`, 실제 `.env`, 인증서, `.ait`, 생성된 `dist`, node_modules, 개인 데이터, 스크린샷, 옛 PDF/Figma 산출물·감사 보고서, GitHub Actions·Vercel·Render 자동 배포 설정은 제외했다. 이전 도구 중 토스 전용 도구는 비교·참고를 위해 남아 있으며 Android 배포용으로 실행하지 않는다.

참고 명세의 문서 링크 일부는 원본 저장소 기준이다. 누락된 과거 문서를 작업 지시로 해석하지 말고 현재 소스와 이 인계 문서를 우선한다.

## 라이선스·배포 준비

독립 앱에서 TDS를 재사용할 수 있다고 가정하지 않는다. 포함된 폰트의 `apps/miniapp/public/fonts/OFL.txt`, 소스 내 출처와 npm 의존성 라이선스를 보존/검토한다. 소유자의 소스 제공이 외부 패키지에 대한 별도 재배포 허가를 의미하지 않는다.

Google Play 제출 시 앱 ID·서명키 보관, AAB, 개인정보처리방침 공개 URL, 데이터 보안·콘텐츠 등급·계정 삭제 경로, 생성형 AI 기능 정책을 확인한다. 새 개인 개발자 계정의 비공개 테스트 요건도 별도로 확인한다.

- Capacitor: https://capacitorjs.com/docs/android
- AAB: https://developer.android.com/guide/app-bundle
- 개인 계정 테스트: https://support.google.com/googleplay/android-developer/answer/14151465
- 계정 삭제: https://support.google.com/googleplay/android-developer/answer/13327111

Supabase 공용 Root CA는 DB 모듈의 필수 의존성이므로 포함했다. `apps/api/certs/supabase-ca.crt`는 공개 신뢰 인증서이며 토스 mTLS 인증서·개인키와 다르다. 출처는 같은 폴더 README에 기록했다.

## 이번 인계 검증

별도 디렉터리에서 의존성을 설치하고 기존 웹/API 빌드를 완료했다. 기존 테스트 118개가 통과했다. 이를 위해 모델 카탈로그 테스트가 요구하는 공급사 원문 근거 파일과 전체 멀티모달 수집 스냅샷을 `output/model-audit/`에 선별 포함했다. 선택 도구 전체의 재수집·재생성은 이번에 검증하지 않았다. Android/실기기·원격 DB·실제 Gemini·운영 배포 검증은 수행하지 않았다.

공개 Google 문서 HTML에 포함된 사이트용 API 식별자는 제거하고 대응하는 근거 해시를 갱신했다. 실제 Gemini 호출 키는 포함하지 않았다.
