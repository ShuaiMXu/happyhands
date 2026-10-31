import {createControl} from '../../packages/ui/controls.js';
import {t} from './i18n.js';
// Original parts stay subordinate to their parent page; they are not new routes/states.
function disclosure(title) {
  const root=createControl('details');root.className='page-surface-disclosure';
  const summary=createControl('summary');summary.textContent=t(title);
  const body=createControl('div');body.className='page-surface-links';
  root.append(summary,body);return {root,body};
}
function originalLink(base,path,text) {
  const link=createControl('a');link.textContent=text;link.href=`${base}/${path}`;
  link.target='_blank';link.rel='noopener noreferrer';return link;
}
export function appendPageSurfaceLinks(container,base,phase,entry) {
  if(!['before','after'].includes(phase))return;
  if(entry?.interactionParts?.length){
    const {root,body}=disclosure('交互分段原图');
    for(const [index,part] of entry.interactionParts.entries()){
      if(!new RegExp(`^${phase}/part-[a-f0-9]{24}-[0-9]+\\.png$`).test(part.screenshot||''))continue;
      body.append(originalLink(base,part.screenshot,`${index+1}${part.state ? ` / ${part.state}` : ''}`));
    }
    if(body.childElementCount)container.append(root);
  }
  if(!entry?.pageSurfaces)return;
  const {root,body}=disclosure('内部滚动区域原图');
  for(const surface of entry.pageSurfaces.surfaces||[]){
    const row=createControl('div');row.className='page-surface-row';
    const label=createControl('code');label.textContent=surface.selector;row.append(label);
    const links=createControl('div');links.className='page-surface-tiles';
    for(const [index,tile] of (surface.tiles||[]).entries()){
      if(!new RegExp(`^${phase}/surface-[a-f0-9]{24}-[0-9]+\\.png$`).test(tile.screenshot||''))continue;
      links.append(originalLink(base,tile.screenshot,`${index+1} (${tile.left}, ${tile.top})`));
    }
    if(links.childElementCount){row.append(links);body.append(row);}
  }
  if(body.childElementCount)container.append(root);
}
