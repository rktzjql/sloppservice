// Executes the actual app context navigation handlers against an in-memory browser.
// No browser rendering, network requests, credentials or application state mutations.
import fs from 'node:fs';
import vm from 'node:vm';
import { transformSync } from 'esbuild';
const root = new URL('../../', import.meta.url);
const source = fs.readFileSync(new URL('apps/miniapp/src/app/context.tsx', root), 'utf8');
const navigation = fs.readFileSync(new URL('apps/miniapp/src/app/navigation.ts', root), 'utf8');
const views = fs.readFileSync(new URL('apps/miniapp/src/features/challenge/view-state.ts', root), 'utf8');
function compile(src, require) {
  const module = {exports:{}};
  vm.runInNewContext(transformSync(src, {loader:'tsx',format:'cjs',target:'es2022'}).code,
    {module,exports:module.exports,require, ...globals});
  return module.exports;
}
let globals;
function runtime(entries, start = entries.length - 1, dialogs = [], noMarker = false) {
  const cells = [], effects = [], listeners = new Map();
  let cursor = 0, position = start, state, hostBack, cancelled = [], guarded = [];
  const stack = entries.map((path, index) => ({path, state: null}));
  const location = {pathname:'',search:''};
  const update = path => { const u = new URL(path, 'http://127.0.0.1:5280'); location.pathname=u.pathname; location.search=u.search; };
  update(stack[position].path);
  const react = {
    createContext:()=>({Provider:{}}),createElement:(_t,props)=>({props}),
    useState:init=>{const i=cursor++;if (!(i in cells)) cells[i]=typeof init==='function'?init():init;return [cells[i], v=>{cells[i]=typeof v==='function'?v(cells[i]):v;}];},
    useRef:init=>{const i=cursor++;return cells[i]??(cells[i]={current:init});},
    useCallback:fn=>{cursor++;return fn;},useContext:()=>null,
    useEffect:fn=>{cursor++;effects.push(fn);},
  };
  const history={
    get state() { return stack[position].state; },
    pushState:(state,_t,path)=>{stack.splice(position+1);stack.push({path,state:structuredClone(state)});position++;update(path);},
    replaceState:(state,_t,path)=>{stack[position]={path,state:structuredClone(state)};update(path);},
    back:()=>go(-1), go:delta=>go(delta),
  };
  const storage={getItem:()=>null,setItem:()=>{},removeItem:()=>{}};
  const window={scrollTo:()=>{},addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)};
  const document={querySelector:()=>dialogs[0]??null,querySelectorAll:()=>dialogs};
  globals={location,history,sessionStorage:storage,window,document,Event,URLSearchParams,setTimeout,clearTimeout,requestAnimationFrame:fn=>fn()};
  const view=compile(views,()=>{throw Error('unexpected import');});
  const policy=compile(navigation,()=>view);
  let trail=['/'];
  for (let i=0;i<stack.length;i++) { trail=policy.navigationTrail(trail,stack[i].path); stack[i].state={aimiNavigation:{index:i,trail}}; }
  if(noMarker)for(const e of stack)e.state=null;
  const module=compile(source+'\nexport {useAppState};', id=>{
    if(id==='react')return react;
    if(id.includes('view-state'))return view;
    if(id.includes('navigation'))return policy;
    if(id.includes('bridge'))return {hostNavigation:back=>{hostBack=back;return ()=>{};},updateNavigation:()=>{},exit:()=>{cancelled.push('exit');}};
    if(id.includes('client'))return {token:()=>null,localRuntime:true,request:()=>{throw Error('NETWORK_FORBIDDEN');}};
    throw Error(id);
  });
  function render(){cursor=0;effects.length=0;state=module.useAppState();for(const fn of effects)if(fn.toString().includes('popstate'))fn();}
  function go(delta){const next=position+delta;if(next<0||next>=stack.length)return;position=next;update(stack[position].path);listeners.get('popstate')?.({state:stack[position].state});render();}
  render();
  return {
    header:()=>{state.back();render();},host:()=>{hostBack();render();},native:()=>go(-1),forward:()=>go(1),
    navigate:(path,replace=false)=>{state.navigate(path,{replace});render();},
    guard:()=>state.blockNavigation(next=>{guarded.push(next);return false;}),
    result:()=>({path:cells[0],url:location.pathname+location.search,stack:stack.map(e=>e.path),trail:[...(history.state?.aimiNavigation?.trail??[])],position,cancelled,guarded}),
    dialog:label=>{const dialog={dispatchEvent:()=>{cancelled.push(label);dialogs.splice(dialogs.indexOf(dialog),1);}};return dialog;},
    layer:()=>state.registerBackHandler(state.path,()=>{cancelled.push('menu');return true;}),
    writing:()=>listeners.get('aimi-write-start')?.(),
    written:()=>listeners.get('aimi-write-end')?.(),
  };
}
const cases=[];
function check(name, entries, action, expected, options={}) {
  const dialogs=[];const r=runtime(entries, options.position??entries.length-1, dialogs, options.noMarker);
  if(options.modal)dialogs.push(r.dialog(options.modal));
  if(options.nested)dialogs.push(r.dialog('topmost'));
  if(options.guard)r.guard();
  if(options.write)r.writing();
  if(options.layer)r.layer();
  r[action]();const actual=r.result();
  const correct=actual.path===expected && (!options.expectedCancel||actual.cancelled[0]===options.expectedCancel);
  cases.push({name,action,expected,actual,verdict:correct?'matches-policy':'needs-special-handling'});
}
for(const action of ['header','host','native']) {
  for(const [name,route,expected] of [
    ['challenge selection','/challenge','/mission'],
    ['challenge combination','/challenge/combination','/challenge'],
    ['challenge result','/challenge/result/a','/mission'],
    ['challenge answer','/challenge/answer/a','/challenge/result/a'],
    ['game result','/results/game/a','/'],
    ['garden root','/garden','/'],['social root','/social','/'],['mission root','/mission','/'],
    ['friend garden','/friends/a','/social'],['garden shop','/shop/garden','/garden'],
    ['clean garden edit','/garden/edit','/garden'],['optimizer','/optimizer','/'],
    ['recommendations','/recommendations','/'],['account','/account','/'],
  ]) check(name, ['/',route],action,expected);
  check('modal on recommendations',['/','/recommendations'],action,'/recommendations',{modal:'close-modal',expectedCancel:'close-modal'});
  check('dirty garden edit',['/','/garden/edit'],action,'/garden/edit',{guard:true});
  check('game running',['/mission','/game'],action,'/game',{guard:true});
}
check('answer from its result',['/mission','/challenge/result/a','/challenge/answer/a'],'native','/challenge/result/a');
check('nested modal closes topmost',['/','/recommendations'],'header','/recommendations',{modal:'underlying',nested:true,expectedCancel:'topmost'});
check('direct model entry has no app predecessor',['/models/google%2Fexample'],'header','/recommendations');
check('clean editor entered from shop',['/garden','/shop/garden','/garden/edit'],'header','/garden');
check('result forward to answer',['/mission','/challenge/result/a','/challenge/answer/a'],'forward','/challenge/answer/a',{position:1});
check('legacy result query initial render',['/mission','/challenge/combination?result=a'],'header','/mission');
for (const action of ['header','host','native']) {
  check('transaction blocks navigation',['/garden','/shop/garden'],action,'/shop/garden',{write:true});
  check('friend menu consumes back first',['/','/social'],action,'/social',{layer:true});
}
for(const action of ['header','host','native']) {
  check('direct unmarked model URL',['/models/example'],action,'/recommendations',{noMarker:true});
  check('direct unmarked answer URL',['/challenge/answer/a'],action,'/challenge/result/a',{noMarker:true});
}
for(const action of ['header','host','native'])check('challenge model detail returns home',['/','/mission','/challenge/result/a','/challenge/answer/a','/models/example'],action,'/');
const reductions=[];
function sequence(name, entries, navigatePaths, expectedBacks) {
  const r=runtime(entries);
  for(const path of navigatePaths)r.navigate(path);
  let presses=0;
  while(r.result().path!=='/' && presses<20){r.header();presses++;}
  reductions.push({name,forwardActions:navigatePaths.length,backPressesToHome:presses,expectedBacks,trailAfter:r.result().trail,pass:presses===expectedBacks});
}
sequence('30 tab changes',['/'],Array.from({length:30},(_,i)=>['/garden','/social','/mission'][i%3]),1);
sequence('12 model detail visits',['/','/recommendations'],Array.from({length:12},(_,i)=>'/models/model-'+i),2);
sequence('shop to garden editing',['/','/garden','/shop/garden'],['/garden/edit'],2);
sequence('5 duplicate route clicks',['/','/mission'],Array(5).fill('/challenge'),2);
sequence('challenge answer and model',['/','/mission','/challenge/result/a','/challenge/answer/a'],['/models/example'],1);
const output={scope:'Actual context.tsx handlers in an in-memory history/DOM adapter. Not browser, SDK device, rendering or backend execution.',createdAt:new Date().toISOString(),cases:cases.length,matches:cases.filter(c=>c.verdict==='matches-policy').length,needsSpecialHandling:cases.filter(c=>c.verdict!=='matches-policy').length,results:cases,backPressAudit:reductions};
fs.writeFileSync(new URL('output/qa/BACK_NAVIGATION_APPLIED_20261111.json',root),JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({cases:output.cases,matches:output.matches,needsSpecialHandling:output.needsSpecialHandling,backPressAudit:reductions,issues:cases.filter(c=>c.verdict!=='matches-policy').map(c=>({name:c.name,action:c.action,expected:c.expected,actual:c.actual.path,cancelled:c.actual.cancelled}))},null,2));

if(cases.some(c=>c.verdict!=="matches-policy") || reductions.some(c=>!c.pass)) throw Error("Navigation regression");
