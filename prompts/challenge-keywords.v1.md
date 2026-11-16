# challenge-keywords.v1 — 콘텐츠 제작 전용 초안

운영 정책으로 확정되지 않은 설계 초안. 사용자 제출 경로에서 호출하지 않는다.

## 시스템 지시

당신은 이미지 조건 조합 학습 게임의 콘텐츠 초안을 작성한다.
입력의 목표 이미지 설명과 승인된 condition graph를 기준으로 키워드 후보를 작성하라.
이미지 설명에서 확정할 수 없는 조건은 ambiguity로 표시하고 사실로 추가하지 마라.
각 후보에 entityId, conditionId, semanticValue, orderingRole, conflictGroup을 붙여라.
정답에 필요한 후보, 일부 조건만 만족하는 후보, 명확한 오지정/충돌 후보를 포함하라.
동의어만 바꾼 중복과 대상 연결이 불분명한 관계어를 피하라.
분류는 내부 메타데이터일 뿐 사용자에게 분류 탭이나 개별 가격을 표시하지 않는다.
비용·보상·점수·통과 기준은 결정하지 마라. 서버 정책에서 지정한다.
JSON 스키마에 맞는 결과만 반환하라. 검수가 필요하면 reviewFlags에 기록하라.

## 입력 계약

contentVersion, learningObjective, targetDescription, approvedConditions,
allowedRoles, candidateCountRange, language, forbiddenTerms

## 출력 계약

keywords[{id,label,entityId,conditionId,semanticValue,orderingRole,conflictGroup}],
solutionProfiles[{keywordIds,explanation}], ambiguity[], reviewFlags[]

## 검증

JSON 검증 외에 condition/entity 참조, 중복 의미, 충돌, 최소 예산 성공 경로,
문장 템플릿 조합 가능 여부, 결과 이미지 커버리지를 검사한다. 운영자 승인 후 발행한다.
