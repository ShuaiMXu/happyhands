import {createControl} from '../../../packages/ui/controls.js';
import {t} from '../i18n.js';

// The original file remains a link fallback; normal activation stays in context.
export function screenshotPreviewLink(image, onOpen=()=>{}){
  const link=createControl('a');link.href=image.src;link.setAttribute('aria-label',t('放大截图'));
  link.append(image);
  link.addEventListener('click',event=>{
    if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    event.preventDefault();link.focus({preventScroll:true});
    const dialog=createControl('dialog');dialog.className='review-image-lightbox';dialog.dataset.dismissOutside='true';dialog.setAttribute('aria-label',t('截图预览'));
    const header=createControl('header'),title=createControl('h2'),close=createControl('button');title.textContent=t('截图预览');close.type='button';close.textContent=t('关闭');close.onclick=()=>dialog.close();header.append(title,close);
    const original=createControl('img');original.src=image.src;original.alt=image.alt;dialog.append(header,original);dialog.showModal();onOpen(dialog);
  });
  return link;
}
