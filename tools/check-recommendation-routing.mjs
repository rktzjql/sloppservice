/** Small, explicit synthetic smoke check. Calls configured Gemini, never prints keys or response bodies. */
import { config } from "dotenv";
import { writeFile, mkdir } from "node:fs/promises";
config({path:new URL('../apps/api/.env.local',import.meta.url),quiet:true});
const { Gemini } = await import('../apps/api/dist/services/llm/gemini.js');
const before=process.argv.includes('--before');
const cases=[
 {expected:'Small',text:'다음 문장을 영어로 번역해줘: 오늘 회의는 오후 3시에 시작합니다.'},
 {expected:'Medium',text:'직원 20명인 회사에서 사용할 협업 도구를 비교해줘. 문서 공동 편집, 권한 관리, 한국어 지원을 기준으로 장단점을 표로 정리해줘.'},
 {expected:'High',text:'다중 리전 결제 원장을 설계해줘. 네트워크 분할과 중복 이벤트, 순서 역전이 동시에 생길 때 이중 지급을 막는 불변식을 정의하고 트랜잭션·재처리 알고리즘을 제시해줘. 각 장애 시나리오에서 불변식이 유지되는 이유와 일관성·가용성의 절충을 검증해줘.'},
];
const rows=[];
for(const c of cases){try {const result=before?await new Gemini(false).optimize(c.text):await new Gemini(false).analyze(c.text);const task=before?result.taskProfile:result.task;rows.push({expected:c.expected,actual:task.suggestedTier,reason:task.reason,source:result.source,passed:task.suggestedTier===c.expected});}catch(e){rows.push({expected:c.expected,passed:false,error:e.code??e.name});}}
const report={stage:before?'before':'after',checkedAt:new Date().toISOString(),model:process.env.GEMINI_TEXT_MODEL??'gemini-3.1-flash-lite',note:'Three synthetic examples, single run; not a statistical routing quality evaluation.',cases:rows};
await mkdir('output/model-audit',{recursive:true});await writeFile('output/model-audit/routing-'+report.stage+'.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
