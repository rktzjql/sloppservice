# 프롬프트 개선기 런타임 규칙

최신 시스템 프롬프트의 단일 원본은 apps/api/src/services/llm/prompts.ts의 OPTIMIZER_SYSTEM_PROMPT다. 이 파일은 실제 코드를 대체하는 별도 프롬프트가 아니다.

- improvedText: 문법·표현 정리. 원문에 없는 주제·대상·기법·수량·형식 추가 금지.
- extendedExample: AI에 전달할 요청문. 질문의 정답이나 해결책을 대신 작성하지 않음. 추가한 조건은 addedAssumptions에 공개.
- 모르는 사용자 상황은 자리표시자로 제안. 원문의 수량과 제약 유지.
- changes: string[]. tips: {quote:string,tip:string}[]. taskProfile: 업무·필수 기능·등급 분석.
- 서버는 요청문 형태·숫자 보존·임의 수량·과도한 기본 확장·추가 조건 공개·인용 유효성을 검사. 모든 의미 보존의 완전한 보장은 아님.
- UI는 결과 평문을 보여주며 구절별 밑줄/팝업은 사용하지 않음.
