# AIMI Android — 기기 저장 APK

서버 설정 없이 설치하는 버전입니다. **[APK 다운로드](https://github.com/rktzjql/sloppservice/raw/refs/heads/aimi-offline-apk/downloads/AIMI-offline.apk)** · [설치·빌드·기능 범위](docs/ANDROID_OFFLINE.md)

게임·챌린지·정원·상점·출석은 기기 안에서 실행·저장됩니다. 친구 기능은 제외했고, AI 질문 개선·업무 분석은 연결 전 상태입니다.

아래는 원본 앱과 이전 온라인 전환 단계의 참고 설명입니다.

# AIMI

**매일 쌓이는 나의 AI 감각**

이미지 속 키워드를 찾으며 프롬프트를 학습하고, 질문을 다듬고, 작업에 맞는 AI 모델을 비교하는 서비스입니다. 미니게임으로 챌린지 예산을 모으고, 활동으로 획득한 EP로 정원과 캐릭터를 꾸밀 수 있습니다.

앱인토스에 배포된 [AIMI](https://github.com/fotrhh22/aimi-online)를 기반으로 하는 **Android 전환 프로젝트**입니다.

## 주요 기능

| 기능 | 내용 |
| --- | --- |
| 이미지 챌린지 | 사전 생성된 이미지의 키워드 선택·규칙 기반 판정·정답 프롬프트·일별 해설 |
| 프롬프트 개선 | 기존 의도를 보존한 개선안·확장안·구절별 작성 팁 |
| AI 모델 추천 | 텍스트·이미지·영상별 모델 목록, 업무 분석과 코드 기반 비용 비교 |
| 미니게임 | 폴짝 길건너기·점프 달리기·숲길 달리기 |
| 정원·상점 | 아이템 구매·자유 배치·캐릭터 선택 |
| 소셜 | 친구 코드·친구 요청 및 수락·삭제·정원 방문 |
| 일일 활동 | 출석·오늘의 팁·EP·진행 기록 |
| 계정 | 닉네임·세션·개인정보처리방침·계정 삭제 |

## 사용 서비스

기반 서비스의 운영 구성과 소스에 포함된 연동입니다. 이 저장소 자체의 Android 운영 배포를 뜻하지 않습니다.

| 서비스 | 용도 |
| --- | --- |
| 앱인토스 | 기존 미니앱 배포·실행 환경, 익명 사용자 인증·공유·내비게이션 |
| Render | Fastify 백엔드 API 호스팅 |
| Supabase | PostgreSQL 데이터 저장 및 Storage 콘텐츠 저장 |
| Google Gemini API | 프롬프트 개선·업무 분석·모델군 제안 |
| OpenRouter API | 모델 목록·가격·지원 기능 수집, 챌린지 이미지 제작에 사용 |
| Artificial Analysis API | 모델 성능·출력 속도·응답 지연 자료 |
| GitHub | 소스·변경 이력 관리 |

모델 추천은 Gemini의 업무 분석과 서버의 필터·비용 계산을 조합합니다. 이미지 챌린지 판정은 LLM 채점이 아닌 서버 규칙으로 처리합니다. 챌린지 이미지는 미리 제작된 콘텐츠를 조회합니다.

## 기술 스택

| 영역 | 기술 |
| --- | --- |
| 프런트엔드 | React 18 · TypeScript · Vite · CSS · Emotion |
| 기존 토스 연동 | Apps-in-Toss Web Framework · TDS |
| 게임 | Canvas 2D · 공유 TypeScript 시뮬레이션 |
| 백엔드 | Node.js · Fastify · PostgreSQL |
| 공유 계약 | Zod · npm workspaces |
| 검증 | Node.js Test Runner · Playwright |

## 폴더 구성

```text
apps/
  miniapp/             React 화면·게임·에셋·기존 토스 연동
  api/                 인증·거래·콘텐츠·Gemini API
packages/
  contracts/           공유 타입·스키마
  game-core/           게임 규칙·시뮬레이션
  recommender/         모델 필터·비용 계산
content/               챌린지·모델 목록·일정·정책
supabase/migrations/   DB 스키마 변경 이력
tools/                 개발·콘텐츠·모델 관리·검증 도구
docs/                  Android 전환 자료·기존 정책 참고
```

## 실행

Node.js 22.12 이상.

```sh
npm ci
AIMI_AI_MODE=fixture npm run dev
```

프런트엔드 `http://127.0.0.1:5180` · 로컬 API `http://127.0.0.1:8081`.

로컬 개발 모드는 메모리 저장소와 예시 AI 응답을 사용하며, API 재시작 시 개발 기록이 초기화됩니다. 환경변수 예시는 `apps/api/.env.example`, `apps/miniapp/.env.example`에 있습니다. 실제 키·개인키·사용자 DB 데이터는 포함되지 않습니다.

## 현재 상태

2026-11-13 기준 기존 화면·서버·공유 로직·에셋·10일 콘텐츠가 포함되어 있습니다. 웹/API 빌드와 기존 테스트 **118개가 통과**했습니다.

**Capacitor·Android 네이티브 프로젝트·APK/AAB는 아직 구현되지 않았습니다.** 토스 의존성 분리와 Android 인증·내비게이션 연결이 남아 있습니다.

[Android 전환 기술 문서](docs/ANDROID_HANDOFF.md) · [소스 스냅샷 목록](docs/SOURCE_SNAPSHOT.json)
