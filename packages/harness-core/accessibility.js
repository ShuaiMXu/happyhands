import axe from 'axe-core';
export async function captureAccessibility(page, timeoutMs = 15000) {
  let hostTimer;
  try {
    const result = await Promise.race([(async () => {
    await page.evaluate(axe.source);
    return page.evaluate(async timeout => {
      let timer;
      try { return await Promise.race([
        window.axe.run(document, {resultTypes:['violations','incomplete']}),
        new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('axe timed out')),timeout);})
      ]); } finally {clearTimeout(timer);}
    }, timeoutMs);
    })(),new Promise((_,reject)=>{hostTimer=setTimeout(()=>reject(new Error('axe host timeout')),timeoutMs);})]);
    const summarize = items => items.map(rule=>({id:rule.id,impact:rule.impact,description:rule.description,help:rule.help,helpUrl:rule.helpUrl,tags:rule.tags,nodeCount:rule.nodes.length,nodes:rule.nodes.slice(0,30).map(node=>({target:node.target,failureSummary:node.failureSummary}))}));
    return {status:'complete',engine:'axe-core',version:result.testEngine.version,violations:summarize(result.violations),incomplete:summarize(result.incomplete),nodeLimit:30};
  } catch(error) { return {status:'failed',engine:'axe-core',version:axe.version,error:error.message,violations:[],incomplete:[]}; }
  finally {clearTimeout(hostTimer);}
}
