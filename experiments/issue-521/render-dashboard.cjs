// Reproducible before/after DOM render of the real dashboard. Run from repo root.
const fs=require('node:fs');
const {execFileSync}=require('node:child_process');
const {JSDOM}=require('../../dashboard/node_modules/jsdom');
const esbuild=require('../../sdk/node_modules/esbuild');
const root=process.cwd();
const originalRevision='0352aed';
fs.mkdirSync('docs/screenshots/issue-521',{recursive:true});
(async()=>{
 for(const state of ['before','after']){
 const source=state==='before'?execFileSync('git',['show',originalRevision+':dashboard/src/components/DashboardApp.ts'],{encoding:'utf8'}):fs.readFileSync('dashboard/src/components/DashboardApp.ts','utf8');
 const utilities=state==='before'?execFileSync('git',['show',originalRevision+':dashboard/src/utils.ts'],{encoding:'utf8'}):null;
 const output=await esbuild.build({stdin:{contents:source,resolveDir:root+'/dashboard/src/components',sourcefile:'DashboardApp.ts',loader:'ts'},platform:'node',bundle:true,format:'cjs',write:false,plugins:[{name:'baseline',setup(b){b.onLoad({filter:/dashboard\/src\/utils\.ts$/},()=>utilities?{contents:utilities,loader:'ts'}:undefined);}}]});
 fs.writeFileSync('/tmp/dashboard-'+state+'.cjs',output.outputFiles[0].text);
 const dom=new JSDOM('<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:24px;font-family:Arial"><div id="dashboard"></div></body></html>');
 global.document=dom.window.document;global.window=dom.window;
 const {TonbankcardDashboard}=require('/tmp/dashboard-'+state+'.cjs');
 const app=new TonbankcardDashboard({containerId:'dashboard',merchantNft:'0:'+'22'.repeat(32),paymentHubAddress:'0:'+'33'.repeat(32),payerNft:'0:'+'11'.repeat(32),network:'testnet'});
 app.mount();app.navigateTo('generate');
 const amount=document.querySelector('#tonbankcard-amount-input');
 if(!amount)throw new Error('Invoice view missing');
 amount.value='10000000000';amount.setAttribute('value',amount.value);
 Array.from(document.querySelectorAll('button')).filter(b=>b.textContent==='Generate Link').at(-1).click();
 if(!document.body.textContent.includes('ton://transfer/'))throw new Error('Generated payment link missing');
 fs.writeFileSync('docs/screenshots/issue-521/dashboard-'+state+'.html',dom.serialize());
 }
})();
