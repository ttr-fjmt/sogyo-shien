const http=require('http'),fs=require('fs'),path=require('path');
const root=process.argv[2];
const T={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.json':'application/json','.xml':'application/xml','.svg':'image/svg+xml','.png':'image/png','.txt':'text/plain; charset=utf-8'};
http.createServer((q,s)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p.endsWith('/'))p+='index.html';const f=path.join(root,p);
fs.readFile(f,(e,d)=>{if(e){s.writeHead(404);return s.end('nf');}s.writeHead(200,{'Content-Type':T[path.extname(f)]||'application/octet-stream'});s.end(d);});}).listen(4321,()=>console.log('ok'));
