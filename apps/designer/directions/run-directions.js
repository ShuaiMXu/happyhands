import { t } from '../i18n.js';
import { findingSummary } from '../finding-summary.js';
import { mountReviewAction } from '../review-action.js';
import './workspace.css';

export function renderRunDirections(container, run, options = {}) {
  let selected = options.previous?.findingId || null, expanded = false, controller;
  container.className = 'workspace-directions';
  const node = (tag, text, className) => {
    const element = document.createElement(tag);
    if (text) element.textContent = text;
    if (className) element.className = className;
    return element;
  };
  function render() {
    controller?.destroy();
    container.replaceChildren();
    container.append(node('h1', t('设计方向')), node('p', t('建议来自本轮诊断。先核对依据和修改范围，确认后生成计划，再到画布查看和批注。')));
    if (!run) {
      const connect = node('button', t('连接项目并开始审阅'), 'wb-button');
      connect.onclick = options.onConnect;
      container.append(connect);
      return;
    }
    const evidence = node('button', t('查看页面与原始证据'), 'wb-button');
    evidence.onclick = () => options.onNavigate('canvas');
    container.append(evidence);
    const action = node('section'), grid = node('div', '', 'direction-grid');
    container.append(action, grid);
    const findings = run.diagnosis?.findings || [];
    if (!findings.length) grid.append(node('p', t('本轮没有可用诊断建议。请先完成诊断或补充检查范围。')));
    const more = node('details'), moreGrid = node('div', '', 'direction-grid');
    const selectedIndex = findings.findIndex(finding => finding.id === selected);
    more.open = expanded || selectedIndex >= 3;
    more.append(node('summary', t('其他诊断建议')), moreGrid);
    for (const [index, finding] of findings.entries()) {
      const summary = findingSummary(finding), card = node('article', '', 'direction-card');
      card.dataset.selected = String(selected === finding.id);
      card.append(node('small', t('待核对的诊断候选')), node('h3', summary.title), node('p', summary.proposal || t('现有证据尚不足以给出具体修改建议，请先核对原始诊断。')));
      const details = node('details');
      details.append(node('summary', t('查看原始诊断')), node('pre', JSON.stringify(finding, null, 2)));
      const choose = node('button', t('选择此方向'), 'wb-button');
      choose.type = 'button';
      choose.setAttribute('aria-pressed', String(selected === finding.id));
      choose.onclick = () => {
        selected = finding.id;
        expanded = more.open;
        render();
        container.querySelector('.direction-card button[aria-pressed="true"]')?.focus({ preventScroll: true });
      };
      card.append(details, choose);
      (index < 3 ? grid : moreGrid).append(card);
    }
    if (findings.length > 3) container.append(more);
    controller = mountReviewAction(action, run, { getFindingId: () => selected, onChanged: options.onChanged, onFoundation: options.onFoundation });
  }
  render();
  return { snapshot: () => ({ findingId: selected }), destroy: () => controller?.destroy() };
}
