/** Cloudflare Worker: private family recipe storage + recipe URL importer. */
const MAX_RECIPE_BYTES=125_000;
const MAX_HTML_BYTES=2_500_000;

function headers(origin,env){
 const allowed=env.ALLOWED_ORIGIN||'*';
 const okay=allowed==='*'||!origin||allowed.split(',').map(x=>x.trim()).includes(origin);
 return {
   'Access-Control-Allow-Origin': okay?(allowed==='*'?'*':origin):'null',
   'Access-Control-Allow-Headers':'Content-Type, X-Family-Code',
   'Access-Control-Allow-Methods':'GET, PUT, DELETE, POST, OPTIONS',
   'Content-Type':'application/json; charset=utf-8',
   'Cache-Control':'no-store',
   'Vary':'Origin'
 };
}
function response(data,status,origin,env){return new Response(JSON.stringify(data),{status,headers:headers(origin,env)});}
function authorized(req,env){const got=req.headers.get('X-Family-Code');return typeof env.HOUSEHOLD_CODE==='string'&&env.HOUSEHOLD_CODE.length>=8&&got===env.HOUSEHOLD_CODE;}
function cleaned(s){return String(s??'').replace(/<[^>]*>/g,' ').replace(/&(?:nbsp|#160);/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#(?:39|x27);/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/\s+/g,' ').trim();}
function safeUrl(raw){
 try{const u=new URL(String(raw));const host=u.hostname.toLowerCase();if(!['https:','http:'].includes(u.protocol)||u.username||u.password||u.port&&!['80','443'].includes(u.port))return null;
 if(host==='localhost'||host.endsWith('.localhost')||host.endsWith('.local')||host.endsWith('.internal')||host.endsWith('.test')||/^\d+(?:\.\d+){0,3}$/.test(host)||host.includes(':')||host.startsWith('0x'))return null;
 u.hash='';return u;
 }catch{return null;}
}
function jsonNodes(node,out=[]){
 if(!node||typeof node!=='object')return out;
 if(Array.isArray(node)){node.forEach(n=>jsonNodes(n,out));return out;}
 if(node['@type'])out.push(node);
 if(node['@graph'])jsonNodes(node['@graph'],out);
 if(node.mainEntity)jsonNodes(node.mainEntity,out);
 if(node.itemListElement)jsonNodes(node.itemListElement,out);
 return out;
}
function recipeType(t){return (Array.isArray(t)?t:[t]).some(x=>String(x||'').toLowerCase().split('/').pop()==='recipe');}
function flattenSteps(list){const out=[];for(const step of Array.isArray(list)?list:[list]){
 if(!step)continue;
 if(typeof step==='string'){const text=cleaned(step);if(text)out.push(text);}
 else if(typeof step==='object'){
  if(step.itemListElement){out.push(...flattenSteps(step.itemListElement));continue;}
  const text=cleaned(step.text||step.name||step.description||'');if(text)out.push(text);
 }
 }return out;
}
function minutes(s){if(typeof s!=='string')return 0;const m=s.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i);if(!m)return 0;return (+m[1]||0)*1440+(+m[2]||0)*60+(+m[3]||0)+Math.round((+m[4]||0)/60);}
function photoUrl(value){let v=Array.isArray(value)?value[0]:value;if(v&&typeof v==='object')v=v.url||v.contentUrl||v['@id']||'';const parsed=safeUrl(v);return parsed&&parsed.protocol==='https:'?parsed.href:'';}
function category(raw){const txt=String(Array.isArray(raw)?raw.join(' '):raw||'').toLowerCase();if(/breakfast|brunch/.test(txt))return'Breakfast';if(/dessert|cake|cookie|pie|sweet/.test(txt))return'Dessert';if(/drink|cocktail|smoothie|beverage/.test(txt))return'Drinks';if(/side|salad|sides/.test(txt))return'Side Dish';if(/snack|appetizer/.test(txt))return'Snack';if(/lunch|sandwich/.test(txt))return'Lunch';return'Dinner';}
function recipeFromSchema(r,url){const ingredients=(Array.isArray(r.recipeIngredient)?r.recipeIngredient:[]).map(cleaned).filter(Boolean);
 const steps=flattenSteps(r.recipeInstructions||[]);
 if(!r.name||!ingredients.length||!steps.length)throw Error('Found recipe metadata, but ingredients or directions were missing. Please enter it manually.');
 let yieldValue=Array.isArray(r.recipeYield)?r.recipeYield[0]:r.recipeYield;
 let servings=cleaned(yieldValue||'');if(/^\d+$/.test(servings))servings+=' servings';
 return{name:cleaned(r.name).slice(0,140),description:cleaned(r.description||'').slice(0,350),ingredients:ingredients.slice(0,150),steps:steps.slice(0,100),tips:[],category:category(r.recipeCategory||r.keywords),emoji:'🍽️',prepMinutes:minutes(r.prepTime),cookMinutes:minutes(r.cookTime),servings,photoUrl:photoUrl(r.image),sourceUrl:url};
}
async function readHtml(requestUrl){
 let next=safeUrl(requestUrl);if(!next)throw Error('Enter a public HTTP or HTTPS recipe URL.');
 for(let i=0;i<5;i++){
  const res=await fetch(next.href,{headers:{'User-Agent':'Mozilla/5.0 (compatible; RecipeBoxImporter/1.0)','Accept':'text/html,application/xhtml+xml'},redirect:'manual'});
  if(res.status>=300&&res.status<400){const loc=res.headers.get('Location');if(!loc)throw Error('Could not follow the site redirect.');next=safeUrl(new URL(loc,next.href).href);if(!next)throw Error('Unsafe site redirect blocked.');continue;}
  if(!res.ok)throw Error('Recipe website returned HTTP '+res.status+'.');
  const kind=res.headers.get('Content-Type')||'';if(kind&&!/html|text\//i.test(kind))throw Error('That link does not appear to be a recipe webpage.');
  const len=Number(res.headers.get('Content-Length')||0);if(len>MAX_HTML_BYTES)throw Error('Recipe webpage is too large to import.');
  if(!res.body)throw Error('The website returned no readable content.');
  const reader=res.body.getReader();const chunks=[];let size=0;
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_HTML_BYTES){await reader.cancel();throw Error('Recipe webpage is too large to import.');}chunks.push(value);}
  const data=new Uint8Array(size);let offset=0;for(const part of chunks){data.set(part,offset);offset+=part.byteLength;}
  return {html:new TextDecoder().decode(data),url:next.href};
 }
 throw Error('Recipe website redirected too many times.');
}
async function extractRecipe(url){const {html,url:finalUrl}=await readHtml(url);
 const blocks=[];let index=-1;
 await new HTMLRewriter().on('script[type="application/ld+json"]',{
  element(){index=blocks.push('')-1;},
  text(chunk){if(index>=0)blocks[index]+=chunk.text;}
 }).transform(new Response(html,{headers:{'content-type':'text/html'}})).text();
 for(const block of blocks){try{const parsed=JSON.parse(block.trim().replace(/^<!--|-->$/g,''));for(const node of jsonNodes(parsed)){if(recipeType(node['@type']))return recipeFromSchema(node,finalUrl);}}catch(e){if(e.message?.startsWith('Found recipe metadata'))throw e;}}
 throw Error('No importable recipe found on this webpage. Try entering it manually.');
}
function validRecipe(data){
 if(!data||typeof data!=='object'||Array.isArray(data)||typeof data.id!=='string'||!/^[\w-]{1,100}$/.test(data.id)||typeof data.name!=='string'||!data.name.trim()||data.name.length>140)return false;
 if(!Array.isArray(data.ingredients)||!Array.isArray(data.steps)||!data.ingredients.length||!data.steps.length||data.ingredients.length>150||data.steps.length>100)return false;
 if([...data.ingredients,...data.steps,...(data.tips||[])].some(x=>typeof x!=='string'||x.length>3500))return false;
 return true;
}
export default {async fetch(req,env){
 const origin=req.headers.get('Origin');const url=new URL(req.url);const path=url.pathname;
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:headers(origin,env)});
 if(path==='/api/health'&&req.method==='GET')return response({ok:true},200,origin,env);
 if(!path.startsWith('/api/'))return response({error:'Not found'},404,origin,env);
 if(!authorized(req,env))return response({error:'Incorrect family access code or secret not configured.'},401,origin,env);
 try{
  if(path==='/api/recipes'&&req.method==='GET'){
   const rows=await env.DB.prepare('SELECT payload FROM recipes ORDER BY updated_at DESC LIMIT 1000').all();
   return response({recipes:(rows.results||[]).map(x=>JSON.parse(x.payload))},200,origin,env);
  }
  if(path==='/api/recipes'&&req.method==='PUT'){
   const raw=await req.text();if(raw.length>MAX_RECIPE_BYTES)return response({error:'Recipe exceeds storage limit.'},413,origin,env);
   const item=JSON.parse(raw);if(!validRecipe(item))return response({error:'Recipe data is incomplete or invalid.'},400,origin,env);
   const updated=new Date().toISOString();
   await env.DB.prepare('INSERT INTO recipes (id,payload,updated_at) VALUES (?1,?2,?3) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload, updated_at=excluded.updated_at').bind(item.id,JSON.stringify(item),updated).run();
   return response({ok:true},200,origin,env);
  }
  if(path.startsWith('/api/recipes/')&&req.method==='DELETE'){
   const id=decodeURIComponent(path.slice('/api/recipes/'.length));if(!/^[\w-]{1,100}$/.test(id))return response({error:'Invalid recipe ID'},400,origin,env);
   await env.DB.prepare('DELETE FROM recipes WHERE id=?1').bind(id).run();return response({ok:true},200,origin,env);
  }
  if(path==='/api/import'&&req.method==='POST'){
   const raw=await req.text();if(raw.length>3000)return response({error:'URL is too long.'},400,origin,env);
   const data=JSON.parse(raw);if(!safeUrl(data.url))return response({error:'Enter a valid public recipe URL.'},400,origin,env);
   const recipe=await extractRecipe(data.url);return response({recipe},200,origin,env);
  }
  return response({error:'Not found'},404,origin,env);
 }catch(e){const msg=String(e?.message||'Unexpected error');const status=/SQLITE|database|D1_/.test(msg)?500:/JSON|invalid|missing|not found|website|url|redirect|too large|import|unsafe|blocked|HTTP|html/i.test(msg)?422:500;return response({error:status===500?'Server error. Check the database setup.':msg},status,origin,env);}
}};
