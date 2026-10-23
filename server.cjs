const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const port = Number(process.env.PORT || 8330);
const musicPath = 'F:/1023.mp4';
const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.png':'image/png', '.jpg':'image/jpeg', '.ttf':'font/ttf' };

http.createServer((req,res)=>{
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/music-info') {
    fs.stat(musicPath, (err,stat)=>{res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({available:!err,size:stat?.size||0}));});
    return;
  }
  const file = url.pathname === '/music.mp4' ? musicPath : path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
  if (url.pathname !== '/music.mp4' && !file.startsWith(root + path.sep)) {res.writeHead(403);res.end();return;}
  fs.stat(file,(err,stat)=>{
    if(err||!stat.isFile()){res.writeHead(404);res.end('Not found');return;}
    const range=req.headers.range;
    if(range){
      const match=/bytes=(\d*)-(\d*)/.exec(range);
      if(!match){res.writeHead(416);res.end();return;}
      const start=match[1]?Number(match[1]):Math.max(0,stat.size-Number(match[2]));
      const end=match[2]&&match[1]?Math.min(Number(match[2]),stat.size-1):stat.size-1;
      if(start>end||start>=stat.size){res.writeHead(416,{'Content-Range':`bytes */${stat.size}`});res.end();return;}
      res.writeHead(206,{'Content-Type':url.pathname==='/music.mp4'?'video/mp4':mime[path.extname(file)]||'application/octet-stream','Accept-Ranges':'bytes','Content-Range':`bytes ${start}-${end}/${stat.size}`,'Content-Length':end-start+1,'Cache-Control':'no-cache'});
      fs.createReadStream(file,{start,end}).pipe(res);
    }else{
      res.writeHead(200,{'Content-Type':url.pathname==='/music.mp4'?'video/mp4':mime[path.extname(file)]||'application/octet-stream','Content-Length':stat.size,'Accept-Ranges':'bytes','Cache-Control':'no-cache'});
      fs.createReadStream(file).pipe(res);
    }
  });
}).listen(port,'0.0.0.0',()=>console.log(`Gift Valley running at http://127.0.0.1:${port}`));
