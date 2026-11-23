(() => {
'use strict';
const STORAGE = 'our-recipe-box-v1';
const CONFIG = 'our-recipe-box-config-v1';
const PENDING = 'our-recipe-box-pending-v1';
const CHECKS = 'our-recipe-box-checks-v1';
const SEED = {
  id:'velveeta-mac-cheese',
  name:'Creamy Velveeta Mac & Cheese',
  description:'A creamy, comforting stovetop classic with Velveeta and sharp cheddar.',
  category:'Side Dish',emoji:'🥘',prepMinutes:10,cookMinutes:10,servings:'6 servings',favorite:true,
  ingredients:[
    '2 cups (8 oz) dry elbow macaroni','2 tablespoons butter','2 tablespoons all-purpose flour','2 cups whole milk',
    '1 teaspoon garlic powder','½ teaspoon onion powder','½ teaspoon ground black pepper',
    '8 oz Velveeta Original, cubed','½ cup freshly shredded sharp cheddar cheese'
  ],
  steps:[
    'Boil macaroni in water until al dente, according to package directions. Drain and return to the pot.',
    'While pasta cooks, melt butter in a large skillet over medium heat. Stir in flour and cook for 2 minutes, stirring continuously.',
    'Slowly pour in the milk, whisking constantly until smooth.',
    'Add garlic powder, onion powder, and black pepper. Raise the heat to medium-high and bring to a gentle boil. Cook for 3–4 minutes, whisking constantly, until slightly thickened.',
    'Reduce heat to medium. Add the cubed Velveeta and stir until completely melted and smooth.',
    'Remove sauce from heat, pour over the cooked macaroni, and stir to coat.',
    'Add the freshly shredded sharp cheddar and stir until melted. Serve warm.'
  ],
  tips:[
    'Shred cheddar from a block for smoother melting. Pre-shredded cheese may give the sauce a grainy texture.',
    'Keep the heat moderate when melting the cheese to avoid scorching or separation.',
    'If the sauce gets too thick, stir in a splash of warm milk or reserved pasta water.',
    'A pinch of dry mustard, smoked paprika, or hot sauce adds flavor.',
    'Some readers prefer more pasta for this amount of cheese sauce.',
    'Store covered in the fridge for up to 3 days; reheat gently with a splash of milk.'
  ],
  sourceUrl:'https://keytomylime.com/velveeta-mac-and-cheese-recipe/',
  photoUrl:'',createdAt:'2026-11-22T00:00:00.000Z',updatedAt:'2026-11-22T00:00:00.000Z'
};
const CATEGORIES=['Dinner','Breakfast','Lunch','Side Dish','Dessert','Snack','Drinks','Other'];
const EMOJI={Dinner:'🍽️',Breakfast:'🍳',Lunch:'🥪','Side Dish':'🥘',Dessert:'🍰',Snack:'🥨',Drinks:'🍹',Other:'🍲'};
const readJSON=(k,fallback)=>{try {const raw=localStorage.getItem(k);return raw===null?fallback:JSON.parse(raw);}catch{return fallback;}};
const hadSaved=localStorage.getItem(STORAGE)!==null;
let recipes=readJSON(STORAGE,hadSaved?[]:[SEED]);
let config=readJSON(CONFIG,{apiUrl:'',code:'',syncedOnce:false});
let pending=readJSON(PENDING,[]);
let checks=readJSON(CHECKS,{});
if(!Array.isArray(recipes)) recipes=[SEED];
if(!Array.isArray(pending)) pending=[];
let view='home',selectedId=null,category='All',query='',mode='link',editingId=null,draft=null,draftSource='';
let syncBusy=false,syncStatus='local',syncError='',importing=false;
const main=document.getElementById('main');
const esc=(v)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const str=(v)=>String(v??'').trim();
const asList=(v)=>Array.isArray(v)?v.map(str).filter(Boolean):String(v??'').split(/\r?\n/).map(str).filter(Boolean);
const validUrl=(s)=>{try{const u=new URL(s);return /^https?:$/.test(u.protocol)?u.href:'';}catch{return '';}};
const imgUrl=(s)=>{const url=validUrl(s);return url.startsWith('https://')?url:'';};
const save=()=>{localStorage.setItem(STORAGE,JSON.stringify(recipes));localStorage.setItem(PENDING,JSON.stringify(pending));localStorage.setItem(CONFIG,JSON.stringify(config));};
const addPending=(type,recipe)=>{const id=typeof recipe==='string'?recipe:recipe.id;pending=pending.filter(op=>op.id!==id);pending.push({type,id,recipe:typeof recipe==='string'?null:recipe,opId:(globalThis.crypto?.randomUUID?.()||Date.now()+'-'+Math.random())});save();};
let toastTimer;
function toast(message){const el=document.getElementById('toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3200);}
function status(state){syncStatus=state;const dot=document.getElementById('sync-status');dot.className='sync-dot'+(state==='connected'?' connected':state==='error'?' error':'');dot.title=state==='connected'?'Shared family recipes connected':state==='error'?'Unable to sync; changes saved on this device':'Saved on this device';dot.setAttribute('aria-label',dot.title);}
function navigate(where){if(where==='add'){editingId=null;draft=null;draftSource='';mode='link';}location.hash='#'+where;if(location.hash==='#'+where)route();}
function route(){const hash=decodeURIComponent(location.hash.slice(1)||'home');if(hash.startsWith('recipe/')){view='recipe';selectedId=hash.slice(7);}else if(['home','favorites','add','settings'].includes(hash)){view=hash;}else{view='home';}render();window.scrollTo({top:0,behavior:'instant'});}
function navActive(){document.querySelectorAll('[data-nav]').forEach(el=>el.classList.toggle('active',el.dataset.nav===view));}
function render(){navActive();if(view==='home'||view==='favorites')renderLibrary();else if(view==='recipe')renderRecipe();else if(view==='add')renderAdd();else renderSettings();}
function totalTime(r){const sum=(Number(r.prepMinutes)||0)+(Number(r.cookMinutes)||0);return sum?sum+' min':'Time flexible';}
function categoryArt(c){
 const shapes={
 'Dinner':'<path d="M31 53h98l-7 51a18 18 0 0 1-18 16H56a18 18 0 0 1-18-16l-7-51Z"/><path d="M22 53h116M59 42a16 16 0 0 1 32 0M70 28q-13-12 0-26M94 25q-11-12-1-23"/>',
 'Breakfast':'<path d="M42 47h76a8 8 0 0 1 8 8v37a24 24 0 0 1-24 24H58a24 24 0 0 1-24-24V55a8 8 0 0 1 8-8Z"/><path d="M33 70h94M62 45V33M80 42V24M98 45V33M48 118h64"/><circle cx="80" cy="89" r="15"/>',
 'Lunch':'<path d="M27 70 80 35l53 35-53 34L27 70Z"/><path d="m27 70 1 20 52 34 53-34V70M80 104v20M44 74l35 22 35-22M38 96h84"/>',
 'Side Dish':'<path d="M27 72h106l-12 35a23 23 0 0 1-22 16H61a23 23 0 0 1-22-16L27 72Z"/><path d="M20 71h120M105 45l23-30M126 16l5 5M57 64q-20-25 2-43M81 63q-9-22 9-38"/><path d="M45 55q19-12 34 2"/>',
 'Dessert':'<path d="M32 71h96v39a12 12 0 0 1-12 12H44a12 12 0 0 1-12-12V71Z"/><path d="M31 70c4-30 17-17 29-37 13 19 28 6 39-9 5 19 28 17 30 46M42 89h75M51 108h58"/><path d="M80 15v11"/>',
 'Snack':'<path d="M76 42c-27-20-60 2-53 35 7 40 37 55 55 42 19 13 46-2 54-42 6-35-30-53-55-35Z"/><path d="M78 43q-1-16 10-27M79 28q20-19 41-7-19 21-41 7Z"/>',
 'Drinks':'<path d="M40 40h75v50a30 30 0 0 1-30 30H70a30 30 0 0 1-30-30V40Z"/><path d="M115 50h10a20 20 0 0 1 0 40h-10M34 122h89M62 24q-9-10 0-21M88 24q-10-11 0-21"/>',
 'Other':'<path d="M40 16h61l20 20v90H40V16Z"/><path d="M101 16v21h20M54 62h52M54 79h43M54 96h48M54 46h32"/>'
 };
 return `<span class="card-art" aria-hidden="true"><svg viewBox="0 0 160 140" focusable="false"><circle cx="80" cy="71" r="60" stroke-dasharray="3 8" opacity=".3"/>${shapes[c]||shapes.Other}</svg></span>`;
}
function card(r){const im=imgUrl(r.photoUrl);return `<article class="recipe-card"><div class="card-visual" data-category="${esc(r.category||'Other')}">${categoryArt(r.category)}${im?`<img class="recipe-photo" src="${esc(im)}" alt="" loading="lazy" onerror="this.style.display='none'">`:''}<span class="category-chip">${esc(r.category||'Other')}</span><button class="card-love ${r.favorite?'is-favorite':''}" data-favorite="${esc(r.id)}" aria-label="${r.favorite?'Remove from':'Add to'} favorites">${r.favorite?'♥':'♡'}</button></div><button class="card-open" data-open="${esc(r.id)}"><div class="card-body"><div class="card-title">${esc(r.name)}</div><p class="card-sub">${esc((r.description||'A little something worth keeping.').slice(0,80))}</p><div class="card-footer"><span>◷ ${esc(totalTime(r))}</span><span>♧ ${esc(r.servings||'')}</span></div></div></button></article>`;}
function renderLibrary(){const all=view==='favorites'?recipes.filter(x=>x.favorite):recipes;
 const cats=['All',...CATEGORIES.filter(c=>all.some(r=>r.category===c))];if(!cats.includes(category))category='All';
 const filtered=all.filter(r=>(category==='All'||r.category===category)&&(!query||[r.name,r.category,r.description,...(r.ingredients||[])].join(' ').toLowerCase().includes(query.toLowerCase()))).sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||''));
 main.innerHTML=`${view==='home'?`<section class="hero"><div class="hero-text"><div class="eyebrow eyebrow-line">Our little family cookbook</div><h1>Made with love.<br>Kept forever.</h1><p class="handwritten">the good stuff, all in one place</p><p class="lead">The dinners we swear by, the treats we share, and the recipes that feel like home.</p><button class="btn btn-primary" data-nav="add">✦ Add to the recipe box</button></div><div class="hero-art"><img src="assets/kitchen-still-life.svg" alt="An illustrated family recipe card with kitchen herbs and a wooden spoon"/><span class="handwriting">pull up a chair!</span></div></section><div class="kitchen-summary"><span class="handwritten">From our kitchen to yours</span><span class="summary-dash">✳</span><span class="small-text">${recipes.length} treasured recipe${recipes.length===1?'':'s'} · ${recipes.filter(r=>r.favorite).length} favorite${recipes.filter(r=>r.favorite).length===1?'':'s'}</span></div>`:`<div class="page-top"><div><div class="eyebrow">The keeper collection</div><h1>Our favorites.</h1><p class="handwritten">recipes we make again & again</p></div></div>`}
 <div class="section-head"><div><div class="eyebrow">The collection</div><h2>${view==='favorites'?'Saved with a little extra love':'From our recipe box'}</h2><p class="handwritten">${all.length} recipe${all.length===1?'':'s'} worth keeping</p></div><button class="btn btn-ghost desktop-add" data-nav="add">＋ Add a recipe</button></div>
 <div class="tools"><label class="search-box"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5.3 5.3"/></svg><input id="recipe-search" type="search" placeholder="Search the recipe box…" value="${esc(query)}" autocomplete="off" aria-label="Search recipes"></label></div>
 <div class="pills" id="categories">${cats.map(c=>`<button class="pill ${category===c?'selected':''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}</div>
 <div id="recipes-region">${filtered.length?`<div class="recipe-grid">${filtered.map(card).join('')}</div>`:`<div class="empty"><div class="big">♡</div><h3>${query?'No recipes found':view==='favorites'?'Your favorites will live here':'Room for more good food'}</h3><p>${query?'Try another search.':'Save something delicious to see it here.'}</p><button class="btn btn-primary" data-nav="add">Add a recipe</button></div>`}</div>`;
}
function renderRecipe(){const r=recipes.find(x=>x.id===selectedId);if(!r){main.innerHTML=`<div class="empty"><h3>Recipe not found</h3><button class="btn btn-primary" data-nav="home">Back to recipes</button></div>`;return;}
 const ck=checks[r.id]||{ingredients:[],steps:[]};const image=imgUrl(r.photoUrl);
 main.innerHTML=`<div class="page-top"><button class="back" data-nav="home">← All recipes</button><button class="icon-btn" data-edit="${esc(r.id)}" aria-label="Edit recipe" title="Edit recipe">✎</button></div>
 <div class="recipe-top"><div><div class="eyebrow">${esc(r.category||'Recipe')}</div><h1 class="recipe-title">${esc(r.name)}</h1><p class="recipe-description">${esc(r.description||'A recipe worth keeping.')}</p><div class="meta"><span>◷ ${esc(totalTime(r))}</span><span>♧ ${esc(r.servings||'Servings not set')}</span>${r.prepMinutes?`<span>Prep ${esc(r.prepMinutes)} min</span>`:''}${r.cookMinutes?`<span>Cook ${esc(r.cookMinutes)} min</span>`:''}</div>
 <div class="action-row"><button class="btn ${r.favorite?'btn-primary':'btn-ghost'} btn-small" data-favorite="${esc(r.id)}">${r.favorite?'♥ Saved favorite':'♡ Add favorite'}</button><button class="btn btn-ghost btn-small" id="share-recipe">↗ Share</button><button class="btn btn-soft btn-small" id="clear-checks">↺ Reset checks</button></div></div>
 <div class="recipe-image">${image?`<img src="${esc(image)}" alt="${esc(r.name)}" onerror="this.outerHTML='${esc(r.emoji||'🍲')}'">`:esc(r.emoji||EMOJI[r.category]||'🍲')}</div></div>
 <div class="detail-columns"><section class="detail-panel"><div class="panel-top"><h2>Ingredients</h2><span class="muted">${r.ingredients.length} items</span></div><p class="panel-sub">Tap ingredients as you go.</p><ul class="check-list">${r.ingredients.map((v,i)=>`<li><label><input type="checkbox" data-check="ingredient" data-index="${i}" ${ck.ingredients.includes(i)?'checked':''}><span>${esc(v)}</span></label></li>`).join('')}</ul></section>
 <section class="detail-panel"><h2>Let's make it.</h2><p class="panel-sub">One step at a time.</p><ol class="steps-list">${r.steps.map((v,i)=>`<li><span class="step-num">${i+1}</span><span class="step-text ${ck.steps.includes(i)?'done':''}">${esc(v)}</span><input class="step-check" type="checkbox" data-check="step" data-index="${i}" aria-label="Mark step ${i+1} done" ${ck.steps.includes(i)?'checked':''}></li>`).join('')}</ol>
 ${r.tips?.length?`<aside class="notes"><h3>✳ A few good tips</h3><ul>${r.tips.map(v=>`<li>${esc(v)}</li>`).join('')}</ul></aside>`:''}
 ${validUrl(r.sourceUrl)?`<p style="margin:22px 0 0"><a class="source-link" href="${esc(validUrl(r.sourceUrl))}" target="_blank" rel="noopener noreferrer">View original recipe ↗</a></p>`:''}</section></div>
 <div class="form-actions" style="margin:25px 0"><button class="btn btn-ghost btn-small" data-edit="${esc(r.id)}">✎ Edit recipe</button><button class="btn btn-danger btn-small" data-delete="${esc(r.id)}">Delete recipe</button></div>`;
}
function renderAdd(){const r=draft||{};const linked=mode==='link'&&!editingId;const photo=mode==='photo'&&!editingId;
 main.innerHTML=`<div class="form-shell"><div class="page-top"><button class="back" data-nav="home">← My recipes</button></div><div class="eyebrow">A little something to keep</div><h1>${editingId?'Edit this treasure':'Add to the recipe box'}</h1><p class="lead form-intro">Every family favorite deserves a place to call home. Pick the easiest way to save it.</p>
 ${editingId?'':`<div class="mode-tabs" aria-label="How to add a recipe"><button id="tab-link" class="${linked?'active':''}" aria-pressed="${linked}"><svg viewBox="0 0 32 32"><path d="m14 21-3 3a6 6 0 0 1-8-8l5-5a6 6 0 0 1 8 0M18 11l3-3a6 6 0 0 1 8 8l-5 5a6 6 0 0 1-8 0M11 21l10-10"/></svg>From a link</button><button id="tab-photo" class="${photo?'active':''}" aria-pressed="${photo}"><svg viewBox="0 0 32 32"><path d="M4 10h6l3-4h7l3 4h5v17H4V10Z"/><circle cx="16" cy="18" r="6"/><path d="M23 14h2"/></svg>From a photo</button><button id="tab-manual" class="${!linked&&!photo?'active':''}" aria-pressed="${!linked&&!photo}"><svg viewBox="0 0 32 32"><path d="M7 25 5 29l7-2L27 12l-5-5L7 22v3ZM19 10l5 5M6 6h11M6 12h7"/></svg>Write it myself</button></div>`}
 ${linked?`<div class="form-card"><h3>Found a recipe online?</h3><p class="muted">Paste its link and we'll look for the recipe, minus the pop-ups and long stories.</p><form id="link-form"><label class="field"><span>Recipe website URL</span><input id="import-url" type="url" required placeholder="https://example.com/your-recipe" value="${esc(window._incomingUrl||'')}"></label><button class="btn btn-primary" type="submit" id="import-button" ${importing?'disabled':''}>${importing?'Importing…':'Bring in this recipe →'}</button></form>
 ${!config.apiUrl?`<div class="warn">Recipe-link importing needs the optional family cloud service. Manual entry and photo scanning work on this device already. <button class="back" id="setup-sync" style="margin-left:4px">Set up imports & sharing →</button></div>`:''}</div>`:
 photo?`<div class="form-card"><h3>Snap a recipe to save it.</h3><p class="muted">A recipe card, the back of a box, or a page from the family cookbook — we'll try to read it for you.</p><div class="scan-choice"><label class="scan-option" for="recipe-photo-camera"><svg viewBox="0 0 32 32"><path d="M4 10h6l3-4h7l3 4h5v17H4V10Z"/><circle cx="16" cy="18" r="6"/></svg>Take a photo<small>Open your camera</small></label><label class="scan-option" for="recipe-photo-library"><svg viewBox="0 0 32 32"><rect x="4" y="5" width="24" height="22" rx="2"/><circle cx="11" cy="12" r="2"/><path d="m6 24 8-8 5 5 4-4 4 7"/></svg>Choose a picture<small>Use your photo library</small></label></div><input id="recipe-photo-camera" type="file" accept="image/*" capture="environment" hidden><input id="recipe-photo-library" type="file" accept="image/*" hidden><img id="scan-preview" class="scan-preview" alt="Recipe photo preview"><div class="scan-status" id="scan-status" role="status">Printed text works best. Handwriting may need corrections. Your photo stays on your device while it's read.</div><p class="small-text" style="margin:17px 0 0">Requires an internet connection the first time to load the text recognition engine. We'll show you an editable draft before anything is saved.</p><button class="btn btn-soft btn-small" id="switch-manual" style="margin-top:14px">Prefer to type it instead?</button></div>`:
 `<form id="recipe-form" class="form-card">
 ${draftSource==='photo'?'<div class="review-note"><strong>Photo scanned!</strong> These are best-effort suggestions from the picture. Carefully check ingredient amounts and each step before saving. You can edit everything below.</div>':''}
 <label class="field"><span>Recipe name *</span><input name="name" maxlength="140" required placeholder="Grandma’s chocolate chip cookies" value="${esc(r.name||'')}"></label>
 <label class="field"><span>Short description</span><input name="description" maxlength="350" placeholder="What makes this one special?" value="${esc(r.description||'')}"></label>
 <div class="field-grid"><label class="field"><span>Category</span><select name="category">${CATEGORIES.map(c=>`<option ${r.category===c?'selected':''}>${c}</option>`).join('')}</select></label><label class="field"><span>Prep (min)</span><input name="prepMinutes" type="number" min="0" max="9999" placeholder="10" value="${esc(r.prepMinutes??'')}"></label><label class="field"><span>Cook (min)</span><input name="cookMinutes" type="number" min="0" max="9999" placeholder="25" value="${esc(r.cookMinutes??'')}"></label></div>
 <label class="field"><span>Servings</span><input name="servings" placeholder="6 servings" value="${esc(r.servings||'')}"></label>
 <label class="field"><span>Ingredients *</span><textarea name="ingredients" required placeholder="2 cups flour&#10;1 teaspoon salt&#10;2 eggs">${esc((r.ingredients||[]).join('\n'))}</textarea><small>Put each ingredient on its own line.</small></label>
 <label class="field"><span>Instructions *</span><textarea name="steps" required rows="7" placeholder="Preheat the oven to 350°F.&#10;Mix dry ingredients.&#10;Bake for 25 minutes.">${esc((r.steps||[]).join('\n'))}</textarea><small>One step per line. We'll number them.</small></label>
 <label class="field"><span>Tips & tricks (optional)</span><textarea name="tips" placeholder="Don't overmix the batter.&#10;Freezes well for up to 2 months.">${esc((r.tips||[]).join('\n'))}</textarea><small>One tip per line.</small></label>
 <label class="field"><span>Original source URL (optional)</span><input name="sourceUrl" type="url" placeholder="https://..." value="${esc(r.sourceUrl||'')}"></label>
 <label class="field"><span>Food photo URL (optional)</span><input name="photoUrl" type="url" placeholder="https://..." value="${esc(r.photoUrl||'')}"><small>If you don't have one, we'll use a little hand-drawn illustration instead.</small></label>
 <div class="form-actions"><button class="btn btn-ghost" type="button" data-nav="home">Cancel</button><button class="btn btn-primary" type="submit">${editingId?'Save changes':'Save this recipe'} ♥</button></div>
 </form>`}
 </div>`;
}
function renderSettings(){main.innerHTML=`<div class="settings-layout"><div class="eyebrow">Your kitchen, your rules</div><h1>Settings & sharing.</h1>
 <section class="settings-card"><h3>☁ Shared family recipe box</h3><p>Save recipes to one shared collection, so you and your wife see the same recipes and changes on both phones. This also turns on automatic import from recipe links.</p>
 <div class="status-banner ${syncStatus==='connected'?'ok':syncStatus==='error'?'err':'no'}">${syncStatus==='connected'?'✓ Connected to your family recipe box':syncStatus==='error'?'⚠ Connection failed — edits are safe on this device':'● Local-only mode — recipes stay on this phone until sharing is connected'}</div>
 ${syncError?`<div class="warn">${esc(syncError)}</div>`:''}
 <form id="connection-form"><label class="field"><span>Cloud API address</span><input type="url" name="apiUrl" placeholder="https://our-recipe-box-api.yourname.workers.dev" value="${esc(config.apiUrl||'')}"><small>This is your own Cloudflare Worker URL. See the README setup guide.</small></label>
 <label class="field"><span>Family access code</span><input type="password" name="code" placeholder="Private family password" value="${esc(config.code||'')}"><small>Use the same address and code on both phones. Store the code somewhere safe.</small></label>
 <div class="form-actions"><button type="button" class="btn btn-ghost" id="disconnect">Use local only</button><button type="submit" class="btn btn-primary">Connect & sync</button></div></form>
 ${config.apiUrl?`<div class="setting-row"><span class="small-text">Changes sync automatically when online.</span><button class="btn btn-soft btn-small" id="sync-now">Sync now ↻</button></div>`:''}</section>
 <section class="settings-card"><h3>📦 Backup & restore</h3><p>Export a backup as a JSON file, or merge recipes from an existing backup. Good for peace of mind or moving your recipes before cloud sharing is set up.</p><div class="setting-row"><button class="btn btn-soft btn-small" id="export-recipes">↓ Export recipes</button><label class="btn btn-ghost btn-small" for="restore-file" style="cursor:pointer">↑ Import backup</label><input id="restore-file" type="file" accept="application/json,.json" hidden></div></section>
 <section class="settings-card"><h3>📱 Add to your home screen</h3><p><strong>Android / Chrome:</strong> Open your app's web address, tap Chrome's ⋮ menu, then <em>Install app</em> or <em>Add to Home screen</em>.</p><p><strong>iPhone / Safari:</strong> Tap Share → <em>Add to Home Screen</em>.</p><p class="small-text">Once installed, saved recipes can be read offline. Cloud syncing and URL importing require an internet connection.</p></section>
 <p class="small-text" style="text-align:center">Made for home cooks, not advertisements. ♡</p></div>`;}
function doFavorite(id){const r=recipes.find(x=>x.id===id);if(!r)return;r.favorite=!r.favorite;r.updatedAt=new Date().toISOString();save();addPending('upsert',r);syncNow();render();toast(r.favorite?'Added to favorites ♡':'Removed from favorites');}
function saveRecipe(data){const now=new Date().toISOString();const old=editingId?recipes.find(r=>r.id===editingId):null;const id=old?.id||globalThis.crypto?.randomUUID?.()||'recipe-'+Date.now();const rec={...old,...data,id,createdAt:old?.createdAt||now,updatedAt:now,favorite:old?.favorite??false};recipes=recipes.filter(r=>r.id!==id);recipes.unshift(rec);save();addPending('upsert',rec);syncNow();draft=null;draftSource='';editingId=null;window._incomingUrl='';location.hash='#recipe/'+encodeURIComponent(rec.id);route();toast('Recipe saved!');}
function formatRecipe(r){return `${r.name}\n${r.description||''}\n${totalTime(r)} · ${r.servings||''}\n\nINGREDIENTS\n${r.ingredients.map(v=>'• '+v).join('\n')}\n\nINSTRUCTIONS\n${r.steps.map((v,i)=>(i+1)+'. '+v).join('\n')}\n\n${r.tips?.length?'TIPS\n'+r.tips.map(v=>'• '+v).join('\n')+'\n\n':''}${r.sourceUrl?'Source: '+r.sourceUrl:''}`.trim();}
async function shareRecipe(){const r=recipes.find(x=>x.id===selectedId);if(!r)return;const message=formatRecipe(r);try{if(navigator.share){await navigator.share({title:r.name,text:message});return;}if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(message);toast('Recipe copied to clipboard!');return;}}catch(e){if(e.name==='AbortError')return;}toast('Could not share on this device.');}
function setChecks(kind,index,checked){const c=checks[selectedId]||{ingredients:[],steps:[]};const key=kind==='ingredient'?'ingredients':'steps';c[key]=checked?[...new Set([...c[key],index])]:c[key].filter(n=>n!==index);checks[selectedId]=c;localStorage.setItem(CHECKS,JSON.stringify(checks));if(kind==='step')renderRecipe();}
async function api(path,options={}) {if(!config.apiUrl||!config.code)throw Error('Set up the cloud address and family code first.');const base=config.apiUrl.replace(/\/+$/,'');const response=await fetch(base+path,{...options,headers:{'Content-Type':'application/json','X-Family-Code':config.code,...(options.headers||{})}});let obj={};try{obj=await response.json();}catch{}if(!response.ok)throw Error(obj.error||`Cloud error (${response.status})`);return obj;}
async function syncNow(){if(syncBusy||!config.apiUrl||!config.code||!navigator.onLine)return;syncBusy=true;syncError='';try{
  if(!config.syncedOnce){const remote=(await api('/api/recipes')).recipes||[];const byId=new Map(remote.map(x=>[x.id,x]));for(const local of recipes){const old=byId.get(local.id);if(!old||String(local.updatedAt)>String(old.updatedAt)){await api('/api/recipes',{method:'PUT',body:JSON.stringify(local)});byId.set(local.id,local);}}recipes=[...byId.values()];config.syncedOnce=true;pending=[];save();}
  for(const op of [...pending]){if(op.type==='delete'){await api('/api/recipes/'+encodeURIComponent(op.id),{method:'DELETE'});}else{await api('/api/recipes',{method:'PUT',body:JSON.stringify(op.recipe)});}pending=pending.filter(p=>p.opId!==op.opId);save();}
  const remote=(await api('/api/recipes')).recipes||[];recipes=remote;save();status('connected');
  if(view==='home'||view==='favorites'||view==='settings'||view==='recipe')render();
 }catch(err){syncError=err.message||'Network issue';status('error');if(view==='settings')renderSettings();}finally{syncBusy=false;}
}
async function importUrl(url){if(importing)return;if(!validUrl(url)){toast('Please enter a valid recipe link.');return;}if(!config.apiUrl||!config.code){toast('Connect your recipe box in Settings to enable link imports.');return;}importing=true;const button=document.getElementById('import-button');if(button){button.textContent='Finding ingredients…';button.disabled=true;}try{const result=await api('/api/import',{method:'POST',body:JSON.stringify({url})});draft={...result.recipe,sourceUrl:url};editingId=null;draftSource='link';mode='manual';window._incomingUrl='';renderAdd();toast('Recipe found! Review it and press Save.');}catch(err){toast(err.message||'Could not import this recipe.');const info=document.querySelector('#link-form');if(info){const el=document.createElement('p');el.className='warn';el.textContent='Could not import automatically. Some sites block imports or do not publish recipe data. Use “Enter recipe manually” instead.';info.after(el);}}finally{importing=false;if(button){button.disabled=false;button.textContent='Import recipe →';}}}
let ocrLoadingPromise=null;
function loadOcr(){
 if(window.Tesseract)return Promise.resolve(window.Tesseract);
 if(ocrLoadingPromise)return ocrLoadingPromise;
 ocrLoadingPromise=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.min.js';script.async=true;
  script.onload=()=>window.Tesseract?resolve(window.Tesseract):reject(Error('The text reader could not start.'));
  script.onerror=()=>reject(Error('Could not download the text reader. Check your internet connection.'));
  document.head.appendChild(script);
 }).catch(err=>{ocrLoadingPromise=null;throw err;});
 return ocrLoadingPromise;
}
function parseScannedRecipe(raw){
 const lines=String(raw||'').replace(/\r/g,'').split('\n').map(x=>x.replace(/[•·\t]+/g,' ').replace(/\s+/g,' ').trim()).filter(Boolean);
 if(!lines.length)return null;
 const head=/^(ingredients?|what you(?:'|’)ll need|directions?|instructions?|method|preparation|how to make|steps|notes?|tips)(\s*[:\-])?$/i;
 const amount=/^(?:[-*]\s*)?(?:(?:\d+[\d\s./-]*|[½⅓⅔¼¾⅛⅜⅝⅞]|one|two|three|a|an|pinch|dash|handful)\s*)?(?:cup|tsp|tbsp|tablespoon|teaspoon|oz|ounce|lb|pound|g|gram|ml|liter|clove|stick|package|can|pinch|dash|egg|flour|sugar|milk|butter)\b/i;
 const step=/^(?:step\s*)?\d{1,2}[.):-]\s*|^(?:preheat|mix|combine|stir|add|place|heat|bake|cook|pour|whisk|simmer|bring|serve|sprinkle|fold|grease|let|set|cut|chop|beat|spread|remove)\b/i;
 const title=lines.find(x=>x.length>3&&!head.test(x)&&!/^recipe\b/i.test(x)&&x.length<110)||lines[0];
 let section='unknown',ingredients=[],steps=[],tips=[],unknown=[];
 for(let i=0;i<lines.length;i++){
  let line=lines[i];if(line===title&&i<3)continue;
  const h=line.match(head);if(h){section=/ingredient|need/i.test(h[1])?'ingredients':/tip|note/i.test(h[1])?'tips':'steps';continue;}
  if(/^\b(serves|servings?|prep time|cook time|total time|yield)\s*[:=]/i.test(line))continue;
  if(section==='ingredients'){ingredients.push(line.replace(/^[-*]\s*/,''));continue;}
  if(section==='steps'){steps.push(line.replace(/^(?:step\s*)?\d+[.):\-]\s*/i,''));continue;}
  if(section==='tips'){tips.push(line);continue;}
  if(amount.test(line)){ingredients.push(line.replace(/^[-*]\s*/,''));continue;}
  if(step.test(line)){steps.push(line.replace(/^(?:step\s*)?\d+[.):\-]\s*/i,''));continue;}
  unknown.push(line);
 }
 // Preserve any unclassified text rather than quietly throwing away scanned instructions.
 if(!steps.length&&unknown.length)steps=unknown;
 else if(unknown.length)tips.push('Please check this unclassified scanned text: '+unknown.join(' / '));
 const servings=(raw.match(/\b(?:serves|servings|yield)\s*[:=]?\s*(\d+\s*(?:servings|people|portions)?)/i)||[])[1]||'';
 return {name:title.slice(0,140),description:'Saved from a photographed recipe. Check the transcription before saving.',category:'Other',prepMinutes:0,cookMinutes:0,servings,ingredients,steps,tips};
}
async function importPhoto(file){
 if(!file)return;
 if(!file.type.startsWith('image/')){toast('Choose a picture of a recipe.');return;}
 if(file.size>12_000_000){toast('Please choose an image smaller than 12 MB.');return;}
 if(importing)return;
 importing=true;
 const statusEl=document.getElementById('scan-status');const preview=document.getElementById('scan-preview');
 let previewUrl='';
 if(preview){previewUrl=URL.createObjectURL(file);preview.src=previewUrl;preview.classList.add('show');}
 const update=(msg,pct)=>{if(statusEl)statusEl.innerHTML=`<strong>${esc(msg)}</strong>${typeof pct==='number'?`<progress value="${Math.max(0,Math.min(100,pct))}" max="100"></progress>`:''}`;};
 let worker;
 try{
  if(!navigator.onLine&&!window.Tesseract)throw Error('Connect to the internet to load the text reader for the first time.');
  update('Getting the text reader ready…',4);
  const reader=await loadOcr();
  worker=await reader.createWorker('eng',1,{logger:m=>{if(m.status==='recognizing text')update('Reading your recipe…',Math.round((m.progress||0)*100));}});
  update('Reading the photo…',15);
  const result=await worker.recognize(file);
  const text=result?.data?.text||'';
  if(text.trim().length<10)throw Error('I could not read enough text from that photo. Try brighter light, a flatter angle, or a closer picture.');
  draft=parseScannedRecipe(text);if(!draft)throw Error('No recipe text was found.');
  draftSource='photo';editingId=null;mode='manual';
  renderAdd();toast('Photo read! Check the recipe before saving.');
 }catch(err){update(err.message||'Could not read that image. Try another photo or enter it manually.');}
 finally{if(worker){try{await worker.terminate();}catch{}}importing=false;if(previewUrl)URL.revokeObjectURL(previewUrl);}
}
function exportRecipes(){const content=JSON.stringify({app:'our-recipe-box',version:1,exportedAt:new Date().toISOString(),recipes},null,2);const url=URL.createObjectURL(new Blob([content],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='our-recipe-box-backup-'+new Date().toISOString().slice(0,10)+'.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2500);toast('Backup exported');}
async function restoreFile(file){if(!file)return;try{if(file.size>8_000_000)throw Error('Backup is too large.');const parsed=JSON.parse(await file.text());if(parsed.app!=='our-recipe-box'||!Array.isArray(parsed.recipes))throw Error('This is not an Our Recipe Box backup.');let n=0;for(const r of parsed.recipes){if(!r.id||!r.name||!Array.isArray(r.ingredients)||!Array.isArray(r.steps))continue;const old=recipes.find(x=>x.id===r.id);if(!old||(r.updatedAt||'')>(old.updatedAt||'')){recipes=recipes.filter(x=>x.id!==r.id);recipes.push(r);addPending('upsert',r);n++;}}save();syncNow();render();toast(`${n} recipe${n===1?'':'s'} restored`);}catch(e){toast(e.message||'Could not import backup');}}
function deleteRecipe(id){const r=recipes.find(x=>x.id===id);if(!r)return;if(!confirm(`Delete “${r.name}”? This also removes it from your shared recipe box.`))return;recipes=recipes.filter(x=>x.id!==id);save();addPending('delete',id);delete checks[id];localStorage.setItem(CHECKS,JSON.stringify(checks));syncNow();navigate('home');toast('Recipe deleted');}
main.addEventListener('click',e=>{const nav=e.target.closest('[data-nav]');if(nav){navigate(nav.dataset.nav);return;}const fav=e.target.closest('[data-favorite]');if(fav){doFavorite(fav.dataset.favorite);return;}const open=e.target.closest('[data-open]');if(open){location.hash='#recipe/'+encodeURIComponent(open.dataset.open);route();return;}const cat=e.target.closest('[data-cat]');if(cat){category=cat.dataset.cat;renderLibrary();return;}const edit=e.target.closest('[data-edit]');if(edit){const r=recipes.find(x=>x.id===edit.dataset.edit);if(r){editingId=r.id;draft={...r};mode='manual';location.hash='#add';renderAdd();}return;}const del=e.target.closest('[data-delete]');if(del){deleteRecipe(del.dataset.delete);return;}
 if(e.target.closest('#share-recipe'))shareRecipe();
 if(e.target.closest('#clear-checks')){checks[selectedId]={ingredients:[],steps:[]};localStorage.setItem(CHECKS,JSON.stringify(checks));renderRecipe();toast('Checks cleared');}
 if(e.target.closest('#tab-manual')||e.target.closest('#switch-manual')){mode='manual';draft=null;draftSource='';renderAdd();}
 if(e.target.closest('#tab-link')){mode='link';draft=null;draftSource='';renderAdd();}
 if(e.target.closest('#tab-photo')){mode='photo';draft=null;draftSource='';renderAdd();}
 if(e.target.closest('#setup-sync'))navigate('settings');
 if(e.target.closest('#sync-now')){syncNow();toast('Checking for updates…');}
 if(e.target.closest('#disconnect')){if(!confirm('Switch to local-only mode on this phone? Your recipes stay saved here.'))return;config={apiUrl:'',code:'',syncedOnce:false};save();status('local');renderSettings();}
 if(e.target.closest('#export-recipes'))exportRecipes();
});
main.addEventListener('input',e=>{if(e.target.id==='recipe-search'){query=e.target.value;const all=(view==='favorites'?recipes.filter(x=>x.favorite):recipes);const filtered=all.filter(r=>(category==='All'||r.category===category)&&(!query||[r.name,r.category,r.description,...(r.ingredients||[])].join(' ').toLowerCase().includes(query.toLowerCase()))).sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||''));const region=document.getElementById('recipes-region');if(region)region.innerHTML=filtered.length?`<div class="recipe-grid">${filtered.map(card).join('')}</div>`:'<div class="empty"><h3>No recipes found</h3><p>Try another search.</p></div>';}});
main.addEventListener('change',e=>{const target=e.target;if(target.dataset.check){setChecks(target.dataset.check,Number(target.dataset.index),target.checked);if(target.dataset.check==='ingredient')target.nextElementSibling?.classList.toggle('checked',target.checked);}if(target.id==='restore-file')restoreFile(target.files?.[0]);if(target.id==='recipe-photo-camera'||target.id==='recipe-photo-library')importPhoto(target.files?.[0]);});
main.addEventListener('submit',async e=>{if(e.target.id==='link-form'){e.preventDefault();await importUrl(document.getElementById('import-url').value.trim());}
 if(e.target.id==='recipe-form'){e.preventDefault();const fd=new FormData(e.target);const data={name:str(fd.get('name')),description:str(fd.get('description')),category:str(fd.get('category'))||'Other',emoji:str(fd.get('emoji'))||EMOJI[str(fd.get('category'))]||'🍲',prepMinutes:Number(fd.get('prepMinutes'))||0,cookMinutes:Number(fd.get('cookMinutes'))||0,servings:str(fd.get('servings')),ingredients:asList(fd.get('ingredients')),steps:asList(fd.get('steps')),tips:asList(fd.get('tips')),sourceUrl:validUrl(str(fd.get('sourceUrl'))),photoUrl:imgUrl(str(fd.get('photoUrl')))};if(!data.name||!data.ingredients.length||!data.steps.length){toast('Name, ingredients and steps are required.');return;}saveRecipe(data);}
 if(e.target.id==='connection-form'){e.preventDefault();const fd=new FormData(e.target);const apiUrl=validUrl(str(fd.get('apiUrl')));const code=str(fd.get('code'));if(!apiUrl||!apiUrl.startsWith('https://')||!code){toast('Use a secure HTTPS address and family access code.');return;}const changed=apiUrl!==config.apiUrl||code!==config.code;config={apiUrl,code,syncedOnce:changed?false:config.syncedOnce};save();await syncNow();if(syncStatus==='connected')toast('Family recipe box connected!');}
});
document.getElementById('home-button').addEventListener('click',()=>navigate('home'));
document.getElementById('settings-button').addEventListener('click',()=>navigate('settings'));
document.querySelector('.bottom-nav').addEventListener('click',e=>{const item=e.target.closest('[data-nav]');if(item)navigate(item.dataset.nav);});
window.addEventListener('hashchange',route);
window.addEventListener('online',()=>syncNow());
document.addEventListener('visibilitychange',()=>{if(!document.hidden)syncNow();});
setInterval(()=>{if(!document.hidden)syncNow();},45000);
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
const params=new URLSearchParams(location.search);const sharedLink=params.get('url')||params.get('text')||params.get('share');if(sharedLink&&validUrl(sharedLink)){window._incomingUrl=sharedLink;location.hash='#add';mode='link';}
status(config.apiUrl?'local':'local');if(!hadSaved)save();route();if(config.apiUrl&&config.code)syncNow();
})();
