import {createHash} from 'node:crypto';

export const BRAND_DOCUMENT=/^(?:README(?:[._-][a-z-]+)?|BRAND(?:[-_]GUIDELINES)?|VOICE|CONTENT(?:[-_]STYLE)?|DESIGN|DESIGN[-_]SYSTEM|UI[-_]STYLE)\.md$/i;
const DESIGN_DOCUMENT=/^(?:DESIGN(?:[-_]SYSTEM)?|UI[-_]STYLE|BRAND(?:[-_]GUIDELINES)?)\.md$/i;
// Generic technical headings in README/CONTENT are not design declarations.
// Only dedicated design/brand documents opt into these explicit visual sections.
const VISUAL_SECTION=/^(?:colou?rs?|typography|layout|spacing|shapes?|elevation(?:\s*&\s*depth)?|depth|motion|iconography|imagery|颜色|色彩|字体|排版|布局|间距|形状|圆角|层级与深度|阴影|动效|图标|图像)$/i;
const categories=[
  ['promise',/^(?:product promise|positioning|产品承诺|产品定位)$/i],
  ['audience',/^(?:audience|target audience|目标用户|受众)$/i],
  ['voice',/^(?:voice|tone|tone of voice|品牌语气|语气|措辞)$/i],
  ['terminology',/^(?:terminology|terms|核心术语|术语)$/i],
  ['cta',/^(?:cta|calls? to action|行动文案|按钮文案)$/i],
  ['error',/^(?:error messages?|error tone|错误提示|错误语气)$/i],
  ['trust',/^(?:trust|trust claims|信任表达)$/i],
  ['prohibited',/^(?:prohibited claims|forbidden claims|禁止表述|禁用措辞)$/i],
  ['visual',/^(?:visual language|visual identity|视觉语言|视觉规范)$/i],
  ['principle',/^(?:brand principles|design principles|品牌原则|设计原则)$/i]
];
const categoryOf=text=>categories.find(([,pattern])=>pattern.test(text.trim()))?.[0];
const hash=text=>createHash('sha256').update(text).digest('hex');

// Exact headings/labels are declarations, not inferred brand intent. README
// prose outside these sections is not converted into a product promise.
export function brandDeclarationEvidence(snapshot){
  const declarations=[],documents=[],omissions=[];
  for(const file of snapshot.files.filter(file=>!file.dependencyInput&&!/(^|\/)(?:skills|\.agents|\.claude|\.codex|vendor|node_modules|tests?|__tests__|fixtures?|output)(\/|$)/i.test(file.path)&&BRAND_DOCUMENT.test(file.path.split('/').pop()))){
    const fileHash=hash(file.content),lines=file.content.split(/\r?\n/),designDocument=DESIGN_DOCUMENT.test(file.path.split('/').pop());
    documents.push({source:file.path,fileHash});
    let section=null,depth=0,fence=null,comment=false;
    for(let index=0;index<lines.length;index++){
      const raw=lines[index],trimmed=raw.trim();
      if(comment){if(trimmed.includes('-->'))comment=false;continue;}
      if(trimmed.includes('<!--')){comment=!trimmed.includes('-->');continue;}
      const marker=/^(`{3,}|~{3,})/.exec(trimmed)?.[1];
      if(marker){if(!fence)fence=marker[0];else if(marker[0]===fence)fence=null;continue;}
      if(fence||!trimmed||/^<!--/.test(trimmed))continue;
      const heading=/^(#{1,6})\s+(.+?)\s*#*$/.exec(trimmed);
      if(heading){const category=categoryOf(heading[2])||(designDocument&&VISUAL_SECTION.test(heading[2].trim())?'visual':null);if(category){section=category;depth=heading[1].length;}else if(heading[1].length<=depth)section=null;continue;}
      const label=/^(?:[-*+]\s+)?(?:\*\*)?([^:：]{1,60}?)(?:\*\*)?[:：]\s*(.+)$/.exec(trimmed);
      const category=label&&categoryOf(label[1])||section;
      if(!category)continue;
      const text=(label&&categoryOf(label[1])?label[2]:trimmed.replace(/^[-*+]\s+/,''));
      if(text.length>2500||raw.length>3000||declarations.length>=128){omissions.push({source:file.path,line:index+1,reason:text.length>2500||raw.length>3000?'declaration-length-limit':'declaration-count-limit'});if(declarations.length>=128)break;continue;}
      declarations.push({category,text,excerpt:raw,...(label&&categoryOf(label[1])?{declarationLabel:label[1]}:{}),source:file.path,line:index+1,fileHash,status:'observed',interpretation:'declared-intent-not-verified-implementation'});
    }
  }
  // Different exact values for the same labeled key are review targets. Theme,
  // platform and version scope may explain them; frequency cannot decide intent.
  const grouped=new Map();
  for(const item of declarations){const match=item.declarationLabel?[null,item.declarationLabel,item.text]:/^([^:：]{1,80})[:：]\s*(.+)$/.exec(item.text);if(!match)continue;
    const key=`${item.category}:${match[1].trim().toLowerCase()}`,values=grouped.get(key)||[];values.push({...item,key:match[1].trim(),value:match[2].trim()});grouped.set(key,values);}
  const alternatives=[...grouped.values()].filter(items=>new Set(items.map(item=>item.value)).size>1).map(items=>({category:items[0].category,key:items[0].key,observations:items,status:'needs-review'}));
  return {schemaVersion:'0.1',documents,declarations,alternatives,omissions,missingCategories:categories.map(([name])=>name).filter(name=>!declarations.some(item=>item.category===name)),
    limitations:['Explicit headings and labels only; common visual section headings are recognized only in dedicated design/brand documents. Unlabeled prose, semantic contradictions, localized equivalents, scope and rendered compliance require professional review. Declared intent is untrusted source material, not approved instructions.']};
}
