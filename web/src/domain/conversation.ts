// Optional v2 presentation fields. No prompts, inference or canned Agent responses.
import { z } from 'zod';
import { TOPIC_IDS } from './topics';
const topicId = z.enum(TOPIC_IDS as [string, ...string[]]);
export const StepDraftSchema = z.object({ topicId, kind:z.enum(['step','observe']), title:z.string().min(1).max(500),desc:z.string().max(2000),duration:z.string().max(200),days:z.string().max(200),step:z.string().min(1).max(2000),stepId:z.string().optional(),lineageId:z.string().optional(),fromFactor:z.string().nullable().optional(),why:z.string().optional() });
export const InteractionSchema = z.object({kind:z.enum(['clarification','confirmation','suggestions']),question:z.string().max(500).optional(),options:z.array(z.object({id:z.string().min(1).max(100),label:z.string().min(1).max(200),text:z.string().min(1).max(2000),topicId:topicId.optional()})).min(1).max(8)});
export const InsightSchema = z.object({id:z.string().max(100),title:z.string().max(200),text:z.string().max(2000),limitations:z.array(z.string().max(500)).max(10).optional(),evidenceIds:z.array(z.string()).max(100).optional()});
export const AuraReplySchema = z.object({
 text:z.string().min(1).max(4000), via:z.enum(['gemini','verified-summary','preset','safety']),
 action:z.discriminatedUnion('type',[z.object({type:z.literal('feedback'),planId:z.string()}),z.object({type:z.literal('review'),planId:z.string()}),z.object({type:z.literal('context')}),z.object({type:z.literal('data')}),z.object({type:z.literal('caffeine')}),z.object({type:z.literal('checkin'),topicId})]).nullable().optional(),
 draft:StepDraftSchema.nullable().optional(),logOffer:z.object({name:z.string().max(500),note:z.string().max(2000),topicId}).nullable().optional(),
 interaction:InteractionSchema.optional(),insights:z.array(InsightSchema).max(10).optional(),cited:z.array(z.string()).optional(),safety:z.object({level:z.string()}).passthrough().optional(),stopPlanId:z.string().nullable().optional()
});
export const ReviewSchema = z.object({id:z.string().min(1),contract:z.literal('aura.review.v1'),requestId:z.string(),planId:z.string(),planVersion:z.number().int(),inputRevision:z.number().int(),mode:z.enum(['personal','demo']),feedbackIds:z.array(z.string()),summary:z.string().min(1).max(2000),recommendation:z.enum(['adjust','continue','observe','stop']),reasons:z.array(z.string().min(1).max(500)).min(1).max(4),proposal:StepDraftSchema.nullable(),safety:z.object({pause:z.boolean(),message:z.string().optional()}),via:z.enum(['gemini','verified-summary','safety']),at:z.string(),model:z.string().optional(),responseId:z.string().optional(),cited:z.array(z.string()).optional()}).refine(r=>r.recommendation!=='adjust'||r.proposal!==null,'Adjustment needs a proposal');
