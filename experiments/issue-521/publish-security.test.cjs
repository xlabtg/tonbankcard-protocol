const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const npm=fs.readFileSync('.github/workflows/npm-publish-sdk.yml','utf8');
const python=fs.readFileSync('.github/workflows/pypi-publish.yml','utf8');
function scriptAfter(name,source=npm){
 const section=source.split('- name: '+name)[1].split(/\n      - /)[0];
 return section.split('run: |\n')[1].split('\n').filter(l=>l.startsWith('          ')).map(l=>l.slice(10)).join('\n');
}
const script=scriptAfter('Verify protected ref and release inputs');
function run(env){return spawnSync('bash',['-c',script],{env:{...process.env,...env},encoding:'utf8'});}
test('manual publish requires main and literal validated inputs',()=>{
 const version=require('../../sdk/package.json').version;
 assert.equal(run({GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_REF:'refs/heads/feature',INPUT_VERSION:version,INPUT_DIST_TAG:'latest'}).status,1);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'publish-security-'));
 const marker=path.join(dir,'injected');
 try{
  for(const input of ['x"; touch '+marker+'; "','$(touch '+marker+')','`touch '+marker+'`']){
   assert.equal(run({GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_REF:'refs/heads/main',INPUT_VERSION:version,INPUT_DIST_TAG:input}).status,1);
   assert.equal(fs.existsSync(marker),false);
  }
  assert.equal(run({GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_REF:'refs/heads/main',INPUT_VERSION:version,INPUT_DIST_TAG:'latest'}).status,0);
 }finally{fs.rmSync(dir,{recursive:true});}
});
test('unrelated release is a successful skip with empty output',()=>{
 const file=path.join(os.tmpdir(),'publish-skip-'+process.pid);
 try{
  const result=spawnSync('bash',['-c',scriptAfter('Parse release tag and verify package version')],{env:{...process.env,GITHUB_REF_NAME:'unrelated-v1',GITHUB_OUTPUT:file}});
  assert.equal(result.status,0);assert.equal(fs.readFileSync(file,'utf8'),'version=\n');
 }finally{fs.rmSync(file,{force:true});}
});
test('both workflows keep untrusted inputs outside run and test Python before build',()=>{
 for(const source of [npm,python]){
  const lines=source.split('\n');let inRun=false;
  for(const line of lines){if(/^        run:/.test(line))inRun=true;else if(/^      - |^        [a-z_]+:/.test(line))inRun=false;
   if(inRun)assert.doesNotMatch(line,/\$\{\{\s*inputs\./);
  }
 }
 assert.match(python,/pytest/);assert.match(python,/GITHUB_REF_NAME.*sdk-python-v/);
});
test('publication fails closed without server-side independent approval',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'publish-gate-'));
 try{
  fs.writeFileSync(path.join(dir,'gh'),'#!/bin/sh\nprintf "%s" "$MOCK_ENVIRONMENT"\n',{mode:0o700});
  const check=value=>spawnSync('bash',['scripts/tooling/check-publish-environment.sh'],{env:{...process.env,PATH:dir+path.delimiter+process.env.PATH,RUNNER_TEMP:dir,GITHUB_REPOSITORY:'owner/repo',PUBLISH_ENVIRONMENT:'pypi',MOCK_ENVIRONMENT:JSON.stringify(value)}}).status;
  assert.notEqual(check({protection_rules:[]}),0);
  assert.notEqual(check({protection_rules:[{type:'required_reviewers',reviewers:[{id:1}],prevent_self_review:false}]}),0);
  assert.equal(check({protection_rules:[{type:'required_reviewers',reviewers:[{id:1}],prevent_self_review:true}]}),0);
  for(const source of [npm,python])assert.match(source,/check-publish-environment\.sh/);
 }finally{fs.rmSync(dir,{recursive:true});}
});
