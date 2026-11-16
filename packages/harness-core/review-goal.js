export const REVIEW_GOAL_VERSION='design-goal@1';
export const reviewGoalSchema={type:'object',additionalProperties:false,required:['version','kind','requestQuote','criteria','preserve','allowedChanges'],properties:{version:{const:REVIEW_GOAL_VERSION},kind:{enum:['repair','improvement','mixed']},requestQuote:{type:'string',minLength:1,maxLength:4000},criteria:{type:'array',minItems:1,maxItems:20,items:{type:'string',minLength:1,maxLength:2000}},preserve:{type:'array',minItems:1,maxItems:30,items:{type:'string',minLength:1,maxLength:2000}},allowedChanges:{type:'array',minItems:1,maxItems:30,items:{type:'string',minLength:1,maxLength:2000}}}};
for(const field of Object.values(reviewGoalSchema.properties)){if(field.type==='string')field.pattern='\\S';if(field.items?.type==='string')field.items.pattern='\\S';}
export function assertReviewGoal(review,goal,{regional=false}={}){
 if(!goal||regional)return;
 if(goal.version!==REVIEW_GOAL_VERSION||!['repair','improvement','mixed'].includes(goal.kind))throw Error('Unknown design goal contract.');
 if(review.verdict==='pass'&&['improvement','mixed'].includes(goal.kind)&&review.designComparison?.verdict!=='improved')throw Error('The design improvement goal requires an explicit improved comparison; a repair or preservation pass cannot complete it.');
}
