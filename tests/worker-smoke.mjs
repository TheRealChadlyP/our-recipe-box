// Simulated Worker test. Does not connect to Cloudflare or external websites.
import assert from 'node:assert/strict';
import worker from '../worker/worker.js';
const table=new Map();
const env={HOUSEHOLD_CODE:'long-household-code',ALLOWED_ORIGIN:'*',DB:{prepare(sql){let args=[];return{bind(...values){args=values;return this;},async all(){return{results:[...table.values()].map(payload=>({payload}))};},async run(){if(sql.startsWith('INSERT'))table.set(args[0],args[1]);if(sql.startsWith('DELETE'))table.delete(args[0]);return {success:true};}};}}};
class FakeHTMLRewriter {
 on(selector,callbacks){this.callbacks=callbacks;return this;}
 transform(res){return {text:async()=>{const html=await res.text();const matches=html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);for(const m of matches){this.callbacks.element();this.callbacks.text({text:m[1]});}return html;}};}
}
globalThis.HTMLRewriter=FakeHTMLRewriter;
globalThis.fetch=async(url)=>new Response(`<html><script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@type':'Recipe',name:'Test Soup',recipeIngredient:['2 cups broth','1 carrot'],recipeInstructions:[{'@type':'HowToStep',text:'Add carrot to broth.'},{'@type':'HowToStep',text:'Simmer 10 minutes.'}],recipeYield:'4',prepTime:'PT5M',cookTime:'PT10M'})}</script></html>`,{headers:{'content-type':'text/html'}});
const request=(path,method='GET',data=null,authed=true)=>new Request('https://recipe-worker.example'+path,{method,headers:{'X-Family-Code':authed?'long-household-code':'incorrect','Origin':'https://therealchadlyp.github.io','Content-Type':'application/json'},body:data?JSON.stringify(data):undefined});
let res=await worker.fetch(request('/api/health','GET',null,false),env);assert.equal(res.status,200);
res=await worker.fetch(request('/api/recipes','GET',null,false),env);assert.equal(res.status,401);
const recipe={id:'test-soup',name:'Soup',ingredients:['2 carrots'],steps:['Boil carrots.'],updatedAt:'2026-11-22T00:00:00Z'};
res=await worker.fetch(request('/api/recipes','PUT',recipe),env);assert.equal(res.status,200);
res=await worker.fetch(request('/api/recipes'),env);assert.equal((await res.json()).recipes[0].name,'Soup');
res=await worker.fetch(request('/api/import','POST',{url:'https://example.com/recipe'}),env);let imported=(await res.json()).recipe;assert.equal(imported.name,'Test Soup');assert.equal(imported.ingredients.length,2);assert.equal(imported.steps.length,2);assert.equal(imported.servings,'4 servings');
res=await worker.fetch(request('/api/import','POST',{url:'http://localhost/admin'}),env);assert.equal(res.status,400);
res=await worker.fetch(request('/api/recipes/test-soup','DELETE'),env);assert.equal(res.status,200);
res=await worker.fetch(request('/api/recipes'),env);assert.equal((await res.json()).recipes.length,0);
console.log('Worker smoke tests passed: auth, D1 CRUD, URL extraction, URL safety.');
