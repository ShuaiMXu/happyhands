import {parseArgs} from 'node:util';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createRun,loadRun} from '../../packages/harness-core/store.js';
import {inspectRepository} from '../../packages/harness-core/onboard.js';
import {captureBrowserPlan} from '../../packages/harness-core/browser.js';
import {captureWithDesignSystem} from '../../packages/harness-core/design-system.js';
import {extractFoundationInventory} from '../../packages/skill-core/foundation-inventory.js';
import {designSystemContext} from '../../packages/skill-core/design-system.js';
import {assertCapturePlan} from '../../packages/harness-core/capture-state.js';

const {values}=parseArgs({options:{repo:{type:'string'},url:{type:'string'},out:{type:'string'},interactive:{type:'boolean',default:false},'plan-only':{type:'boolean',default:false}}});
if(!values.repo||!values.url||!values.out)throw Error('Provide --repo, --url and --out for the real reviewed checkout and its preview.');
const repo=resolve(values.repo),out=resolve(values.out),url=values.url;
const identity=await inspectRepository(repo);
await mkdir(out,{recursive:true});
const regions=new Map();
const rootClasses=new Map();
for(const [name,anchor,folder='ui'] of [['BrandMark','brand-mark'],['GitHubIcon','github-icon'],['ScreenshotFigure','data-shot'],['SectionHeading','class="section-heading"'],['CapabilityGroup','class="capability-group"'],['CommandStep','class="command-step"'],
  ['Header','class="site-header"',''],['Hero','id="hero"',''],['FeatureHighlights','id="features"',''],['ScreenshotShowcase','id="screenshots"',''],['FeatureGrid','id="capabilities"',''],['Architecture','id="architecture"',''],['QuickStart','id="quickstart"',''],['TechStack','id="technology"',''],['Footer','class="site-footer"','']]){
  const file=`src/components/${folder?folder+'/':''}${name}.astro`,lines=(await readFile(join(repo,file),'utf8')).split(/\r?\n/),line=lines.findIndex(text=>text.includes(anchor))+1;
  if(!line)throw Error(`Source anchor not found: ${name}`);
  const className=/\bclass="([^"]+)"/.exec(lines[line-1])?.[1];
  if(className)rootClasses.set(name,className);
  regions.set(name,{file,line,anchor,component:name});
}
const states=[];
const documentComponents=new Set(['ScreenshotFigure','Hero','FeatureHighlights','ScreenshotShowcase','FeatureGrid','Architecture','QuickStart','TechStack','Footer']);
function add(id,component,selector,variants,actions=[],configurations){
  states.push({id,start:{url},actions,...(documentComponents.has(component)?{captureMode:'full-page'}:{}),region:{selector,source:regions.get(component),instance:{id,variants}},...(configurations?{configurations}:{})});
}
const scroll=selector=>({type:'scroll-to',selector,offset:100});
const classes=value=>[{name:'appearance',attribute:'class',value}];
add('brand-header','BrandMark','.header-brand .brand-mark',classes('brand-mark compact'));
add('brand-hero','BrandMark','.hero-intro .brand-mark',classes('brand-mark hero'),[scroll('.hero-intro .brand-mark')]);
add('brand-footer','BrandMark','footer .brand-mark',classes('brand-mark compact'),[scroll('footer .brand-mark')]);
add('github-hero','GitHubIcon','.hero-intro .github-icon',classes('github-icon regular'),[scroll('.hero-intro .github-icon')]);
add('github-desktop','GitHubIcon','.desktop-nav .github-icon',classes('github-icon small'),[],['desktop']);
add('github-menu','GitHubIcon','#mobile-menu .github-icon',classes('github-icon small'),[
  {type:'click-selector',selector:'#menu-toggle'},
  {type:'assert-state',selector:'#menu-toggle',attribute:'aria-expanded',value:'true'}
],['mobile']);
const shots={web:['chat-tool-tracking','chat-markdown','chat-image-gen'],mobile:['mobile-login','mobile-groups','mobile-monitor','mobile-settings'],feishu:['feishu-chat','feishu-card-reply']};
for(const [channel,ids] of Object.entries(shots))for(const id of ids){
  const selector=`figure[data-shot="${id}"]`;
  add(`shot-${id}`,'ScreenshotFigure',selector,[{name:'content-id',attribute:'data-shot',value:id}],[
    {type:'click-selector',selector:`#tab-${channel}`},scroll(selector),
    {type:'assert-state',selector:`#tab-${channel}`,attribute:'aria-selected',value:'true'}
  ]);
}
for(const section of ['features','screenshots','capabilities','architecture','quickstart','technology']){
  const selector=`#${section} .section-heading`;
  add(`heading-${section}`,'SectionHeading',selector,classes('section-heading'),[scroll(selector)]);
}
for(const index of [1,2,3]){
  const selector=`#capabilities .capability-group:nth-child(${index})`;
  add(`capability-${index}`,'CapabilityGroup',selector,classes('capability-group'),[scroll(selector)]);
}
for(const id of ['clone','directory','start']){
  const selector=`#quickstart [data-command-step="${id}"]`;
  add(`command-${id}`,'CommandStep',selector,[{name:'step-id',attribute:'data-command-step',value:id}],[scroll(selector)]);
}
add('root-header','Header','.site-header',classes(rootClasses.get('Header')));
for(const [component,id] of [['Hero','hero'],['FeatureHighlights','features'],['ScreenshotShowcase','screenshots'],['FeatureGrid','capabilities'],['Architecture','architecture'],['QuickStart','quickstart'],['TechStack','technology']]){
  const selector=`#${id}`;
  if(!rootClasses.get(component))throw Error(`Static root class missing: ${component}`);
  add(`root-${id}`,component,selector,classes(rootClasses.get(component)),[scroll(selector)]);
}
add('root-footer','Footer','footer.site-footer',classes('site-footer'),[scroll('footer.site-footer')]);
add('root-header-menu','Header','.site-header',classes(rootClasses.get('Header')),[
  {type:'click-selector',selector:'#menu-toggle'},
  {type:'assert-state',selector:'#menu-toggle',attribute:'aria-expanded',value:'true'},
  {type:'assert-state',selector:'#mobile-menu',state:'visible'}
],['mobile']);
if(values.interactive){
  const interaction=(id,component,root,target,variants,setup=[],configurations)=>{
    for(const mode of ['focus','hover'])add(`${id}-${mode}`,component,root,variants,[...setup,
      {type:mode==='focus'?'focus-selector':'hover-selector',selector:target},
      {type:'assert-state',selector:target,state:mode==='focus'?'focused':'hovered'}
    ],configurations);
  };
  for(const id of ['clone','directory','start']){
    const selector=`#quickstart [data-command-step="${id}"]`;
    interaction(`command-${id}`,'CommandStep',selector,`${selector} button`,[{name:'step-id',attribute:'data-command-step',value:id}],[scroll(selector)]);
  }
  for(const [channel,ids] of Object.entries(shots)){
    const setup=[{type:'click-selector',selector:`#tab-${channel}`},{type:'assert-state',selector:`#tab-${channel}`,attribute:'aria-selected',value:'true'}];
    interaction(`tabs-${channel}`,'ScreenshotShowcase','#screenshots',`#tab-${channel}`,classes(rootClasses.get('ScreenshotShowcase')),setup);
    const id=ids[0],selector=`figure[data-shot="${id}"]`;
    interaction(`image-${channel}`,'ScreenshotFigure',selector,`${selector} > a`,[{name:'content-id',attribute:'data-shot',value:id}],[...setup,scroll(selector)]);
    if(channel!=='web')add(`root-screenshots-${channel}`,'ScreenshotShowcase','#screenshots',classes(rootClasses.get('ScreenshotShowcase')),setup);
  }
  interaction('header-menu-toggle','Header','.site-header','#menu-toggle',classes(rootClasses.get('Header')),[],['mobile']);
  interaction('header-brand','Header','.site-header','.header-brand',classes(rootClasses.get('Header')),[],['desktop']);
  interaction('hero-github','Hero','#hero','.hero-intro .button:has(.github-icon)',classes(rootClasses.get('Hero')),[scroll('#hero')]);
  for(const [name,path] of [['github',''],['issues','/issues'],['license','/blob/main/LICENSE']])interaction(`footer-${name}`,'Footer','footer.site-footer',`footer a[href="https://github.com/riba2534/happyclaw${path}"]`,classes('site-footer'),[scroll('footer.site-footer')]);
}
const plan=assertCapturePlan({schemaVersion:'0.1',adapter:'web',configurations:[{id:'desktop',viewport:{width:1280,height:900}},{id:'mobile',viewport:{width:390,height:844}}],states});
if(values['plan-only']){await writeFile(join(out,'component-plan.json'),JSON.stringify(plan,null,2));console.log(JSON.stringify({event:'plan-only',commit:identity.commit,targets:states.reduce((sum,state)=>sum+(state.configurations||plan.configurations).length,0)}));process.exit(0);}
const spec=JSON.parse(await readFile(new URL('./experience.json',import.meta.url),'utf8'));
delete spec.designFoundation;spec.evidence=[];spec.findings=[];
spec.project.name='HappyClaw shared component evidence';
spec.project.task='Inspect current root instances of all 15 inventoried Astro components on desktop and mobile, including shared UI instances and the expanded Header. '+(values.interactive?'Also record explicitly asserted focus, hover and channel-selected states; programmatic focus is not keyboard-navigation proof. ':'')+'This is declared current-instance evidence, not complete prop or interaction-state coverage.';
spec.project.source=`https://github.com/ShuaiMXu/happyclaw-site @ ${identity.commit}; local source-bound preview, not a new acceptance.`;
const run=await createRun({spec,url,outputRoot:out});
await writeFile(join(run.directory,'component-plan.json'),JSON.stringify(plan,null,2));
console.log(JSON.stringify({event:'capture-start',run:run.directory,commit:identity.commit,targets:states.reduce((sum,state)=>sum+(state.configurations||plan.configurations).length,0)}));
const capture=await captureWithDesignSystem({directory:run.directory,repo,phase:'before',bindVerificationSource:true,verificationUrl:url,
  capture:()=>captureBrowserPlan({plan,directory:run.directory,phase:'before',sourceRoot:repo})});
await extractFoundationInventory({directory:run.directory,repo});
const latest=await loadRun(run.directory),extraction=(await designSystemContext(latest)).before;
const summary={runId:run.manifest.id,commit:identity.commit,source:capture.designSystemSource,
  total:capture.states.length,successful:capture.states.filter(state=>state.reached).length,
  failures:capture.states.filter(state=>!state.reached).map(state=>({state:state.stateId,device:state.configurationId,error:state.error})),
  components:extraction.components.filter(component=>regions.has(component.name)).map(component=>({name:component.name,source:component.source,coverage:component.renderedCoverage})),
  interactive:values.interactive,judgment:latest.manifest.judgment,limitations:['Real source/preview baseline only; no target edits, after comparison, independent visual approval or human acceptance.','Declared current usages only; missing variants and applicable interaction states remain unreviewed.','Programmatic focus and mouse hover assert those states only, not complete keyboard navigation or assistive-technology behavior. Copy pending/success/error/timeout and recovery need separate specialist action evidence.']};
await writeFile(join(run.directory,'component-summary.json'),JSON.stringify(summary,null,2));
console.log(JSON.stringify({event:'capture-complete',run:run.directory,total:summary.total,successful:summary.successful,failures:summary.failures}));
