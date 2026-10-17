import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { blank, addObservation, saveCheckin, saveEntry } from '@/domain/state';
import { buildDemo } from '@/domain/demo';
import { stepDraft } from '@/domain/uiSteps';
const identity = vi.hoisted(() => ({ sid:'route-user' }));
vi.mock('./session', () => ({sessionId:async()=>identity.sid}));
vi.mock('./gemini', () => ({geminiConfigured:()=>false,generationMeta:()=>undefined,MODEL:'disabled',generateJSON:vi.fn()}));
let dir:string, repo:typeof import('./repo'), session:typeof import('@/app/api/session/route'), commands:typeof import('@/app/api/command/route'), reviews:typeof import('@/app/api/review/route');
const request = (endpoint:string, body?:unknown, mode='personal') => new Request(`http://localhost/api/${endpoint}?mode=${mode}`,{method:body ? 'POST' : 'GET',...(body ? {headers:{'Content-Type':'application/json'},body:JSON.stringify(body)} : {})});
const cmd = (action:string,inputRevision:number,data:Record<string,unknown>,mode='demo') => commands.POST(request('command',{action,inputRevision,data},mode));
beforeAll(async()=>{dir=mkdtempSync(path.join(os.tmpdir(),'aura-v2-api-'));process.env.DATA_DIR=dir;process.env.STORAGE='file';repo=await import('./repo');session=await import('@/app/api/session/route');commands=await import('@/app/api/command/route');reviews=await import('@/app/api/review/route');});
afterAll(()=>{rmSync(dir,{recursive:true,force:true});delete process.env.DATA_DIR;});
beforeEach(()=>{identity.sid=`user-${Math.random().toString(36).slice(2)}`;});
describe('real file-backed routes and visitor/mode isolation',()=>{
  it('demo commands never replace personal records and another visitor cannot read them',async()=>{
    const personal=blank();const o=addObservation(personal,'stress');saveCheckin(personal,{observationId:o.id,topicId:'stress',status:'recorded',score:4,occurredAt:'2026-10-01T21:00'});await repo.saveState(identity.sid,personal);
    const res=await cmd('demo',0,{day:10,now:'2026-10-08T00:30:00Z',timezone:'Asia/Taipei'});expect(res.status).toBe(200);
    expect((await repo.loadState(identity.sid))!.checkins).toEqual(personal.checkins);
    expect((await repo.loadState(`${identity.sid}-demo`))!.mode).toBe('demo');
    identity.sid='another-visitor';expect((await (await session.GET(request('session',undefined,'demo'))).json()).state.checkins).toEqual([]);
  });
  it('legacy single-slot demo is archived even if demo slot already exists',async()=>{
    const legacy=buildDemo(4);await repo.saveState(identity.sid,legacy);await repo.saveState(`${identity.sid}-demo`,buildDemo(10));
    const out=await (await session.GET(request('session'))).json();expect(out.state.plans).toEqual([]);expect((await repo.loadState(`${identity.sid}-legacy-demo`))!.plans).toEqual(legacy.plans);
    expect((await repo.loadState(`${identity.sid}-demo`))!.demo!.day).toBe(10);
  });
  it('rejects client plan/safety/review forgery while saving real records',async()=>{
    const s=blank(),o=addObservation(s,'productivity');await repo.saveState(identity.sid,s);const incoming=structuredClone(s);saveEntry(incoming,{kind:'food',name:'Lunch',occurredAt:'2026-10-01T12:00'});
    incoming.plans=buildDemo(10).plans;incoming.aiReviews=[{id:'fake'} as never];incoming.safetyEvents=[{id:'fake'} as never];
    const res=await session.PUT(new Request('http://localhost/api/session',{method:'PUT',body:JSON.stringify({state:incoming})}));expect(res.status).toBe(200);const saved=(await res.json()).state;expect(saved.plans).toEqual([]);expect(saved.safetyEvents).toEqual([]);expect(saved.entries[0].origin).toBe('personal');expect(saved.observations[0].id).toBe(o.id);
  });
  it('only one concurrent command at a revision is saved',async()=>{
    await repo.saveState(`${identity.sid}-demo`,buildDemo(10));const s=(await repo.loadState(`${identity.sid}-demo`))!,p=s.plans[0];
    const results=await Promise.all([cmd('decide',0,{planId:p.id,planVersion:1,choice:'observe'}),cmd('decide',0,{planId:p.id,planVersion:1,choice:'stop'})]);expect(results.map(r=>r.status).sort()).toEqual([200,409]);expect((await repo.loadState(`${identity.sid}-demo`))!.decisions).toHaveLength(s.decisions.length + 1);
  });
  it('existing worse-feedback pause is saved and observation clears the presentation hold',async()=>{
    const s=buildDemo(10),p=s.plans[0];await repo.saveState(`${identity.sid}-demo`,s);
    const fb=await cmd('feedback',0,{id:'worse',planId:p.id,planVersion:1,date:'2026-10-08',occurredAt:'2026-10-08T10:00',execution:'Done',answer:'unknown',change:'Worse',barriers:[],note:''});expect(fb.status).toBe(200);
    const current=(await fb.json()).state;expect(current.plans[0].status).toBe('stopped');expect(current.plans[0].safetyHold).toBeDefined();
    expect((await cmd('decide',1,{planId:p.id,planVersion:1,choice:'continue'})).status).toBe(400);
    expect((await cmd('accept',1,{topicId:p.topicId,observationId:p.observationId,stepId:'chat:busy-week',step:stepDraft('chat:busy-week',p.topicId)!.step,start:'2026-10-08',review:'2026-10-14'})).status).toBe(400);
    expect((await cmd('decide',1,{planId:p.id,planVersion:1,choice:'observe'})).status).toBe(200);
    expect((await repo.loadState(`${identity.sid}-demo`))!.plans[0].safetyHold?.resolvedAt).toBeDefined();
  });
  it('a proposal-free review cannot fall back to a different step, and stale proposals reject',async()=>{
    const s=buildDemo(10),p=s.plans[0];s.aiReviews=[{id:'r',contract:'aura.review.v1',requestId:'q',planId:p.id,planVersion:1,inputRevision:0,mode:'demo',feedbackIds:[],summary:'Observe',recommendation:'observe',reasons:['No new step'],proposal:null,safety:{pause:false},via:'gemini',at:'now'}];await repo.saveState(`${identity.sid}-demo`,s);
    const data={planId:p.id,aiReviewId:'r',requestId:'q',topicId:p.topicId,observationId:p.observationId,stepId:'chat:busy-week',start:'2026-10-08',review:'2026-10-14'};
    expect((await cmd('accept',0,data)).status).toBe(400);
    s.inputRevision=1;await repo.saveState(`${identity.sid}-demo`,s);expect((await cmd('accept',1,data)).status).toBe(409);
  });
  it('a confirmed server-owned review retains lineage, prior feedback and decision history',async()=>{
    const s=buildDemo(10),p=s.plans[0],proposal=stepDraft('chat:busy-week',p.topicId)!;
    s.aiReviews=[{id:'approved-test-review',contract:'aura.review.v1',requestId:'approved-test-request',planId:p.id,planVersion:p.version,inputRevision:0,mode:'demo',feedbackIds:s.feedbacks.map(f=>f.id),summary:'Isolated fixture, not AI',recommendation:'adjust',reasons:['Test confirmation'],proposal,safety:{pause:false},via:'gemini',at:'now'}];
    await repo.saveState(`${identity.sid}-demo`,s);
    const response=await cmd('accept',0,{planId:p.id,aiReviewId:'approved-test-review',requestId:'approved-test-request',topicId:p.topicId,observationId:p.observationId,start:'2026-10-08',review:'2026-10-14'});
    expect(response.status).toBe(200);const saved=(await response.json()).state;
    const next=saved.plans.at(-1);expect(next.lineageId).toBe(p.lineageId);expect(next.version).toBe(p.version+1);expect(next.basedOn.aiReviewId).toBe('approved-test-review');
    expect(saved.plans.find((x:{id:string})=>x.id===p.id).status).toBe('replaced');expect(saved.feedbacks).toEqual(s.feedbacks);expect(saved.decisions.at(-1).newPlanId).toBe(next.id);
  });
  it('foreign observation, unapproved and edited actions never activate a plan',async()=>{
    const s=buildDemo(10),p=s.plans[0];await repo.saveState(`${identity.sid}-demo`,s);
    const data={topicId:p.topicId,observationId:p.observationId,stepId:'chat:busy-week',start:'2026-10-08',review:'2026-10-14'};
    expect((await cmd('accept',0,{...data,observationId:'foreign'})).status).toBe(400);
    expect((await cmd('accept',0,{...data,stepId:'not-in-catalog'})).status).toBe(400);
    expect((await cmd('accept',0,{...data,step:'Drink more caffeine'})).status).toBe(400);
    expect((await repo.loadState(`${identity.sid}-demo`))!.plans).toHaveLength(s.plans.length);
  });
  it('unconfigured Gemini is explicit and saves no fabricated result',async()=>{
    const s=buildDemo(10),p=s.plans[0];await repo.saveState(`${identity.sid}-demo`,s);
    const response=await reviews.POST(request('review',{planId:p.id,planVersion:1,inputRevision:0,requestId:'real-api-request',today:'2026-10-08'},'demo'));expect((await response.json()).status).toBe('not-integrated');expect((await repo.loadState(`${identity.sid}-demo`))!.aiReviews).toEqual([]);
  });
  it('rejects invalid, mismatched and future record times; a not-sure answer keeps its words without a score',async()=>{
    const s=blank(),o=addObservation(s,'stress');s.timezone='UTC';saveCheckin(s,{observationId:o.id,topicId:'stress',status:'unknown',score:null,note:'Busy and tense',occurredAt:'2026-10-01T20:00'});
    const put=(state:typeof s)=>session.PUT(new Request('http://localhost/api/session',{method:'PUT',body:JSON.stringify({state})}));
    expect((await put(s)).status).toBe(200);s.inputRevision=1;s.checkins[0].occurredAt='2026-02-30T20:00';expect((await put(s)).status).toBe(400);
    s.checkins[0].occurredAt='2099-01-01T20:00';s.checkins[0].date='2099-01-01';expect((await put(s)).status).toBe(400);
    expect((await repo.loadState(identity.sid))!.checkins[0].score).toBeNull();
  });
  it('linked-health refresh advances review revision and preserves existing records',async()=>{
    const s=buildDemo(10);s.mode='personal';s.demo=null;await repo.saveState(identity.sid,s);
    const token='token-refresh';await repo.createLink({token,sid:identity.sid,status:'pending',expiresAt:Date.now()+60000});
    const h={...s.healthImport!,via:'ios-app' as const,importedAt:new Date().toISOString()};expect(await repo.completeLink(token,h)).toBe(true);
    const next=(await repo.loadState(identity.sid))!;expect(next.inputRevision).toBe(1);expect(next.checkins).toMatchObject(s.checkins);expect(next.healthImport).toEqual(h);
    expect((await cmd('decide',0,{planId:s.plans[0].id,planVersion:1,choice:'continue'},'personal')).status).toBe(409);
  });  it('an export with ISO HRV and sub-minute workout timestamps persists through session validation',async()=>{
    const {createExportParser}=await import('@/domain/health');const parser=createExportParser();
    parser.push('<Record type="HKQuantityTypeIdentifierHeartRateVariabilitySDNN" unit="ms" value="50" startDate="2026-10-01 10:00:25 +0800" endDate="2026-10-01 10:00:25 +0800"/><Workout startDate="2026-10-01 10:00:20 +0800" endDate="2026-10-01 10:00:40 +0800"/>');
    const s=blank();s.dataSource='apple-health';s.healthImport={...parser.finish(),via:'export-xml',importedAt:new Date().toISOString()};
    const response=await session.PUT(new Request('http://localhost/api/session',{method:'PUT',body:JSON.stringify({state:s})}));expect(response.status).toBe(200);
    expect((await repo.loadState(identity.sid))!.healthImport!.hrvSamples!['2026-10-01'][0].timestamp).toBe('2026-10-01T10:00:25+08:00');
  });
  it('rejects future review cutoffs and serializes one-time health tokens',async()=>{
    const s=buildDemo(10);s.timezone='Asia/Taipei';await repo.saveState(`${identity.sid}-demo`,s);
    const response=await reviews.POST(request('review',{planId:s.plans[0].id,planVersion:1,inputRevision:0,requestId:'future',today:'2099-01-01'},'demo'));expect(response.status).toBe(503);expect((await response.json()).error).toContain('future');
    const token='concurrent-token';await repo.createLink({token,sid:identity.sid,status:'pending',expiresAt:Date.now()+60000});
    expect((await Promise.all([repo.completeLink(token,s.healthImport!),repo.completeLink(token,s.healthImport!)])).sort()).toEqual([false,true]);
  });

  it('removing a goal keeps its check-ins and later saves succeed (no stored links to break)',async()=>{
    const s=blank(),o=addObservation(s,'evening-energy');s.profile.goals=['drained','stressed'];
    const put=(state:typeof s)=>session.PUT(new Request('http://localhost/api/session',{method:'PUT',body:JSON.stringify({state})}));
    expect((await put(s)).status).toBe(200);
    s.inputRevision=1;s.profile.goals=['stressed'];expect((await put(s)).status).toBe(200);
    s.inputRevision=2;saveCheckin(s,{observationId:o.id,topicId:o.topicId,status:'recorded',score:3,occurredAt:'2026-10-01T21:00'});expect((await put(s)).status).toBe(200);
    const saved=(await repo.loadState(identity.sid))!;expect(saved.profile.goals).toEqual(['stressed']);expect(saved.observations).toHaveLength(1);expect(saved.checkins).toHaveLength(1);
    s.inputRevision=3;s.profile.goals=['not-a-goal'];expect((await put(s)).status).toBe(400);
  });
  it('a page from before the goal model can still save: links are dropped and words-only becomes not sure',async()=>{
    const s=blank(),o=addObservation(s,'stress');s.timezone='UTC';
    const legacy=JSON.parse(JSON.stringify(s));legacy.profile.goals=[{id:'stressed',label:'Feel less tense',observationIds:[o.id],priority:1}];legacy.profile.concerns=['stressed'];legacy.observations[0].goalIds=['stressed'];
    legacy.checkins=[{id:'c1',observationId:o.id,topicId:'stress',source:'check-in',status:'text-only',score:null,note:'Tense',occurredAt:'2026-10-01T20:00',date:'2026-10-01',createdAt:'2026-10-01T20:00:00Z'}];
    expect((await session.PUT(new Request('http://localhost/api/session',{method:'PUT',body:JSON.stringify({state:legacy})}))).status).toBe(200);
    const saved=(await repo.loadState(identity.sid))! as unknown as Record<string,any>;
    expect(saved.profile.goals).toEqual(['stressed']);expect(saved.profile.concerns).toBeUndefined();expect(saved.observations[0].goalIds).toBeUndefined();
    expect(saved.checkins[0]).toMatchObject({status:'unknown',score:null,note:'Tense'});
  });
  it('deleting personal records also deletes the archived single-slot demo',async()=>{
    await repo.saveState(identity.sid,buildDemo(4));await session.GET(request('session'));
    expect(await repo.loadState(`${identity.sid}-legacy-demo`)).not.toBeNull();
    await session.DELETE(request('session'));
    expect(await repo.loadState(`${identity.sid}-legacy-demo`)).toBeNull();expect(await repo.loadState(identity.sid)).toBeNull();
  });
  it('a phone link does not replace a newer import already in the records',async()=>{
    const s=blank();s.onboarded=true;s.dataSource='apple-health';s.healthImport={sleep:{'2026-10-01':7},activity:{},cycle:[],range:['2026-10-01','2026-10-01'],via:'export-xml',importedAt:'2099-01-01T00:00:00.000Z',records:1};await repo.saveState(identity.sid,s);
    const token='older-link';await repo.createLink({token,sid:identity.sid,status:'pending',expiresAt:Date.now()+60000});
    expect(await repo.completeLink(token,{...s.healthImport!,via:'ios-app',importedAt:new Date().toISOString()})).toBe(true);
    expect((await repo.loadState(identity.sid))!.healthImport!.via).toBe('export-xml');
  });
});
describe('chat request validation',()=>{
  const chat=async(body:unknown)=>(await import('@/app/api/aura/route')).POST(request('aura',body));
  it('rejects stale revisions and options Aura did not offer in its latest message',async()=>{
    const s=blank();s.inputRevision=3;s.messages=[{role:'guide',text:'Which one?',interaction:{kind:'clarification',options:[{id:'stress',label:'Perceived stress',text:'I mean stress',topicId:'stress'}]}},{role:'user',text:'I mean stress'}];await repo.saveState(identity.sid,s);
    expect((await chat({text:'hi',today:'2026-10-08',inputRevision:2})).status).toBe(409);
    expect((await chat({text:'I mean stress',today:'2026-10-08',inputRevision:3,choice:{messageIndex:0,optionId:'productivity',topicId:'productivity'}})).status).toBe(400);
    expect((await chat({text:'I mean stress',today:'2026-10-08',inputRevision:3,choice:{messageIndex:0,optionId:'stress',topicId:'productivity'}})).status).toBe(400);
    expect((await chat({text:'I mean stress',today:'2026-10-08',choice:{messageIndex:0,optionId:'stress',topicId:'stress'}})).status).toBe(503);
    expect((await chat({text:'x',today:'2026-10-08',selectedTopic:'made-up'})).status).toBe(400);
  });
});


describe('guided demo routes', () => {
  it('serves exact scripted prompts without Gemini, only in demo mode', async () => {
    const { DEMO_TURNS } = await import('@/domain/demoConversation');
    const aura = await import('@/app/api/aura/route');
    await repo.saveState(`${identity.sid}-demo`, buildDemo(1));
    const body = {text: DEMO_TURNS[1][0].user, today: '2026-10-17'};
    const response = await aura.POST(request('aura', body, 'demo'));
    expect(response.status).toBe(200);
    expect((await response.json()).reply).toMatchObject({via:'preset', text:DEMO_TURNS[1][0].reply});
    expect((await aura.POST(request('aura', body))).status).toBe(503);
    expect((await aura.POST(request('aura', { ...body, text:'An unrelated message' }, 'demo'))).status).toBe(403);
  });
  it('keeps main revision, choice and persisted-safety checks on scripted requests', async () => {
    const { DEMO_TURNS } = await import('@/domain/demoConversation');
    const aura = await import('@/app/api/aura/route');
    const s = buildDemo(1); s.profile.includeDemoInAI = true; s.inputRevision = 3;
    await repo.saveState(`${identity.sid}-demo`, s);
    const body = {text:DEMO_TURNS[1][0].user,today:'2026-10-17',inputRevision:3};
    expect((await aura.POST(request('aura',{...body,inputRevision:2},'demo'))).status).toBe(409);
    expect((await aura.POST(request('aura',{...body,choice:{messageIndex:0,optionId:'invented'}},'demo'))).status).toBe(400);
    s.safetyEvents = [{id:'persisted-concern',level:'professional',at:'now',reasons:['existing concern']}];
    await repo.saveState(`${identity.sid}-demo`, s);
    // With generation disabled, a blocked script must fall through to honest unavailability.
    expect((await aura.POST(request('aura',body,'demo'))).status).toBe(503);
  });
  it('accepts the demonstrated arrangement only after its dialogue and preserves history', async () => {
    const { nextDemoTurn, scriptedDemoReply, demoProposal } = await import('@/domain/demoConversation');
    const s = buildDemo(10), previous = s.plans.find(p => p.topicId === 'rested-waking')!;
    while (nextDemoTurn(s)) {
      const text = nextDemoTurn(s)!.turn.user;
      s.messages.push({ role:'user', text });
      const reply = scriptedDemoReply(s,text)!;
      s.messages.push({ role:'guide', text:reply.text, meta:{via:reply.via,cited:reply.cited}, draft:reply.draft });
    }
    await repo.saveState(`${identity.sid}-demo`,s);
    const draft = demoProposal('caffeine');
    const data = {stepId:draft.stepId, topicId:draft.topicId, observationId:previous.observationId, step:draft.step, start:'2026-10-17', review:'2026-10-23'};
    expect((await cmd('accept',0,{...data,step:'Drink more coffee'})).status).toBe(400);
    const response = await cmd('accept',0,data);
    expect(response.status).toBe(200);
    const saved = (await response.json()).state;
    expect(saved.plans.find((p:{id:string}) => p.id === previous.id).status).toBe('replaced');
    expect(saved.plans.at(-1)).toMatchObject({title:draft.title,step:draft.step,lineageId:previous.lineageId,version:2});
    expect(saved.feedbacks).toEqual(s.feedbacks);
    expect(saved.messages.at(-1)).toMatchObject({role:'guide',meta:{via:'preset'},action:{type:'feedback',planId:saved.plans.at(-1).id}});
    expect(saved.messages.at(-1).text).toContain('7 days');
    expect(saved.messages.at(-1).text).toContain('Wake up rested');
    const fresh = buildDemo(10); await repo.saveState(`${identity.sid}-demo`,fresh);
    expect((await cmd('accept',0,{...data,observationId:fresh.observations.find(o=>o.topicId==='rested-waking')!.id})).status).toBe(400);
  });
});
