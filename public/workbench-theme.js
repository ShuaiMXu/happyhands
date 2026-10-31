// Apply the website preference before styles paint. Evidence lives in images/frames.
(() => {
  const root=document.documentElement,system=matchMedia('(prefers-color-scheme: dark)');
  let saved;try{saved=localStorage.getItem('hh-theme');}catch{/* Session-only preference. */}
  let explicit=saved==='light'||saved==='dark',theme=explicit?saved:system.matches?'dark':'light';
  function labels(){
    const english=root.lang.startsWith('en');
    const label=theme==='dark'?(english?'Light':'浅色'):(english?'Dark':'深色');
    for(const button of document.querySelectorAll('[data-workbench-theme]')){button.setAttribute('aria-label',label);button.title=label;button.setAttribute('aria-pressed',String(theme==='dark'));button.querySelector('span').textContent=label;}
  }
  function apply(){root.dataset.hhTheme=theme;root.style.colorScheme=theme;document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme==='dark'?'#171717':'#ffffff');labels();}
  apply();
  system.addEventListener('change',()=>{if(!explicit){theme=system.matches?'dark':'light';apply();}});
  addEventListener('storage',event=>{if(event.key==='hh-theme'){explicit=event.newValue==='light'||event.newValue==='dark';theme=explicit?event.newValue:system.matches?'dark':'light';apply();}});
  addEventListener('DOMContentLoaded',()=>{
    for(const actions of document.querySelectorAll('.workbench-topbar-actions')){
    const button=document.createElement('button');button.type='button';button.className='workbench-theme-toggle';button.dataset.workbenchTheme='';
    button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></svg><span></span>';
    button.onclick=()=>{explicit=true;theme=theme==='dark'?'light':'dark';try{localStorage.setItem('hh-theme',theme);}catch{/* Keep the session usable. */}apply();};
    actions.insertBefore(button,actions.querySelector('[data-language-toggle]'));}labels();
    new MutationObserver(labels).observe(root,{attributes:true,attributeFilter:['lang']});
  },{once:true});
})();
