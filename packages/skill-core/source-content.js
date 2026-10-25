// Decode only the explicit JSON template used by offline HTML bundles. Never
// execute the loader or decompress resource manifests during source discovery.
export function sourceContent(file) {
  if (!/\.html$/i.test(file.path)) return {content:file.content,location:null};
  const match=/<script\b[^>]*\btype\s*=\s*["']__bundler\/template["'][^>]*>([\s\S]*?)<\/script\s*>/i.exec(file.content);
  if(!match){
    const marker=/<script\b[^>]*\btype\s*=\s*["']__bundler\/(?:manifest|ext_resources)["'][^>]*>/i.exec(file.content);
    if(marker)return {content:'',location:{format:'bundler-json-template',containerLine:file.content.slice(0,marker.index).split('\n').length},error:'Offline bundle has no readable JSON template.'};
    return {content:file.content,location:null};
  }
  const line=file.content.slice(0,match.index).split('\n').length;
  try{
    const content=JSON.parse(match[1]);
    if(typeof content!=='string'||Buffer.byteLength(content)>8*1024*1024)throw Error('Template must be a JSON string within 8 MiB.');
    return {content,location:{format:'bundler-json-template',containerLine:line,coordinates:'decoded-template-lines'}};
  }catch(error){return {content:'',location:{format:'bundler-json-template',containerLine:line},error:error.message};}
}

export function embeddedAssetInventory(file) {
  if(!/\.html$/i.test(file.path))return {assets:[],errors:[]};
  const field=type=>new RegExp('<script\\b[^>]*\\btype\\s*=\\s*["\\\']__bundler/'+type+'["\\\'][^>]*>([\\s\\S]*?)<\\/script\\s*>','i').exec(file.content)?.[1];
  const manifest=field('manifest');if(!manifest)return {assets:[],errors:[]};
  try{
    const resources=JSON.parse(manifest),references=JSON.parse(field('ext_resources')||'[]');
    if(!resources||Array.isArray(resources)||typeof resources!=='object'||!Array.isArray(references)||Object.keys(resources).length>2000)throw Error('Unsupported resource manifest.');
    const names=new Map(references.filter(ref=>typeof ref?.uuid==='string'&&typeof ref?.id==='string').map(ref=>[ref.uuid,ref.id]));
    return {assets:Object.entries(resources).filter(([,asset])=>typeof asset?.mime==='string'&&/^(image|font)\//.test(asset.mime)).map(([id,asset])=>({name:names.get(id)||id,path:'embedded:'+id,mime:asset.mime,format:asset.mime.split('/')[1],compressed:Boolean(asset.compressed),encodedBytes:typeof asset.data==='string'?Buffer.byteLength(asset.data):null,sources:[file.path],status:'observed',licenseStatus:'unknown',usageStatus:'manifest-reference-only'})),errors:[]};
  }catch(error){return {assets:[],errors:[{file:file.path,message:error.message}]};}
}
