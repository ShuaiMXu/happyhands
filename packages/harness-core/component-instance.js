// Opt-in evidence for a declared instance, not inferred coverage of descendants.
export async function captureComponentInstance(page, region, {fullPage=false}={}) {
  if (!region?.instance) return null;
  const locator = page.locator(region.selector);
  if (await locator.count() !== 1) throw Error('Component instance must match exactly one element.');
  const observed = await locator.evaluate((element, declaration) => {
    const rect = element.getBoundingClientRect(), style = getComputedStyle(element);
    const rootMarkup = element.cloneNode(false).outerHTML;
    if (!rootMarkup.includes(declaration.anchor)) throw Error('Component source anchor must belong to the instance root, not a descendant.');
    const documentHeight=Math.max(document.documentElement.scrollHeight,document.body?.scrollHeight||0,innerHeight);
    const verticalBounds=declaration.fullPage ? rect.top+scrollY>=0 && rect.bottom+scrollY<=documentHeight
      : rect.top>=0 && rect.bottom<=innerHeight;
    if (rect.width <= 0 || rect.height <= 0 || rect.left < 0 || !verticalBounds || rect.right > innerWidth
      || style.visibility !== 'visible' || style.display === 'none' || Number(style.opacity) === 0) throw Error('Component instance must fit visibly inside the captured viewport.');
    for(let ancestor=element.parentElement;ancestor;ancestor=ancestor.parentElement){
      const parentStyle=getComputedStyle(ancestor), parentRect=ancestor.getBoundingClientRect();
      if(Number(parentStyle.opacity)===0)throw Error('Component instance has an invisible ancestor.');
      if(['hidden','clip','auto','scroll'].includes(parentStyle.overflowX)
        && (rect.left<parentRect.left+ancestor.clientLeft || rect.right>parentRect.left+ancestor.clientLeft+ancestor.clientWidth))throw Error('Component instance is horizontally clipped by an ancestor.');
      if(!(declaration.fullPage&&ancestor===document.scrollingElement)&&['hidden','clip','auto','scroll'].includes(parentStyle.overflowY)
        && (rect.top<parentRect.top+ancestor.clientTop || rect.bottom>parentRect.top+ancestor.clientTop+ancestor.clientHeight))throw Error('Component instance is vertically clipped by an ancestor.');
    }
    const visibleTop=Math.max(0,rect.top),visibleBottom=Math.min(innerHeight,rect.bottom);
    if(visibleBottom<=visibleTop)throw Error('Component instance needs a visible portion for its boundary check.');
    const hit = document.elementFromPoint(rect.left + rect.width / 2, (visibleTop+visibleBottom)/2);
    if (!hit || !element.contains(hit)) throw Error('Component instance is occluded at its center.');
    const variants = declaration.variants.map(variant => {
      if (element.getAttribute(variant.attribute) !== variant.value) throw Error('Component variant does not match: ' + variant.name);
      return { ...variant, observed: element.getAttribute(variant.attribute) };
    });
    // Selector aliases must not count one root as several uses. Only ordinary
    // document roots get a structural identity; shadow/detached roots stay unknown.
    const ancestry=[];
    let node=element;
    while(node && ancestry.length<64){
      let index=1;
      for(let sibling=node.previousElementSibling;sibling;sibling=sibling.previousElementSibling)if(sibling.localName===node.localName)index++;
      ancestry.unshift(`${node.localName}:nth-of-type(${index})`);
      if(node===document.documentElement)break;
      node=node.parentElement;
    }
    const domPath=node===document.documentElement && ancestry.join('>').length<=4096 ? ancestry.join('>') : null;
    return {
      tag: element.tagName.toLowerCase(), domPath, variants,
      visibility:{image:declaration.fullPage?'full-document':'viewport',hitTest:'visible-portion-only',
        documentTop:Math.round((rect.top+scrollY)*100)/100,documentBottom:Math.round((rect.bottom+scrollY)*100)/100},
      bounds: Object.fromEntries(['x','y','width','height'].map(key=>[key,Math.round(rect[key]*100)/100])),
      states: { focused: element === document.activeElement, hovered: element.matches(':hover'),
        disabled: element.matches(':disabled'), checked: element.matches(':checked'),
        expanded: element.getAttribute('aria-expanded'), selected: element.getAttribute('aria-selected'),
        pressed: element.getAttribute('aria-pressed'), invalid: element.getAttribute('aria-invalid'), state: element.getAttribute('data-state') },
      styles: Object.fromEntries(['fontFamily','fontSize','fontWeight','lineHeight','color','backgroundColor','borderRadius','padding','gap'].map(key=>[key,style[key]]))
    };
  }, { anchor: region.source.anchor, variants: region.instance.variants, fullPage });
  return { id: region.instance.id, component: region.source.component, selector: region.selector, ...observed };
}

export function assertStableComponentInstance(before, after) {
  if (JSON.stringify(before) !== JSON.stringify(after)) throw Error('Component instance changed across the screenshot boundary.');
  return after ? { ...after, verification: 'declared-root-instance-stable-at-screenshot-boundary' } : null;
}
