# AIMI 기기 저장 APK

이 브랜치는 서버·회원가입·친구 기능 없이 Android에 설치하는 버전이다. Render와 Supabase는 연결하지 않는다. 게임, 이미지 키워드 챌린지, 출석, 팁, 상점, 정원, 닉네임은 기기 안에서 동작한다. 모델 목록은 동봉된 스냅샷이며 실시간 갱신하지 않는다.

AI 질문 개선과 업무 분석은 아직 연결하지 않았고 실행 버튼은 비활성화했다. 예시 AI 응답이나 API 키 입력 화면은 제공하지 않는다. 향후 개발자용 키를 서버에 연결하면 사용자에게 키를 요구하지 않는 방식으로 확장할 수 있다.

## 설치

[APK 다운로드](https://github.com/rktzjql/sloppservice/raw/refs/heads/aimi-offline-apk/downloads/AIMI-offline.apk)

Android 7.0 이상. 다운로드한 파일을 열어 설치한다. Android가 요청하면 해당 브라우저/파일 앱의 '이 출처 허용'을 켠다. 개발자 모드, USB 연결, PC 서버는 필요 없다.

기록은 앱 전용 IndexedDB에 저장한다. 앱을 삭제하거나 저장 데이터를 지우면 복구할 수 없다. 기존 토스 앱의 기록을 가져오지 않는다. 기기 기록 초기화 메뉴에서도 삭제할 수 있다.

## 빌드

Node 22.12+, JDK 21, Android SDK 36, Gradle 8.14.3.

```sh
npm ci
npm run build:shared
npm run android:build:offline --workspace @aimi/miniapp
cd apps/miniapp
VITE_APP_RUNTIME=android VITE_OFFLINE=true VITE_ANDROID_DEV=false npx cap sync android
cd android
# 아래 4개 환경변수를 비공개 서명 정보로 설정한 다음 실행한다.
# AIMI_ANDROID_KEYSTORE, AIMI_ANDROID_STORE_PASSWORD,
# AIMI_ANDROID_KEY_ALIAS, AIMI_ANDROID_KEY_PASSWORD
./gradlew assembleRelease
```

출력: `apps/miniapp/android/app/build/outputs/apk/release/app-release.apk`.
서명 키는 저장소에 넣지 않는다. 같은 앱의 업데이트에는 같은 서명 키와 증가한 versionCode가 필요하다. 이번 빌드의 키는 작업 공간 `/workspace/work/signing/`에 별도 보관했다.

## 구현과 검증

`src/platform/offline`은 기존 게임·거래 규칙을 사용하는 로컬 처리기다. IndexedDB 저장 완료 후에만 성공을 반환하고 요청을 직렬 처리한다. 출석·구매·챌린지 보상 중복을 방지한다. 로컬 게임 특성상 기기 날짜 변경이나 로컬 데이터 조작을 서버가 검증하지 않는다.

```sh
node --import tsx --test tools/qa/offline.test.ts
# dist를 127.0.0.1:5200에서 제공하고 Chromium을 설치한 경우
node tools/qa/offline-browser.mjs
```

검증: 타입 검사와 웹 빌드, 로컬 처리 단위 테스트, 모바일 크기 Chromium에서 저장·보상·프로필·상점·게임·초기화·AI 비활성화, 외부 요청 없음, Android release 빌드와 서명 검사. 실제 Android 기기 설치·터치 테스트는 아직 수행하지 않았다.

다른 문서의 서버 설정과 미완료 Android 설명은 이전 온라인 전환 단계의 참고 자료다. 이 브랜치의 현재 상태는 이 문서를 따른다.
