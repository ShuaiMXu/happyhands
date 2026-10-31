import {createControl} from '../../../packages/ui/controls.js';
import { t } from '../i18n.js';
// Code Diff view: renders diff.patch hunk by hunk (B2/D4).
// Old runs without a patch degrade to the changed-file list, labelled honestly.

export async function renderCodeDiff(container, run, base) {
  container.replaceChildren();

  const execution = run.manifest.execution;
  const shell = document.getElementById('fullscreen-shell');
  shell?.classList.toggle('codediff-empty-mode', !execution);
  if (!execution) {
    const empty = createControl('section');
    empty.className = 'pd-codediff-empty-state';
    const title = createControl('h2');
    title.textContent = t('还没有代码改动');
    const copy = createControl('p');
    copy.textContent = t('完成修复后，这里会显示实际保存的代码补丁。');
    const report = createControl('button');
    report.type = 'button';
    report.className = 'wb-button';
    report.textContent = t('返回页面审阅');
    report.onclick = () => document.querySelector('.workbench-view-nav [data-studio-view="canvas"]')?.click();
    empty.append(title, copy, report);
    container.append(empty);
    return;
  }

  // try to fetch the patch
  let patchText = null;
  try {
    const response = await fetch(`${base}/diff.patch`, { cache: 'no-store' });
    if (response.ok && !response.headers.get('content-type')?.includes('text/html')) patchText = await response.text();
  } catch { /* no patch file */ }

  const header = createControl('div');
  header.className = 'pd-codediff-header';

  if (patchText && patchText.trim()) {
    const files=parsePatch(patchText);
    header.className='pd-codediff-files-bar';
    const field=createControl('label');field.textContent=t('文件');
    const select=createControl('select');select.setAttribute('aria-label',t('查看改动文件'));
    const all=createControl('option');all.value='all';all.textContent=t('全部文件');select.append(all);
    files.forEach((file,index)=>{const option=createControl('option');option.value=String(index);option.textContent=file.name;select.append(option);});
    field.append(select);const count=createControl('span');count.className='review-muted';count.textContent=t`${files.length} 个补丁文件`;header.append(field,count);
    const documentView=createControl('div');documentView.className='pd-codediff-document';
    const render=()=>{documentView.replaceChildren(...(select.value==='all'?files:[files[Number(select.value)]]).map(renderFile));};select.onchange=render;render();container.append(header,documentView);
  } else {
    header.textContent = patchText !== null ? t('补丁已记录，内容为空') : execution.patch ? t('已声明的补丁读取失败') : t('此旧记录未保存补丁全文');
    const notice = createControl('p');
    notice.className = 'pd-codediff-notice';
    notice.textContent = patchText !== null ? t('空补丁不证明执行没有新增文件；请结合执行记录核查。') : t('以下仅展示执行记录中的文件清单，不代表完整代码证据。');
    container.append(header, notice);

    const list = createControl('ul');
    list.className = 'pd-codediff-files';
    for (const f of execution.changedFiles || []) {
      const li = createControl('li');
      li.className = 'font-mono';
      li.textContent = f;
      list.appendChild(li);
    }
    container.appendChild(list);
    if (execution.diffStat) {
      const pre = createControl('pre');
      pre.className = 'font-mono pd-codediff-stat';
      pre.textContent = execution.diffStat;
      container.appendChild(pre);
    }
  }
}

export function parsePatch(patch) {
  const files = [];
  let current = null;
  for (const line of patch.split('\n')) {
    if (line.startsWith('diff --git')) {
      current = { hunks: [], name: line.replace(/diff --git a\/(\S+) b\/\S+/, '$1') };
      files.push(current);
    } else if (line.startsWith('@@') && current) {
      current.hunks.push({ header: line, lines: [] });
    } else if (current && current.hunks.length) {
      current.hunks[current.hunks.length - 1].lines.push(line);
    }
  }
  return files;
}

function renderFile(file) {
  const el = createControl('section');
  el.className = 'pd-codediff-file';
  const summary = createControl('h2');
  summary.className = 'pd-codediff-file-name';
  summary.textContent = file.name;
  el.appendChild(summary);

  for (const hunk of file.hunks) {
    const hunkEl = createControl('div');
    hunkEl.className = 'pd-codediff-hunk';
    const header = createControl('div');
    header.className = 'font-mono pd-codediff-hunk-header';
    header.textContent = hunk.header;
    hunkEl.appendChild(header);
    for (const line of hunk.lines) {
      const lineEl = createControl('div');
      lineEl.className = 'pd-codediff-line ' + (line.startsWith('+') ? 'add' : line.startsWith('-') ? 'del' : '');
      lineEl.textContent = line || ' ';
      hunkEl.appendChild(lineEl);
    }
    el.appendChild(hunkEl);
  }
  return el;
}
