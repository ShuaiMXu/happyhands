import {createHash} from 'node:crypto';

// Only the generated prompt's staging directory is presentation-only. Preserve
// every byte of structured task/source/context data, including literal paths.
export function reviewBatchKey(input,sessionDirectory){
 if(typeof input?.prompt!=='string'||typeof sessionDirectory!=='string'||!sessionDirectory)throw Error('A generated prompt and session directory are required.');
 const value={...input,version:'review-batch-key@3',prompt:input.prompt.split(sessionDirectory).join('[review-session]')};
 return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
