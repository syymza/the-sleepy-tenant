const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const files=['index.html','style.css','app.js','audio.js'];
fs.rmSync('_site',{recursive:true,force:true});fs.mkdirSync('_site');
const hashes={};
for(const name of files){const bytes=fs.readFileSync(name);fs.writeFileSync(path.join('_site',name),bytes);hashes[name]=crypto.createHash('sha256').update(bytes).digest('hex');}
let commit=process.env.GITHUB_SHA;
if(!commit){try{commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}catch{commit='local';}}
fs.writeFileSync('_site/.nojekyll','');
fs.writeFileSync('_site/version.json',JSON.stringify({commit,files:hashes},null,2)+'\n');
console.log('Built static site for '+commit);
