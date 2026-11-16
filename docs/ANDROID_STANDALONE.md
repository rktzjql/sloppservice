# AIMI 독립 Android 앱 — 자동 계정 / 온라인 친구

## 현재 상태

기존 토스 전환 스냅샷 `22c36485914b534e3892c2b8148f49e6a07cd017`에서 분리한 소스입니다.
앱 사용자는 이메일·비밀번호·Gemini 키를 입력하지 않습니다. Supabase가 발급한 익명 계정의 인증 토큰을 API 서버가 검증하고 내부 UUID에 연결합니다. 기존 친구·정원·게임·EP 로직을 그대로 사용합니다.

**현재 실제 Render/Supabase 연결과 Gemini 비밀키가 제공되지 않아 클라우드 배포 및 최종 APK 배포는 완료되지 않았습니다.** 테스트 주소를 넣어 검사한 빌드를 사용자용 APK로 배포하지 않습니다. 앞서 제공한 로컬 개발 APK는 이 완성판이 아닙니다.

## 구현

- 앱 첫 실행에서 자동 계정 생성; 재실행과 서버 세션 만료 시 같은 계정을 사용합니다.
- 인증정보를 읽지 못한 경우 새 계정을 몰래 만들지 않습니다.
- Supabase 갱신 토큰은 Android Keystore의 AES-GCM 키로 암호화해 앱 전용 저장소에 보관합니다. 앱 백업은 비활성화했습니다.
- 앱 삭제·기기 교체 후 익명 계정 복구는 지원하지 않으며 앱 계정 화면에 표시합니다. 친구 코드는 로그인 수단이 아닙니다.
- 실제 사용자 초기 EP는 0, 기본 캐릭터만 지급합니다. 개발 fixture의 재화를 배포하지 않습니다.
- Gemini 키와 Supabase 관리 키는 서버 전용입니다. APK에는 공개 Supabase URL/공개 키만 들어갑니다.
- 토스 SDK/TDS가 Android 번들에 포함되면 빌드가 실패합니다.
- 독립 앱 패키지: `com.aimi.standalone`. 이전 Expo 앱/개발판과 별도로 설치되며 기존 로컬 데이터를 자동 이관하지 않습니다.
- 계정 삭제: Supabase 계정과 DB 기록 삭제 후 기기 갱신 토큰을 지웁니다. 외부 서비스 백업 보관은 각 서비스 정책에 따릅니다.

## 새 서버 준비 (운영자 작업)

1. 새 Supabase 프로젝트를 만들고 Authentication의 Anonymous sign-ins를 활성화합니다. 계정 생성 빈도 제한을 설정합니다.
2. 새 프로젝트의 SQL Editor에서 `docs/ANDROID_NEW_DATABASE.sql` 전체를 한 번 실행합니다. 기존 AIMI 테이블/역할이 있으면 변경하지 않고 중단합니다. 테이블·마이그레이션 체크섬·서버 전용 권한을 구성합니다.
3. 실행 결과의 `database_user`, `database_password`를 비공개로 보관합니다. Supabase Connect의 Session pooler 연결 주소에서 사용자 이름을 `aimi_api.<project-ref>`로, 비밀번호를 생성된 값으로 바꾸어 Render의 `DATABASE_URL`에 넣습니다. 채팅이나 GitHub에 비밀번호를 공유하지 않습니다. 이후 마이그레이션에는 별도 관리자 연결과 기존 `db:migrate`를 사용합니다.
4. Render에 `render.yaml`을 바탕으로 새 Node 서비스를 만듭니다. 우선 무료 플랜을 사용합니다. 무료 서버는 유휴 후 정지되므로 첫 접속이 지연될 수 있습니다. API 런타임 DB 권한과 마이그레이션 관리 권한을 분리합니다.
5. Render 비밀 환경변수:
   - `DATABASE_URL`: 새 DB의 서버 전용 역할 연결
   - `SESSION_SIGNING_KEY`: 랜덤 서버 세션 서명 비밀값
   - `ANDROID_SUPABASE_URL`, `ANDROID_SUPABASE_PUBLIC_KEY`, `ANDROID_SUPABASE_ADMIN_KEY`
   - `AIMI_GEMINI_API_KEY`: 공용 Gemini 키. 앱에 포함하지 않습니다.
   - `GEMINI_TEXT_MODEL`: 해당 키로 실제 호출 가능한 모델
6. `ANDROID_AUTH_ENABLED=true`, `NODE_ENV=production`, `ENABLE_DEV_AUTH=false`, `ENABLE_TEST_DEMO=false`, `CORS_ALLOWED_ORIGINS=https://localhost`로 실행합니다.
7. 콘텐츠·경제 정책과 새 DB 거래 검증 후 `AIMI_RELEASE_VERSION=prototype-v1-reviewed`를 설정합니다. 기존 출시 차단 규칙을 우회하지 않습니다.
8. 서로 다른 두 기기/계정으로 친구 요청·수락·방문·삭제, 앱 재시작, 출석 중복, 게임 보상, 실제 Gemini 응답과 한도를 확인합니다.

## APK 생성 (운영자 작업)

1. `apps/miniapp/.env.android.example`을 `.env.android.local`로 복사합니다.
2. 새 API HTTPS 주소, 새 Supabase HTTPS 주소/공개 키, 실제 운영자와 고객 문의 이메일을 설정합니다.
3. 서버 주소는 개발용 루프백이나 기존 팀원의 API일 수 없습니다. HTTP·demo 옵션·프런트 비밀키를 빌드 시 거절합니다.
4. 배포 서명키를 안전하게 만들고 보관합니다. 다음 환경변수는 저장소에 커밋하지 않습니다:
   `AIMI_ANDROID_KEYSTORE`, `AIMI_ANDROID_STORE_PASSWORD`, `AIMI_ANDROID_KEY_ALIAS`, `AIMI_ANDROID_KEY_PASSWORD`.
5. JDK 21, Android SDK 36, Node 22.12+ 환경에서 `npm ci`, `npm run android:apk`를 실행합니다.
6. 결과 `apps/miniapp/android/app/build/outputs/apk/release/app-release.apk`의 서명과 실제 서버 연결을 확인합니다.

## 검증 기록

- API 테스트 124개 통과(기존 118개 + Android 인증 6개).
- Android 빌드 설정 테스트 2개, 런타임·세션 테스트 15개 통과.
- 프로덕션 분기의 웹 빌드·TypeScript 검사 통과.
- Android 네이티브 코드 컴파일 통과. 보안 저장소는 실기기 실행 검증 전입니다.
- 393×852 Chromium에서 모의 Supabase/API로 자동 계정 시작, 재실행 유지, 만료 시 갱신, 중복 신규가입 방지를 확인했습니다.
- 실제 Supabase 인증/DB·Render·Gemini 호출·Android 실기기·배포 APK는 아직 검증하지 않았습니다.

추가 검증: 로컬 PGlite PostgreSQL에서 새 DB 초기화(9개 migration), Android 계정 UUID 유지, 서버 역할 권한, public 접근 금지, 재실행 차단을 검증했습니다. 실제 Supabase 실행은 별도입니다.
