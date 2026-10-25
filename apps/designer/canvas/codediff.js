import { t } from '../i18n.js';
// Code Diff view: renders diff.patch hunk by hunk (B2/D4).
// Old runs without a patch degrade to the changed-file list, labelled honestly.

export async function renderCodeDiff(container, run, base) {
  container.replaceChildren();

  const execution = run.manifest.execution;
  const shell = document.getElementById('fullscreen-shell');
  shell?.classList.toggle('codediff-empty-mode', !execution);
  const tree = document.getElementById('pd-sidebar-tree');
  const inspector = document.getElementById('pd-inspector-body');
  if (tree) { tree.replaceChildren(); const label = document.createElement('p'); label.className = 'studio-tree-heading'; label.textContent = t('本次执行的文件'); tree.append(label); }
  if (inspector) { inspector.replaceChildren(); const title = document.createElement('h2'); title.textContent = t('代码是原因线索'); const note = document.createElement('p'); note.textContent = t('这里展示执行时保存的补丁。代码变化不能代替截图复核，也不证明用户任务已经改善。'); inspector.append(title, note); }

  if (!execution) {
    const empty = document.createElement('article');
    empty.className = 'pd-codediff-empty-state';

    const eyebrow = document.createElement('span');
    eyebrow.className = 'pd-codediff-empty-eyebrow';
    eyebrow.textContent = t('代码证据');

    const title = document.createElement('h2');
    title.textContent = t('还没有代码改动');

    const copy = document.createElement('p');
    copy.textContent = t('这条审阅记录目前只有界面证据。确认要解决的问题并完成一次隔离修改后，真实补丁才会出现在这里。');

    const progress = document.createElement('ol');
    progress.className = 'pd-codediff-empty-progress';
    for (const [label, state, status] of [
      [t('界面证据'), t(run.manifest.captures.before||run.manifest.captures.after?'已采集':'尚无运行证据'), run.manifest.captures.before||run.manifest.captures.after?'complete':'pending'],
      [t('问题范围'), t(run.manifest.confirmation?.verdict==='supported'||run.manifest.foundationApproval?'已记录':'待确认'), run.manifest.confirmation?.verdict==='supported'||run.manifest.foundationApproval?'complete':'current'],
      [t('源码执行'), t('未开始'), 'pending']
    ]) {
      const item = document.createElement('li');
      item.dataset.status = status;
      const itemLabel = document.createElement('span');
      itemLabel.textContent = label;
      const itemState = document.createElement('strong');
      itemState.textContent = state;
      item.append(itemLabel, itemState);
      progress.append(item);
    }

    const actions = document.createElement('div');
    actions.className = 'pd-codediff-empty-actions';
    const report = document.createElement('button');
    report.type = 'button';
    report.className = 'wb-button';
    report.textContent = t('返回审阅报告');
    report.onclick = () => document.querySelector('[data-studio-view="list"]')?.click();
    const refresh = document.createElement('button');
    refresh.type = 'button';
    refresh.className = 'wb-button';
    refresh.textContent = t('重新读取执行记录');
    refresh.onclick = () => document.getElementById('studio-refresh')?.click();
    actions.append(report, refresh);

    empty.append(eyebrow, title, copy, progress, actions);
    container.append(empty);
    return;
  }

  // try to fetch the patch
  let patchText = null;
  try {
    const response = await fetch(`${base}/diff.patch`, { cache: 'no-store' });
    if (response.ok && !response.headers.get('content-type')?.includes('text/html')) patchText = await response.text();
  } catch { /* no patch file */ }

  const header = document.createElement('div');
  header.className = 'pd-codediff-header';

  if (patchText && patchText.trim()) {
    header.textContent = t`${execution.changedFiles?.length ?? parsePatch(patchText).length} 个文件 · ${execution.branch || t("本次执行")}`;
    container.appendChild(header);
    for (const file of parsePatch(patchText)) {
      const section = renderFile(file);
      container.appendChild(section);
      if (tree) { const button = document.createElement('button'); button.type = 'button'; button.className = 'studio-evidence-link'; button.textContent = file.name; button.onclick = () => { section.open = true; section.scrollIntoView({ block: 'start' }); }; tree.append(button); }

    }
  } else {
    header.textContent = patchText !== null ? t('补丁已记录，内容为空') : execution.patch ? t('已声明的补丁读取失败') : t('此旧记录未保存补丁全文');
    const notice = document.createElement('p');
    notice.className = 'pd-codediff-notice';
    notice.textContent = patchText !== null ? t('空补丁不证明执行没有新增文件；请结合执行记录核查。') : t('以下仅展示执行记录中的文件清单，不代表完整代码证据。');
    container.append(header, notice);

    const list = document.createElement('ul');
    list.className = 'pd-codediff-files';
    for (const f of execution.changedFiles || []) {
      const li = document.createElement('li');
      li.className = 'font-mono';
      li.textContent = f;
      list.appendChild(li);
      if (tree) { const label = document.createElement('p'); label.className = 'studio-tree-heading'; label.textContent = f; tree.append(label); }
    }
    container.appendChild(list);
    if (execution.diffStat) {
      const pre = document.createElement('pre');
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
  const el = document.createElement('details');
  el.className = 'pd-codediff-file';
  el.open = true;
  const summary = document.createElement('summary');
  summary.className = 'font-mono';
  summary.textContent = file.name;
  el.appendChild(summary);

  for (const hunk of file.hunks) {
    const hunkEl = document.createElement('div');
    hunkEl.className = 'pd-codediff-hunk';
    const header = document.createElement('div');
    header.className = 'font-mono pd-codediff-hunk-header';
    header.textContent = hunk.header;
    hunkEl.appendChild(header);
    for (const line of hunk.lines) {
      const lineEl = document.createElement('div');
      lineEl.className = 'pd-codediff-line ' + (line.startsWith('+') ? 'add' : line.startsWith('-') ? 'del' : '');
      lineEl.textContent = line || ' ';
      hunkEl.appendChild(lineEl);
    }
    el.appendChild(hunkEl);
  }
  return el;
}
