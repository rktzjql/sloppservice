# Android APK 개발 시험판

기존 AIMI 화면·게임·추천·정원 코드를 Capacitor Android 안에 담았습니다.
원본 기준 커밋: 22c36485914b534e3892c2b8148f49e6a07cd017.

이 APK는 별도 Android 서버와 운영 인증이 준비되기 전의 **로컬 개발 시험판**입니다.
운영 토스 API/DB에 연결하지 않습니다. PC 로컬 서버가 없으면 시작할 수 없습니다.
예시 AI 응답과 개발용 계정을 사용하며 서버 재시작 시 기록이 초기화됩니다.
종료된 웹 데모는 사용하지 않습니다.

## 휴대폰에서 실행

1. PC에 Node.js 22.12 이상과 Android SDK Platform Tools(adb)를 설치합니다.
2. 소스 폴더에서 `npm ci`를 실행합니다.
3. `AIMI_AI_MODE=fixture npm run dev:prototype`을 실행하고 그대로 켜 둡니다.
   Windows PowerShell에서는 `$env:AIMI_AI_MODE="fixture"; npm run dev:prototype`을 사용합니다.
4. Android 휴대폰의 개발자 옵션에서 USB 디버깅을 켜고 PC와 USB 연결합니다.
5. `adb devices`로 연결을 확인하고, 폰에서 디버깅 허용을 누릅니다.
6. `adb reverse tcp:8081 tcp:8081`을 실행합니다. USB를 다시 연결하면 이 명령도 다시 실행합니다.
7. APK를 폰에서 열어 설치하거나 `adb install -r AIMI-dev.apk`로 설치합니다.
8. 앱 **AIMI 개발**을 열고 개발용 사용자 이름을 입력한 뒤 시작합니다.

APK 설치 시 해당 파일을 연 앱의 '알 수 없는 앱 설치' 권한이 필요할 수 있습니다.
Android 7.0(API 24) 이상이 필요합니다.
개발용 사용자 이름은 비밀번호가 아니며 실제 계정 보안을 제공하지 않습니다.
Gemini 키·서명키 등 실제 비밀키를 입력하거나 앱에 포함하지 마세요.

## 다시 빌드

Node.js 22.12+, JDK 21, Android SDK 36을 준비하고 `ANDROID_HOME`을 설정합니다.

```sh
npm ci
npm run android:apk
```

결과: `apps/miniapp/android/app/build/outputs/apk/debug/app-debug.apk`.
Windows에서는 `npm run android:sync` 후 android 폴더에서 `gradlew.bat assembleDebug`을 실행합니다.
프런트 빌드 스크립트의 환경변수 설정은 POSIX 셸을 사용합니다(Windows는 Git Bash/WSL 권장).
디버그 키는 로컬에서 자동 생성되며 배포용 서명키가 아닙니다.

## 구현과 한계

- Android 빌드에 토스 SDK·TDS가 포함되면 빌드를 실패시킵니다.
- 원래 CSS·폰트·콘텐츠·공유 게임/거래 로직을 유지합니다.
- 시스템 뒤로가기·클립보드·공유는 Capacitor 플러그인을 사용합니다.
- 개발판 공유는 친구 코드를 공유하며 토스 전용 초대 링크를 만들지 않습니다.
- 로컬 HTTP 연결은 개발판에만 사용합니다. 운영 Android 빌드는 인증이 구현될 때까지 차단됩니다.
- 정식 사용에는 별도 HTTPS API, 검증된 Android 인증, 계정 복원과 네이티브 기기 검증이 필요합니다.
- Android 실기기/에뮬레이터 실행은 이 환경에서 검증하지 않았습니다.

검증: Gradle APK 빌드 성공, APK v2 서명 검증 통과(Android API 24+, target 36), Android 웹 빌드/타입 검사, API 테스트 118개, 런타임/세션 테스트 14개 통과.
393×852 Chromium에서 개발 로그인·홈·출석 보상·정원 화면을 확인했고 페이지 오류는 없었습니다.
기존 `test:web-demo` 전체 실행은 누락된 `api/demo.js`와 기존 정원 다이얼로그 순서 검사에서 실패합니다.
해당 웹 데모 경로는 Android APK에서 사용하지 않습니다.
