// V2 confirmation UI catalog. Existing Agent menu and grounding are unchanged.
import { stepDraft as legacyDraft } from './steps';
import { topic, type TopicId } from './topics';
import type { StepDraft } from './state';
export function stepDraft(id: string, topicId: TopicId, why?: string): StepDraft | null {
 if (id === `observe:${topicId}`) return {stepId:id,topicId,kind:'observe',title:`Keep noticing ${topic(topicId).name.toLowerCase()}`,desc:'No routine change. Check in when it fits.',duration:'20 seconds',days:'When it fits',step:`Answer your ${topic(topicId).checkinName} when it fits, or skip.`};
 return legacyDraft(id,topicId,why);
}
