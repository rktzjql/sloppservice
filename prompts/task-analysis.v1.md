# 업무 분석 계약 v2 — 모델군 제안

실제 런타임 시스템 지시는 apps/api/src/services/llm/prompts.ts에 있다. 추천은 Gemini.analyze가 TASK_ANALYSIS_SYSTEM_PROMPT와 TaskSchema만 사용한다. 개선기는 같은 TASK_ROUTING_RULES를 taskProfile에 적용한다. 버전은 task-profile-v3다.

- taskType(general/coding), requiredCapabilities(text/image/json/tools), suggestedTier, reason, unknowns를 반환한다.
- Small=경량·효율형, Medium=균형형, High=상위 수행 능력형 제품군이다. 업무 난이도·파라미터 수·같은 모델의 추론 강도를 뜻하지 않는다.
- 사용자 업무에 충분할 것으로 예상하는 최소 제품군을 제안한다. 필수 조건/미확인 정보를 기록한다.
- 모델별 제품군, 모델 이름, 가격, 성능 점수, 추천 순위는 생성하지 않는다.
- 서버는 등록된 모델군과 실제 AA 품질 자료를 별도로 검사하고 적격 후보만 비용순 최대3개 추천한다. 자료 부족을 임의 등급 변경으로 메우지 않는다.
