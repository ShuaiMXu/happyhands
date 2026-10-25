import {createHash} from 'node:crypto';
const hash=value=>createHash('sha256').update(value).digest('hex');
export async function verificationPreviewFingerprint(url) {
  if(!url)throw Error('Specialist capture requires a preview URL.');
  const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(5000)});
  if(!response.ok)throw Error('Specialist verification preview is unavailable.');
  const bytes=Buffer.from(await response.arrayBuffer());
  if(bytes.length>5*1024*1024)throw Error('Verification preview response exceeds 5 MB.');
  return hash(JSON.stringify({url:response.url,status:response.status,body:hash(bytes)}));
}
