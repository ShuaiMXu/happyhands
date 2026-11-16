import {gzipSync,gunzipSync} from 'node:zlib';
import {readVerificationFile,verificationHash as hash} from './verification.js';
const encode=value=>JSON.stringify(value,null,2)+'\n';
const STORED_LIMIT=2*1024*1024, EXPANDED_LIMIT=16*1024*1024;
const ARCHIVE_PATH='continuation-parent.json.gz';

// Keep small/legacy snapshots byte-compatible. Large snapshots are lossless,
// bounded archives; both representations remain hash-bound to the child ledger.
export function packContinuationSnapshot(snapshot){
  const expanded=Buffer.from(encode(snapshot));
  if(expanded.length>EXPANDED_LIMIT)throw Error('Predecessor snapshot exceeds sixteen MiB expanded limit. Retain the original review and narrow the next task.');
  if(expanded.length<=STORED_LIMIT)return {raw:expanded,archive:null};
  const archive=gzipSync(expanded);
  if(archive.length>STORED_LIMIT)throw Error('Compressed predecessor exceeds two MiB stored limit. Retain the original review and narrow the next task.');
  const raw=Buffer.from(encode({schemaVersion:'0.2',role:snapshot.role,encoding:'gzip',payload:{path:ARCHIVE_PATH,sha256:hash(archive),bytes:archive.length,expandedSha256:hash(expanded),expandedBytes:expanded.length}}));
  return {raw,archive};
}

export async function readContinuationSnapshot(directory,raw){
  const value=JSON.parse(raw);
  if(value.schemaVersion==='0.1')return value;
  const p=value.payload;
  if(value.schemaVersion!=='0.2'||value.role!=='historical-predecessor-not-current-evidence'||value.encoding!=='gzip'||p?.path!==ARCHIVE_PATH||! /^[a-f0-9]{64}$/.test(p.sha256)||! /^[a-f0-9]{64}$/.test(p.expandedSha256)||!Number.isInteger(p.bytes)||p.bytes<1||p.bytes>STORED_LIMIT||!Number.isInteger(p.expandedBytes)||p.expandedBytes<=STORED_LIMIT||p.expandedBytes>EXPANDED_LIMIT)throw Error('Invalid historical predecessor archive.');
  const archive=await readVerificationFile(directory,p.path,STORED_LIMIT);
  if(archive.length!==p.bytes||hash(archive)!==p.sha256)throw Error('Historical predecessor archive changed.');
  const expanded=gunzipSync(archive,{maxOutputLength:EXPANDED_LIMIT});
  if(expanded.length!==p.expandedBytes||hash(expanded)!==p.expandedSha256)throw Error('Historical predecessor expanded content changed.');
  const snapshot=JSON.parse(expanded);
  if(snapshot.schemaVersion!=='0.1')throw Error('Invalid historical predecessor snapshot version.');
  return snapshot;
}
