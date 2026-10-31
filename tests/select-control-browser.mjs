import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
const server = await createServer({
  configFile: false,
  cacheDir: '.tmp/select-vite-cache',
  optimizeDeps: {
    noDiscovery: true,
    include: [
      'react',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
      'react-dom/client',
      '@radix-ui/react-select',
    ],
  },
  server: { host: '127.0.0.1', port: 0 },
  plugins: [
    {
      name: 'select-fixture',
      configureServer(s) {
        s.middlewares.use('/select-fixture', (_req, res) => {
          res.setHeader('Content-Type', 'text/html');
          res.end(
            `<!doctype html><link rel="stylesheet" href="/apps/designer/site-theme.css"><link rel="stylesheet" href="/apps/designer/select-control.css"><body class="workspace-page" style="margin:0;padding-left:var(--workbench-navigation-width)"><main style="width:260px;margin:24px"><label>Device<select id="device"><option value="desktop">Desktop</option><option disabled>Unavailable</option><option value="phone">Phone</option><option value="long">A very long option label with enough words to wrap inside a narrow screen without losing any information</option></select></label><button id="outside" style="margin-top:400px">Outside</button></main><script type="module">import {installSelectControls} from '/apps/designer/select-control.js';installSelectControls(document);window.changed=0;document.querySelector('#device').onchange=()=>window.changed++;</script>`,
          );
        });
      },
    },
  ],
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(
    `http://127.0.0.1:${server.httpServer.address().port}/select-fixture`,
  );
  const combo = page.locator('button[data-slot=select-trigger]');
  await combo.waitFor();
  assert.equal(await page.locator('#device').isVisible(), false);
  const open = async () => {
    await combo.click();
    await page.getByRole('listbox').waitFor();
    await page.waitForFunction(
      () => document.activeElement?.getAttribute('role') === 'option',
    );
  };
  await open();
  assert.equal(await page.getByRole('option').count(), 4);
  await page.keyboard.press('End');
  await page.waitForFunction(() =>
    document.activeElement?.textContent.startsWith('A very long'),
  );
  await page.keyboard.press('ArrowUp');
  await page.waitForFunction(
    () => document.activeElement?.textContent === 'Phone',
  );
  await page.keyboard.press('Enter');
  await page.waitForFunction(
    () => document.querySelector('#device').value === 'phone',
  );
  assert.equal(await page.evaluate(() => window.changed), 1);
  await open();
  assert.equal(
    await page
      .getByRole('option', { name: 'Unavailable', exact: true })
      .getAttribute('aria-disabled'),
    'true',
  );
  await page.keyboard.press('Home');
  await page.waitForFunction(
    () => document.activeElement?.textContent === 'Desktop',
  );
  await page.keyboard.press('ArrowDown');
  await page.waitForFunction(
    () => document.activeElement?.textContent === 'Phone',
  );
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('#device').inputValue(), 'phone');
  await open();
  await page.keyboard.press('Escape');
  assert.equal(await combo.getAttribute('aria-expanded'), 'false');
  await open();
  await page.mouse.click(700, 700);
  await page.waitForFunction(() => !document.querySelector('[role=listbox]'));
  await open();
  await page.keyboard.press('Home');
  await page.waitForFunction(
    () => document.activeElement?.textContent === 'Desktop',
  );
  await page.keyboard.press('Enter');
  await page.waitForFunction(
    () => document.querySelector('#device').value === 'desktop',
  );
  await open();
  await page.keyboard.press('p');
  await page.waitForFunction(
    () => document.activeElement?.textContent === 'Phone',
  );
  await page.keyboard.press('Enter');
  await page.waitForFunction(
    () => document.querySelector('#device').value === 'phone',
  );
  for (const width of [1440, 894, 390])
    for (const theme of ['light', 'dark']) {
      await page.setViewportSize({ width, height: 827 });
      await page.evaluate(
        (value) => (document.documentElement.dataset.hhTheme = value),
        theme,
      );
      const before = await page.locator('main').boundingBox();
      await open();
      const after = await page.locator('main').boundingBox();
      assert.ok(
        Math.abs(before.x - after.x) < 1,
        `opening menu must preserve navigation offset at ${width}: ${before.x} -> ${after.x}`,
      );
      await page.getByRole('option', { name: /A very long/ }).click();
      await open();
      const box = await page.getByRole('listbox').boundingBox();
      assert.ok(box.x >= 0 && box.x + box.width <= width);
      assert.equal(
        await page
          .getByRole('listbox')
          .evaluate((e) => e.scrollWidth <= e.clientWidth),
        true,
      );
      await page.keyboard.press('Escape');
    }
  await page.evaluate(() => {
    const s = document.querySelector('#device');
    s.value = 'desktop';
    s.disabled = true;
  });
  await page.waitForFunction(
    () => document.querySelector('button[data-slot=select-trigger]').disabled,
  );
  assert.equal(await combo.isDisabled(), true);
  await page.evaluate(() => {
    const s = document.querySelector('#device');
    s.disabled = false;
    s.innerHTML = '<option value="new">New option</option>';
  });
  await page.waitForFunction(() =>
    document
      .querySelector('button[data-slot=select-trigger]')
      .textContent.includes('New option'),
  );
  await open();
  await page.evaluate(() => document.querySelector('main').remove());
  await page.waitForFunction(() => !document.querySelector('[role=listbox]'));
  await page.evaluate(() => {
    const form = document.createElement('form');
    form.innerHTML =
      '<label>Required<select required><option value="">Choose</option><option value="ok">Ready</option></select></label><button>Submit</button>';
    document.body.append(form);
    form.onsubmit = (e) => e.preventDefault();
  });
  const required = page.locator('button[data-slot=select-trigger]');
  await required.waitFor();
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  await page.waitForFunction(
    () =>
      document
        .querySelector('button[data-slot=select-trigger]')
        .getAttribute('aria-invalid') === 'true',
  );
  await required.click();
  await page.getByRole('option', { name: 'Ready', exact: true }).click();
  await page.waitForFunction(
    () =>
      !document
        .querySelector('button[data-slot=select-trigger]')
        .hasAttribute('aria-invalid'),
  );
  assert.deepEqual(errors, []);
  console.log(
    'PASS: shadcn/Radix Select, keyboard/typeahead/disabled/validation/dynamic controls, 3 widths x 2 themes; no navigation shift on open.',
  );
} finally {
  await browser?.close();
  await server.close();
}
