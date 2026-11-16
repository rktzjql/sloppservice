# image-variants.v1 — 결과 이미지 제작/편집 지시 초안

이미지 모델에 전달하는 명세 템플릿. 텍스트 모델이 픽셀을 생성한다고 가정하지 않는다.

## 템플릿

첨부한 승인 목표 이미지를 기준으로 학습용 비교 이미지를 제작하라.
유지할 요소: {{preserveConditions}}.
바꿀 요소: {{changedConditions}}.
반드시 보여야 하는 실제 조건: {{expectedActualConditions}}.
색감, 화면 비율, 카메라, 대상의 정체성은 변경 지시에 없는 한 유지하라.
변경하지 않은 대상의 개수나 관계를 임의로 바꾸지 마라.
추가 문자, 점수, 성공/실패 배지, 사용자 인터페이스를 그리지 마라.

## 제작 기록

targetAssetId, variantPlanId, promptVersion, modelId, generationParameters,
requestedConditions, observedConditions, reviewer, reviewStatus, assetId, sourceRights

## 검수

프롬프트를 따랐다고 실제 이미지가 정답임을 가정하지 않는다.
시각 모델 검사는 보조이며 사람이 대상·개수·색·관계·스타일을 확인한다.
실제 조건이 계획과 다르면 재제작하거나 다른 variant로 명시적으로 재분류한다.
원본 hash, 승인 결과 hash와 재현 가능한 제작 이력을 남긴다.
