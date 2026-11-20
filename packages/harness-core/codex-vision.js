import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';

// Query configuration and input modalities only. These requests never start a
// model turn or pass images to Codex.
export async function inspectCodexVision(command, cwd, requestedModel) {
  const child = spawn(command, ['app-server'], {cwd, stdio:['pipe','pipe','ignore'], windowsHide:true});
  const closed = new Promise(resolve => child.once('close', resolve));
  const output = createInterface({input:child.stdout, crlfDelay:Infinity});
  const lines = output[Symbol.asyncIterator]();
  let id = 0;
  const stop = () => {output.close(); child.kill('SIGKILL');};
  const timer = setTimeout(stop, 8000);
  child.on('error', stop);
  child.stdin.on('error', stop);
  const send = row => child.stdin.write(JSON.stringify(row) + '\n');
  async function request(method, params) {
    const expected = ++id;
    send({id:expected, method, params});
    for (;;) {
      const line = await lines.next();
      if (line.done) throw Error('Codex metadata request ended without a response.');
      let message;
      try {message=JSON.parse(line.value);} catch {continue;}
      if (message?.id !== expected) continue;
      if (message.error || message.result === undefined) throw Error('Codex metadata request failed.');
      return message.result;
    }
  }
  let model = requestedModel || null;
  let provider = null;
  try {
    await request('initialize', {clientInfo:{name:'happyhands',version:'1'}});
    send({method:'initialized',params:{}});
    const {config} = await request('config/read',{cwd,includeLayers:false});
    model ||= config.model || null;
    provider = config.model_provider || 'openai';
    // An endpoint alias can reuse a model name from the default catalog.
    // Custom providers require the operator's exact-model declaration.
    if (provider !== 'openai' || process.env.OPENAI_BASE_URL) return {model,provider,modalities:null};
    let cursor;
    for (let page = 0; page < 4; page++) {
      const result = await request('model/list',{limit:100,includeHidden:true,...(cursor?{cursor}:{})});
      const selected = result.data.find(entry => model ? entry.model===model||entry.id===model : entry.isDefault);
      if (selected) return {model:selected.model,provider,modalities:selected.inputModalities||null};
      cursor = result.nextCursor;
      if (!cursor) break;
    }
  } catch {
    // Broken, old or inaccessible CLI metadata leaves the capability unknown.
  } finally {
    clearTimeout(timer);
    stop();
    await closed;
  }
  return {model,provider,modalities:null};
}
