import React from "react";
import { androidRuntime, offlineRuntime } from "../../lib/runtime";
export const SUPPORT_EMAIL = androidRuntime
  ? import.meta.env.VITE_SUPPORT_EMAIL
  : "fotrhh22@gmail.com";
export const PRIVACY_OPERATOR = androidRuntime
  ? import.meta.env.VITE_PRIVACY_OPERATOR
  : "Hunho Kang(강훈호)";
export const PRIVACY_VERSION = "2026-11-13";
export function SupportContact() {
  if (offlineRuntime) return <section className="support-contact"><h2>앱 정보</h2><p>AIMI 기기 저장 버전 · 1.0.0</p><p>문의는 APK를 전달한 개발자에게 보내주세요.</p></section>;
  return (
    <section className="support-contact" aria-label="고객 문의">
      <h2>고객 문의</h2>
      <p>이용 중 불편한 점이나 궁금한 내용을 보내주세요.</p>
      <p className="support-email">{SUPPORT_EMAIL}</p>
    </section>
  );
}
const sections = [
  {
    title: "1. 운영자와 문의처",
    text: [
      "운영자: " + PRIVACY_OPERATOR,
      "문의메일: " + SUPPORT_EMAIL,
      "개인정보 열람·정정·삭제·처리정지 요청을 받습니다.",
    ],
  },
  {
    title: "2. 정보를 사용하는 이유",
    text: [
      "다시 접속했을 때 내 기록을 이어가고, 아래 기능을 제공하기 위해 사용해요.",
      "닉네임과 친구 관계 관리, 출석·게임·챌린지 기록 저장, EP·보유 아이템·정원 배치 저장",
      "프롬프트 개선과 AI 모델 추천, 이용 횟수 확인, 중복 요청과 오류 대응",
    ],
  },
  {
    title: "3. 저장하는 정보",
    text: [
      "계정 정보: 사용자 식별값, 내부 회원번호, 접속 유지 정보, 닉네임, 친구 코드",
      "이용 기록: 출석, EP 거래, 보유품, 정원 배치, 게임·챌린지 진행 기록, 친구 관계와 요청 내역",
      "AI 기능 기록: 입력한 질문, 개선·분석 결과, 이용 횟수, 오류와 중복 요청 처리 기록",
      androidRuntime
        ? "Supabase의 자동 계정 식별값으로 기록을 저장해요. 실명·전화번호·이메일을 로그인에 요구하지 않아요. 앱 삭제나 기기 변경 시 현재 계정을 복구할 수 없어요."
        : "현재 인증 방식으로는 토스의 실명·전화번호·이메일을 받지 않아요. 이메일로 문의하면 발신 주소와 문의 내용을 확인해요.",
    ],
  },
  {
    title: "4. AI와 외부 서비스",
    text: [
      "프롬프트 개선과 업무 분석에는 Google Gemini를 사용해요. 이 과정에서 입력한 질문과 분석에 필요한 지침이 Google에 전달돼요. 개인정보나 기밀은 입력하지 말아주세요.",
      "닉네임·친구 코드·접속 토큰은 AI 요청에 자동으로 포함하지 않아요.",
      "모델 선정과 비용 비교, 이미지 챌린지 채점은 AIMI의 정해진 규칙으로 처리해요.",
      "Render: 서버 운영",
      "Supabase: 데이터와 파일 저장, Android 자동 계정 인증",
      "Google Gemini: 질문 개선과 업무 분석",
      "외부 서비스의 데이터 처리에는 각 업체의 약관과 데이터 처리 약정이 적용돼요.",
    ],
  },
  {
    title: "5. 친구에게 보이는 정보",
    text: [
      "친구 요청을 수락하면 서로 닉네임, 선택한 캐릭터, 정원에 배치한 아이템, 오늘 챌린지 성공 여부와 누적 성공 횟수를 볼 수 있어요.",
      "친구가 아닌 사람이나 차단된 상대는 정원을 볼 수 없어요. 친구 삭제는 목록에서 상대를 길게 눌러주세요.",
    ],
  },
  {
    title: "6. 기록의 보관과 삭제",
    text: [
      "계정과 이용 기록은 서비스를 이용하는 동안 보관해요. 계정을 삭제하면 운영 데이터베이스의 회원 정보와 연결된 기록도 함께 삭제해요.",
      "AI 결과와 중복 요청 응답은 생성 후 24시간이 지나면 주기적으로 정리해요.",
      "외부 서비스의 로그·백업은 각 업체의 보관 정책을 따라요. 계정을 삭제해도 외부 백업까지 즉시 지워지는 것은 아니에요.",
    ],
  },
  {
    title: "7. 내 정보 관리",
    text: [
      "닉네임 변경과 계정 삭제는 계정 관리에서 할 수 있어요.",
      "그 밖의 개인정보 열람·정정·삭제·처리정지는 문의메일로 요청해주세요. 요청에 따라 계정 소유 여부를 확인할 수 있어요.",
      "기기에는 접속을 유지하기 위한 정보와 임시 화면 상태가 남을 수 있어요. 로그아웃하거나 기기 저장정보를 지워도 서버의 계정과 기록은 삭제되지 않아요.",
    ],
  },
  {
    title: "8. 정보 보호와 변경 안내",
    text: [
      androidRuntime
        ? "암호화 통신과 계정별 접근 권한을 적용해요. 자동 계정의 갱신정보는 Android 보안 저장소로 암호화해 보관하고, Gemini 공용 키는 서버에만 보관해요."
        : "암호화 통신, 계정별 접근 권한, 서버 비밀 키 분리 등의 방법으로 정보를 보호해요. 토스에서 받은 원본 사용자 식별키는 변환한 값으로 저장해요.",
      "방침이 바뀌면 이 화면에서 변경 내용과 날짜를 안내할게요.",
    ],
  },
];
export function PrivacyDocument() {
  if (offlineRuntime) return <article className="privacy-document">
    <p className="caption">작성일 2026-11-16</p>
    <h2>휴대폰에 저장하는 기록</h2>
    <p>닉네임, 출석, 게임과 챌린지 기록, EP, 보유품, 정원 배치를 이 휴대폰 안에 저장해요.</p>
    <p>회원가입이나 서버 연결 없이 사용할 수 있어요. 친구 기능과 AI 질문 개선·업무 분석은 이번 버전에 연결되어 있지 않아요.</p>
    <h2>외부 연결</h2>
    <p>앱의 이용 기록이나 입력 내용은 서버로 전송하지 않아요. 모델의 공식 사이트 링크를 직접 열면 해당 사이트의 개인정보 처리방침이 적용돼요.</p>
    <h2>기록 삭제</h2>
    <p>계정 관리의 기기 기록 초기화에서 기록을 지울 수 있어요. 앱 삭제나 앱 저장 데이터 삭제 시에도 기록이 지워지며, 다른 기기로 복구하거나 동기화할 수 없어요.</p>
    <h2>문의</h2><p>APK를 전달한 개발자에게 문의해주세요.</p>
  </article>;

  return (
    <article className="privacy-document">
      <p className="caption">작성일 {PRIVACY_VERSION}</p>
      {sections.map((s) => (
        <section key={s.title}>
          <h2>{s.title}</h2>
          {s.text.map((t) => (
            <p key={t}>{t}</p>
          ))}
        </section>
      ))}
    </article>
  );
}
