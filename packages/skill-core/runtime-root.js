import {readFile} from 'node:fs/promises';
// npm deliberately removes pnpm-lock.yaml from packed dependencies. Preserve
// those exact provenance bytes under a transport-neutral name in the CLI bundle.
export async function engineLockfile(){
 try{return await readFile(new URL('../../engine-lock.yaml',import.meta.url),'utf8');}
 catch(error){if(error.code!=='ENOENT')throw error;return readFile(new URL('../../pnpm-lock.yaml',import.meta.url),'utf8');}
}
