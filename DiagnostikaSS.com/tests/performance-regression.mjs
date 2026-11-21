import {readdirSync,readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';

const baseline=resolve(process.argv[2]),candidate=process.cwd();
const tests=readdirSync(baseline+'/tests').filter(n=>n.endsWith('.test.cjs'));
const staticChecks=['workspace-i18n-audit.mjs','storage-deletion-sync-audit.mjs','roles-access-11a-audit.mjs'].filter(n=>existsSync(baseline+'/tests/'+n));
function run(root,file,args=[]){
 const p=spawnSync(process.execPath,[...args,'tests/'+file],{cwd:root,encoding:'utf8',timeout:90000,maxBuffer:4*1024*1024});
 return {ok:p.status===0,status:p.status,output:(p.stdout||'')+(p.stderr||''),error:p.error?.message||null};
}
const rows=[];
for(const file of [...tests,...staticChecks]){
 const args=file.endsWith('.cjs')?['--test']:[];
 const orig=run(baseline,file,args),next=run(candidate,file,args);
 // Parse individual test cases, not only the file exit status. Do not allow
 // new failures in files already failing before this release.
 const failures=x=>[...x.output.matchAll(/^not ok \d+ - (.+)$/gm)].map(m=>m[1]);
 const a=failures(orig),b=failures(next);
 const added=b.filter(n=>!a.includes(n));
 const regression=(orig.ok&&!next.ok)||added.length>0||!!next.error;
 rows.push({file,baseline:orig.ok,candidate:next.ok,baselineFailures:a,candidateFailures:b,regression,baselineOutput:orig.output,candidateOutput:next.output});
 console.log('REGRESSION',JSON.stringify({file,baseline:orig.ok,candidate:next.ok,added,regression}));
}
mkdirSync('performance-results',{recursive:true});
writeFileSync('performance-results/regression.json',JSON.stringify(rows,null,2));
const existing=rows.filter(r=>!r.baseline),regressions=rows.filter(r=>r.regression);
console.log('REGRESSION_SUMMARY',JSON.stringify({total:rows.length,baselineFailed:existing.map(r=>r.file),regressions:regressions.map(r=>r.file)}));
if(regressions.length)process.exitCode=1;
