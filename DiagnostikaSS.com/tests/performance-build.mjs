import {readFile,writeFile,mkdir,copyFile,stat} from 'node:fs/promises';
import {resolve,dirname,basename,relative,sep} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {minify} from 'terser';
import {transform} from 'esbuild';

const root=process.cwd();
if(basename(root)!=='DiagnostikaSS.com')throw Error('Run from DiagnostikaSS.com');
const target=resolve(root,process.argv[2]||'.performance-build');
if(target!==resolve(root,'.performance-build'))throw Error('Output must be .performance-build (separate from source)');
try{await stat(target);throw Error('Output already exists; choose a clean checkout or manually remove only .performance-build');}catch(e){if(e.code!=='ENOENT')throw e;}
const tracked=execFileSync('git',['ls-files','-z','.'],{cwd:root,maxBuffer:4*1024*1024}).toString().split('\0').filter(Boolean);
const assets=tracked.filter(p=>/^(?:[A-Za-z0-9_.-]+\.(?:js|css)|(?:core|modules)\/[A-Za-z0-9_./-]+\.(?:js|css)|index\.html|favicon\.svg|zabvenye-orb\.webp|weather-(?:data|locations)\.json|\.nojekyll)$/.test(p));
const sizes=[], scripts=[], cssSource=new Map();
const hash=v=>createHash('sha256').update(v).digest('hex').slice(0,16);
const write=async(p,bytes)=>{const out=resolve(target,p);if(!out.startsWith(target+sep))throw Error('Unsafe asset: '+p);await mkdir(dirname(out),{recursive:true});await writeFile(out,bytes);};
async function minifyCss(source,path){
  const v=await transform(source,{loader:'css',sourcefile:path,minifyWhitespace:true,minifySyntax:false,minifyIdentifiers:false,legalComments:'inline'});
  if(v.warnings.length)throw Error('CSS warnings in '+path+': '+v.warnings.map(x=>x.text).join('; '));
  return v.code;
}
for(const p of assets){
 const original=await readFile(resolve(root,p));let code=original;
 if(p.endsWith('.js')){
    scripts.push(original.toString());
    // These are classic scripts sharing global bindings. Do not concatenate,
    // mangle, compress expressions, or assume an isolated ES module.
    const result=await minify(original.toString(),{module:false,toplevel:false,compress:false,mangle:false,format:{comments:/@license|@preserve|^!/,semicolons:true,ascii_only:false}});
    if(typeof result.code!=='string')throw Error('Missing JS output: '+p);
    code=Buffer.from(result.code);
 }else if(p.endsWith('.css')){
    cssSource.set(p,original.toString());
    code=Buffer.from(await minifyCss(original.toString(),p));
 }
 await write(p,code);
 if(/\.(?:js|css)$/.test(p))sizes.push({file:p,original:original.length,minified:code.length,gzipOriginal:gzipSync(original).length,gzipMinified:gzipSync(code).length});
}
const scriptSource=scripts.join('\n');
let html=(await readFile(resolve(root,'index.html'))).toString();
const bundles=[];
const eligible=tag=>{
 const m=tag.match(/^\s*<link rel="stylesheet" href="([^"]+)"\s*>\s*$/);
 if(!m)return null;
 const name=m[1].split('?')[0];
 const source=cssSource.get(name);
 // Preserve stylesheet markers, runtime dependencies, relative URLs, and
 // any special CSS rules whose semantics could depend on the file boundary.
 if(!source||name.includes('/')||/@(?:import|charset|namespace)\b|url\s*\(/i.test(source)||scriptSource.includes(name)||scriptSource.includes(basename(name)))return null;
 return name;
};
const lines=html.split('\n');const output=[];
for(let i=0;i<lines.length;){
 const group=[];let j=i;
 while(j<lines.length){const name=eligible(lines[j]);if(!name)break;group.push(name);j++;}
 if(group.length>=2){
    const contents=(await Promise.all(group.map(p=>readFile(resolve(target,p),'utf8')))).join('\n');
    const file='startup-styles.'+hash(contents)+'.css';
    await write(file,contents);
    output.push('  <link rel="stylesheet" href="'+file+'">');
    bundles.push({file,sources:group,bytes:Buffer.byteLength(contents),requestsSaved:group.length-1});
    i=j;
 }else{output.push(lines[i]);i++;}
}
html=output.join('\n');
await write('index.html',html);
const totals=Object.fromEntries(['original','minified','gzipOriginal','gzipMinified'].map(k=>[k,sizes.reduce((sum,r)=>sum+r[k],0)]));
const report={files:sizes.length,totals,bundles,requestsSaved:bundles.reduce((n,b)=>n+b.requestsSaved,0),sizes};
await write('build-metrics.json',JSON.stringify(report,null,2)+'\n');
console.log('MINIFIED_BUILD',JSON.stringify({files:report.files,totals,bundles,requestsSaved:report.requestsSaved}));
// Benchmark files are only copied by CI into the temporary build; server
// files, tests, databases and account credentials are never part of the build.
