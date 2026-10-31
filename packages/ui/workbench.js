import {installNativeControls} from './controls.js';
import {replaceStaticDialogs} from './dialog.js';
import {installCheckboxControls} from './checkbox.js';
import {installSelectControls} from '../../apps/designer/select-control.js';
import '../../apps/designer/select-control.css';
import './controls.css';

export function installWorkbenchControls(root=document){
  if(root.documentElement.dataset.hhComponents==='ready')return;
  replaceStaticDialogs(root);
  installNativeControls(root);
  installSelectControls(root);
  installCheckboxControls(root);
  root.documentElement.dataset.hhComponents='ready';
}

// Static legacy entry points use the same component boundary as the workbench.
if(typeof document!=='undefined')installWorkbenchControls(document);
