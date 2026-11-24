import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const watchdog=setTimeout(()=>{console.error('Browser suite timed out before completion');process.exit(1)},120000);watchdog.unref();
const { chromium, webkit } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const resultDir = process.env.TEST_OUTPUT || path.join(root, 'test-results');
await mkdir(resultDir, { recursive: true });
const mime = { '.js':'text/javascript', '.css':'text/css', '.html':'text/html', '.png':'image/png', '.webmanifest':'application/manifest+json' };
const server = http.createServer(async (req,res) => {
  let name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/(?:mfm-oracle|other-oracle)\//, '');
  if (!name || name.endsWith('/')) name += 'index.html';
  const file = path.resolve(root,name);
  if (!file.startsWith(root+path.sep)) {res.writeHead(403).end();return;}
  try {res.writeHead(200, {'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'}).end(await readFile(file));}
  catch {res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
const url=origin+'/mfm-oracle/';
const engine=process.env.BROWSER_ENGINE==='webkit'?webkit:chromium;
const browser=await engine.launch({headless:true,timeout:20000,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
let passed=0;
const results=[];
async function check(name,fn){try {await fn();passed++;results.push(name);console.log(`PASS ${name}`);} catch(error) {console.error(`FAIL ${name}`, error);throw error;}}
async function context(options={}){const c=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,reducedMotion:'reduce',...options});c.setDefaultTimeout(12000);c.setDefaultNavigationTimeout(12000);return c;}
async function ready(page){await page.goto(url);await page.waitForFunction(()=>document.querySelector('#offlineStatus').dataset.ready==='true');}
async function reveal(page){await page.locator('#consult').click();await page.waitForFunction(()=>document.querySelector('#answer').textContent.length>0);return page.locator('#answer').textContent();}
async function sensor(page,x){await page.evaluate(value=>{const event=new Event('devicemotion');Object.defineProperty(event,'acceleration',{value:{x:value,y:0,z:0}});window.dispatchEvent(event)},x);}
async function shake(page){await sensor(page,14);await sensor(page,0);await page.waitForTimeout(110);await sensor(page,-15);}
try {
  const c=await context({reducedMotion:'no-preference'});const p=await c.newPage();const errors=[];const requests=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>requests.push(r.url()));
  await check('3D reveal, rapid tap lock, French answer and no immediate repeat',async()=>{
    await ready(p);await p.screenshot({path:path.join(resultDir,'mobile-idle.png'),fullPage:true});
    await p.locator('#consult').click();assert.equal(await p.locator('#consult').isDisabled(),true);
    await p.evaluate(()=>{for(let i=0;i<10;i++)document.querySelector('#ball').click()});
    await p.waitForFunction(()=>document.querySelector('#answer').textContent.length>0);
    const first=await p.locator('#answer').textContent();assert.ok(first.length>0);assert.equal(await p.locator('#consult').isDisabled(),false);
    const second=await reveal(p);assert.notEqual(second,first);
    await p.screenshot({path:path.join(resultDir,'mobile-answer.png'),fullPage:true});
    assert.deepEqual(errors,[]);assert.ok(requests.every(r=>r.startsWith(origin)));
  });
  await check('All PWA assets cached, standalone manifest and offline query launch',async()=>{
    const manifest=await p.evaluate(async()=>fetch('./manifest.webmanifest').then(r=>r.json()));assert.equal(manifest.display,'standalone');assert.equal(manifest.start_url,'./');
    const keys=await p.evaluate(async()=>{const names=await caches.keys();return (await(await caches.open(names.find(n=>n.includes('/mfm-oracle/')))).keys()).map(r=>r.url)});assert.equal(keys.length,10);
    await c.setOffline(true);await p.goto(url+'?source=gift');await p.waitForFunction(()=>document.querySelector('#offlineStatus').dataset.ready==='true');
    assert.match(await p.locator('#offlineStatus').textContent(),/Hors ligne/);assert.ok(await reveal(p));await c.setOffline(false);
  });
  await check('Install dialog, Escape, and focus restoration',async()=>{
    await p.locator('#install').click();assert.equal(await p.locator('#installDialog').isVisible(),true);
    await p.keyboard.press('Escape');assert.equal(await p.locator('#installDialog').isVisible(),false);
    assert.equal(await p.evaluate(()=>document.activeElement.id),'install');
  });
  await check('Responsive layout 320–1280px without horizontal clipping',async()=>{
    for(const width of [320,360,390,430,768,1280]){await p.setViewportSize({width,height:844});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow at ${width}`);}
    await p.screenshot({path:path.join(resultDir,'desktop.png'),fullPage:true});
  });
  await c.close();
  await check('Reduced motion finishes promptly and rare answer remains accessible',async()=>{
    const c=await context();await c.addInitScript(()=>{Math.random=()=>0});const p=await c.newPage();await ready(p);const t=Date.now();
    const text=await reveal(p);assert.ok(Date.now()-t<1000);assert.equal(text,'Le colloque finit à l’heure !');assert.equal(await p.locator('#answerKind').textContent(),'MIRACLE STATISTIQUE');await c.close();
  });
  await check('iPhone motion permission, two-peak shake, cooldown, toggle and no duplicate listener',async()=>{
    const c=await context();await c.addInitScript(()=>{window.permissionCalls=0;window.DeviceMotionEvent=class{static requestPermission(){window.permissionCalls++;window.permissionWasGesture=navigator.userActivation.isActive;return Promise.resolve('granted')}}});
    const p=await c.newPage();await ready(p);await p.locator('#motion').click();assert.equal(await p.locator('#motion').getAttribute('aria-pressed'),'true');assert.equal(await p.evaluate(()=>window.permissionWasGesture),true);
    await sensor(p,0);await sensor(p,14);await sensor(p,0);await p.waitForTimeout(100);assert.equal(await p.locator('#answer').textContent(),'');await sensor(p,-15);await p.waitForFunction(()=>document.querySelector('#answer').textContent.length>0);const answer=await p.locator('#answer').textContent();
    await shake(p);assert.equal(await p.locator('#answer').textContent(),answer);
    await p.locator('#motion').click();await p.waitForTimeout(1900);await shake(p);assert.equal(await p.locator('#answer').textContent(),answer);
    await p.locator('#motion').click();await shake(p);await p.waitForFunction(previous=>document.querySelector('#answer').textContent!==previous,answer);assert.equal(await p.evaluate(()=>window.permissionCalls),2);await c.close();
  });
  for(const permission of ['denied','throw','missing'])await check(`Motion ${permission}: tap fallback works`,async()=>{
    const c=await context();await c.addInitScript(mode=>{window.DeviceMotionEvent=mode==='missing'?undefined:class{static requestPermission(){return mode==='throw'?Promise.reject(Error('blocked')):Promise.resolve('denied')}}},permission);
    const p=await c.newPage();await ready(p);await p.locator('#motion').click();assert.equal(await p.locator('#motion').getAttribute('aria-pressed'),'false');assert.ok((await p.locator('#motionStatus').textContent()).length>0);assert.ok(await reveal(p));await c.close();
  });
  await check('Graphics fallback still renders and reveals answers',async()=>{
    const c=await context();await c.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){if(type.includes('webgl'))return null;return original.call(this,type,...args)}});const p=await c.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));await ready(p);assert.ok(await reveal(p));assert.deepEqual(errors,[]);await p.screenshot({path:path.join(resultDir,'fallback.png'),fullPage:true});await c.close();
  });
  await check('Separate app scopes retain independent offline caches',async()=>{
    const c=await context();const p=await c.newPage();await ready(p);await p.goto(origin+'/other-oracle/');await p.waitForFunction(()=>document.querySelector('#offlineStatus').dataset.ready==='true');const keys=await p.evaluate(()=>caches.keys());assert.ok(keys.some(k=>k.includes('/mfm-oracle/')));assert.ok(keys.some(k=>k.includes('/other-oracle/')));await c.setOffline(true);await p.goto(url);assert.ok(await reveal(p));await c.close();
  });
  console.log(`\n${passed} browser checks passed. Screenshots: ${resultDir}`);
} finally {const shutdown=setTimeout(()=>{console.error('Browser shutdown timed out');process.exit(1)},5000);await browser.close();server.close();clearTimeout(shutdown);}
