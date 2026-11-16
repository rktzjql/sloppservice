// Run after a production-mode build with api.example.test/auth.example.test QA origins.
// The provider and API are intercepted. This does not claim a real cloud deployment.
import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
const fixtureBase='http://127.0.0.1:8081';
const login=await (await fetch(fixtureBase+'/auth/local',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'android-session-qa'})})).json();
const fixtures={};
for(const path of ['/v1/state','/v1/content']) fixtures[path]=await (await fetch(fixtureBase+path,{headers:{Authorization:'Bearer '+login.data.token}})).json();
Object.assign(fixtures['/v1/state'].data,{name:'자동계정 QA',balance:0,nicknameSet:true,inventory:['seed']});
const user={id:'11111111-1111-4111-8111-111111111111',aud:'authenticated',role:'authenticated',is_anonymous:true,app_metadata:{},user_metadata:{},created_at:new Date().toISOString()};
const jwt=[Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+3600,is_anonymous:true})).toString('base64url'),'test-signature'].join('.');
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
let signups=0,exchanges=0,expired=false;
const context=await browser.newContext({viewport:{width:393,height:852}});
await context.route('https://auth.example.test/**',async route=>{
  if(route.request().url().includes('/signup')) signups++;
  await route.fulfill({json:{access_token:jwt,refresh_token:'qa-refresh-token',expires_in:3600,token_type:'bearer',user}});
});
await context.route('https://api.example.test/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path==='/auth/android') {
    assert.equal(route.request().postDataJSON().accessToken,jwt); exchanges++;
    return route.fulfill({json:{data:{token:String(exchanges).repeat(64),expiresIn:3600}}});
  }
  if(expired && route.request().headers().authorization==='Bearer '+'1'.repeat(64)) return route.fulfill({status:401,json:{error:{code:'UNAUTHENTICATED'}}});
  return route.fulfill({json:fixtures[path]??{data:{}}});
});
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
try {
  await page.goto('http://127.0.0.1:5190');
  await expect(page.getByText('자동계정 QA님, 오늘도 한 판 어때요?')).toBeVisible();
  assert.equal(signups,1);assert.equal(exchanges,1);
  await expect(page.getByText('개발용 예시 · 실제 보상 아님')).not.toBeVisible();
  expired=true;await page.reload();
  await expect(page.getByText('자동계정 QA님, 오늘도 한 판 어때요?')).toBeVisible();
  assert.equal(signups,1);assert.equal(exchanges,2);
  await page.reload();await expect(page.getByText('자동계정 QA님, 오늘도 한 판 어때요?')).toBeVisible();
  assert.equal(signups,1);assert.equal(exchanges,2);
  assert.deepEqual(errors,[]);
  console.log('PASS: auto guest start, reuse after reload, single recovery after expiry, no signup form or dev UI; mocked provider/API only');
} finally {await browser.close();}
