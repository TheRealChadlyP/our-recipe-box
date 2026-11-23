// Dependency-free smoke test for routes, initial recipe, manual saving, and settings.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const map=new Map();const handles={};const elements={};
function element(id){if(!elements[id])elements[id]={id,innerHTML:'',className:'',dataset:{},addEventListener(type,fn){handles[id+':'+type]=fn;},setAttribute(){},classList:{toggle(){},add(){},remove(){}}};return elements[id];}
const document={getElementById:element,querySelectorAll(){return[];},querySelector(selector){return element(selector);},addEventListener(){}};
const localStorage={getItem(k){return map.has(k)?map.get(k):null;},setItem(k,v){map.set(k,String(v));}};
const location={hash:'',search:''};const events={};
const window={addEventListener(event,fn){events[event]=fn;},scrollTo(){}};
const navigator={onLine:false};
const context={document,localStorage,location,window,navigator,setTimeout(){return 1;},clearTimeout(){},setInterval(){},URL,URLSearchParams,Date,JSON,Math,console,confirm(){return true;},FormData:class{constructor(target){this.data=target.data||{};}get(key){return this.data[key]??'';}},globalThis:{crypto:{randomUUID(){return'test-uuid-001';}}}};
vm.runInNewContext(fs.readFileSync(new URL('../app.js',import.meta.url),'utf8'),context);
assert.match(element('main').innerHTML,/Creamy Velveeta Mac &amp; Cheese/);
assert.equal(JSON.parse(map.get('our-recipe-box-v1')).length,1);
function click(selectors){const target={closest(selector){return selectors[selector]||null;}};handles['main:click']({target});}
click({'[data-open]':{dataset:{open:'velveeta-mac-cheese'}}});
assert.match(element('main').innerHTML,/Let\'s make it/);
assert.match(element('main').innerHTML,/2 cups \(8 oz\)/);
assert.match(element('main').innerHTML,/data-check=\"ingredient\"/); // checkboxes
click({'[data-nav]':{dataset:{nav:'add'}}});
click({'#tab-manual':{}});
const data={name:'Test Apple Crisp',description:'Tasty',category:'Dessert',emoji:'🍎',prepMinutes:'10',cookMinutes:'25',servings:'4 servings',ingredients:'4 apples\n1 cup oats',steps:'Slice apples\nBake',tips:'Serve warm',sourceUrl:'',photoUrl:''};
handles['main:submit']({target:{id:'recipe-form',data},preventDefault(){}});
assert.match(element('main').innerHTML,/Test Apple Crisp/);
assert.equal(JSON.parse(map.get('our-recipe-box-v1')).length,2);
click({'[data-nav]':{dataset:{nav:'settings'}}});
assert.match(element('main').innerHTML,/Shared family recipe box/);
console.log('Smoke tests passed: seeded recipe, detail, manual add, settings.');
