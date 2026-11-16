# Android 전환 저장소 작업 기준

- 이 저장소는 AIMI 토스 출시 앱의 Android 전환용 소스 스냅샷이다. 원본 저장소와 운영 서비스는 수정하지 않는다.
- README.md와 docs/ANDROID_HANDOFF.md를 먼저 읽는다. docs/reference는 토스 앱에서 가져온 정책 참고자료이며 Android 완료 명세가 아니다.
- 현재 Android/Capacitor 구현은 없다. 기존 토스 인증·SDK·TDS를 Android에서 그대로 사용할 수 있다고 가정하지 않는다.
- 테스트 인증과 fixture는 개발 전용이며 운영 인증으로 사용하지 않는다. 종료된 웹 데모를 재개하지 않는다.
- 실제 키·인증서·서명키·사용자 DB 데이터는 커밋하지 않는다. Gemini 키는 서버에만 둔다.
- 게임/추천/거래 규칙과 기존 디자인은 재사용한다. 프런트·서버 변경은 공유 계약을 함께 수정한다.
- 원격 Render/Supabase 변경은 운영자의 명시적 요청 없이 수행하지 않는다.
