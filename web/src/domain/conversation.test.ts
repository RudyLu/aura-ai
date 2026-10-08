import { describe, expect, it } from 'vitest';
import { AuraReplySchema, ReviewSchema } from './conversation';
import { stepDraft } from './uiSteps';
const reply={text:'What would you like to record?',via:'gemini',action:null,draft:null,logOffer:null};
describe('dynamic Agent presentation contracts (isolated fixtures)',()=>{
 it('accepts existing backend reply without optional v2 fields',()=>{expect(AuraReplySchema.parse(reply).text).toBe(reply.text);});
 it.each(['clarification','confirmation','suggestions'])('supports %s options with explicit IDs and topic',kind=>{
  const r=AuraReplySchema.parse({...reply,interaction:{kind,question:'Which topic?',options:[{id:'stress',label:'Perceived stress',text:'I mean perceived stress',topicId:'stress'}]}});
  expect(r.interaction?.options[0].id).toBe('stress');
 });
 it('renders backend insight text without deriving numbers or merging scales',()=>{
  const r=AuraReplySchema.parse({...reply,insights:[{id:'i',title:'Saved context',text:'Backend-authored insight',limitations:['Coverage is limited'],evidenceIds:['c1']}]});expect(r.insights?.[0].evidenceIds).toEqual(['c1']);
 });
 it('rejects malformed replies, actions and unsupported topics',()=>{
  expect(AuraReplySchema.safeParse({...reply,text:''}).success).toBe(false);
  expect(AuraReplySchema.safeParse({...reply,action:{type:'execute-code'}}).success).toBe(false);
  expect(AuraReplySchema.safeParse({...reply,interaction:{kind:'clarification',options:[{id:'x',label:'Balance',text:'Balance',topicId:'balance'}]}}).success).toBe(false);
 });
 const review={id:'r',contract:'aura.review.v1',requestId:'q',planId:'p',planVersion:1,inputRevision:3,mode:'personal',feedbackIds:['f'],summary:'Review fixture',recommendation:'continue',reasons:['Saved feedback'],proposal:null,safety:{pause:false},via:'gemini',at:'2026-10-08T00:00:00Z'};
 it('requires a complete adjustment before showing confirmation',()=>{
  expect(ReviewSchema.safeParse({...review,recommendation:'adjust'}).success).toBe(false);
  expect(ReviewSchema.safeParse({...review,recommendation:'adjust',proposal:stepDraft('chat:busy-week','stress')}).success).toBe(true);
 });
 it('preserves backend safety pause for restricted UI choices',()=>{
  expect(ReviewSchema.parse({...review,safety:{pause:true,message:'Pause this step'}}).safety.pause).toBe(true);
 });
});
