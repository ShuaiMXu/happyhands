// Portal interactions: agent adapter tabs (from the real registry in
// packages/harness-core/agents.js), token sliders, copy-to-clipboard.

// The exact argv each registered adapter declares. Kept in sync with
// packages/harness-core/agents.js — if an adapter changes, so does this page.
const AGENTS = {
  codex: {
    label: 'codex exec',
    argv: 'codex exec -C <worktree> -s workspace-write --json -o agent-last-message.md -',
    note: 'Prompt 走 stdin；仓库文件一律当作数据，不当作指令。',
    copy: 'codex exec -C <worktree> -s workspace-write --json -o agent-last-message.md -'
  },
  'claude-code': {
    label: 'claude -p',
    argv: 'claude -p --output-format stream-json --verbose --permission-mode acceptEdits \\\n  --bare --disallowed-tools "Bash(git push:*) Bash(git remote:*) Bash(git config:*) WebFetch"',
    note: '--bare 跳过 CLAUDE.md 自动加载：被审仓库无法通过记忆文件给 agent 下指令。',
    copy: 'claude -p --output-format stream-json --verbose --permission-mode acceptEdits --bare --disallowed-tools "Bash(git push:*) Bash(git remote:*) Bash(git config:*) WebFetch"'
  }
};

const argvPre = document.getElementById('agent-argv');
const noteP = document.getElementById('agent-note');
const labelSpan = document.getElementById('agent-label');
const copyButton = document.getElementById('agent-copy');
const agentPanel = document.getElementById('agent-panel');

function selectAgent(id) {
  const agent = AGENTS[id];
  labelSpan.textContent = agent.label;
  argvPre.textContent = agent.argv;
  noteP.textContent = agent.note;
  copyButton.dataset.copy = agent.copy;
  agentPanel.setAttribute('aria-labelledby', `tab-${id}`);
}

const tabs = [...document.querySelectorAll('.tab')];
for (const tab of tabs) {
  tab.addEventListener('click', () => {
    for (const other of tabs) {
      other.setAttribute('aria-selected', String(other === tab));
      other.tabIndex = other === tab ? 0 : -1;
    }
    selectAgent(tab.dataset.agent);
  });
  tab.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const current = tabs.indexOf(tab);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    tabs[next].click();
    tabs[next].focus();
  });
}
selectAgent('codex');

// Token sliders — each one drives one CSS custom property, exactly the way a
// design token is meant to work: change the declaration, everything redraws.
const root = document.documentElement;
for (const slider of document.querySelectorAll('[data-token]')) {
  slider.addEventListener('input', () => {
    const value = slider.value;
    if (slider.dataset.token === 'radius') {
      root.style.setProperty('--card-radius', `${value}px`);
      document.getElementById('radius-val').textContent = `${value}px`;
    } else if (slider.dataset.token === 'hue') {
      root.style.setProperty('--accent-h', value);
      document.getElementById('hue-val').textContent = `${value}°`;
    } else if (slider.dataset.token === 'surface') {
      root.style.setProperty('--surface-l', value);
      document.getElementById('surface-val').textContent = `${value}%`;
    }
  });
}

let toastTimer = null;
function showToast(message) {
  const toast = document.getElementById('toast');
  document.getElementById('toast-text').textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 1800);
}

for (const button of document.querySelectorAll('[data-copy]')) {
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(button.dataset.copy);
      showToast('已复制到剪贴板');
    } catch {
      showToast('复制失败：浏览器拒绝了剪贴板访问');
    }
  });
}
