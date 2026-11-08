import http from 'node:http';
import {timingSafeEqual,createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import authorities from './authorities.json' with {type:'json'};
const limit=10*1024*1024;
function official(value,source){try{const u=new URL(value),host=new URL(source.home).hostname.replace(/^www\./,'');return u.protocol==='https:'&&!u.username&&!u.password&&(!u.port||u.port==='443')&&(u.hostname===host||u.hostname.endsWith('.'+host))?u:null;}catch{return null;}}
async function bounded(response,max){if(Number(response.headers.get('Content-Length')||0)>max){await response.body?.cancel();throw Error('문서 크기 제한');}const reader=response.body?.getReader();if(!reader)throw Error('파일 본문 없음');let size=0;const chunks=[];for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();throw Error('문서 크기 제한');}chunks.push(Buffer.from(value));}return Buffer.concat(chunks);}
export async function collect(input,fetcher=fetch,{page=false}={}){
 const source=authorities.find(s=>s.id===(input.authority||'seogu'));if(!source)throw Error('지원하지 않는 기관');const url=official(input.url,source);if(!url)throw Error('선택 기관의 공식 HTTPS 주소만 허용됨');
 const post=official(input.postUrl,source)||new URL(source.home),headers={'User-Agent':'EventRadar/2.0','Accept':page?'text/html':'application/pdf,application/octet-stream,*/*','Referer':post.href};
 if(!page){try{const r=await fetcher(post.href,{headers:{'User-Agent':headers['User-Agent']},redirect:'manual',signal:AbortSignal.timeout(10000)});if(r.ok&&post.origin===url.origin){const cookies=(r.headers.getSetCookie?.()||[]).map(c=>c.split(';')[0]).join('; ');if(cookies)headers.Cookie=cookies;}await r.body?.cancel();}catch{}}
 const signal=AbortSignal.timeout(page?20000:45000);let target=url.href;
 for(let i=0;i<4;i++){
  const requestHeaders={...headers};if(new URL(target).origin!==url.origin)delete requestHeaders.Cookie;
  const r=await fetcher(target,{headers:requestHeaders,redirect:'manual',signal});
  if(r.status>=300&&r.status<400){const location=r.headers.get('Location');await r.body?.cancel();if(!location)throw Error('이동 주소 없음');const next=official(new URL(location,target).href,source);if(!next)throw Error('기관 공식 도메인 밖으로 이동하지 않음');target=next.href;continue;}
  if(!r.ok){await r.body?.cancel();throw Error('원본 서버 HTTP '+r.status);}
  const bytes=await bounded(r,page?1500000:limit),contentType=r.headers.get('Content-Type')||'application/octet-stream';
  if(!page&&!(bytes.subarray(0,5).toString()==='%PDF-'||bytes[0]===208&&bytes[1]===207||bytes[0]===80&&bytes[1]===75))throw Error('원본 응답이 PDF·HWP·HWPX·XLSX 문서가 아님');
  return {bytes,url:target,contentType,sha256:createHash('sha256').update(bytes).digest('hex'),fetchedAt:new Date().toISOString()};
 }
 throw Error('파일 주소 이동 횟수 초과');
}
export function createCollector({token,fetcher=fetch}){
 if(!token||token.length<24)throw Error('COLLECTOR_TOKEN must contain at least 24 characters');let active=0;const cache=new Map();
 return http.createServer(async(req,res)=>{
  const json=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
  if(req.method==='GET'&&req.url==='/health')return json(200,{service:'seogu-plan-collector',status:'ready',version:2,authorities:authorities.length});
  if(req.method!=='POST'||!['/download','/page'].includes(req.url))return json(404,{error:'Unknown endpoint'});
  const provided=Buffer.from(String(req.headers.authorization||'')),expected=Buffer.from('Bearer '+token);if(provided.length!==expected.length||!timingSafeEqual(provided,expected))return json(401,{error:'Unauthorized'});
  if(active>=4)return json(429,{error:'Collector busy'});active++;
  try{let raw='';for await(const chunk of req){raw+=chunk.toString();if(Buffer.byteLength(raw)>8192)return json(413,{error:'Request too large'});}const input=JSON.parse(raw),page=req.url==='/page',key=JSON.stringify([input.authority||'seogu',input.url,page]);let file=cache.get(key);
   if(!file||Date.now()-Date.parse(file.fetchedAt)>(page?60000:15*60*1000)){file=await collect(input,fetcher,{page});if(cache.size>=12)cache.delete(cache.keys().next().value);cache.set(key,file);}
   res.writeHead(200,{'Content-Type':file.contentType,'Content-Length':file.bytes.length,'Cache-Control':'no-store','X-Source-Url':file.url,'X-Source-SHA256':file.sha256,'X-Fetched-At':file.fetchedAt});res.end(file.bytes);
  }catch(e){console.error('collector_failure',JSON.stringify({message:e.message,code:e.cause?.code||e.name}));json(502,{error:e.message,stage:'source_download'});}finally{active--;}
 });
}
if(fileURLToPath(import.meta.url)===process.argv[1])createCollector({token:process.env.COLLECTOR_TOKEN}).listen(Number(process.env.PORT||10000),'0.0.0.0',()=>console.log('Collector ready'));
