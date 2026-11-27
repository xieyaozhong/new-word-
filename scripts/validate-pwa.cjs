'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const swSource = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const updaterSource = fs.readFileSync(path.join(root, 'pwa-updates.js'), 'utf8');
const scope = 'https://example.test/new-word-/';
const version = '2026.11.27.3';
const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
class Events {
  constructor() { this.listeners = {}; }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  emit(type, event = {}) { for (const fn of this.listeners[type] || []) fn(event); }
}

async function testWorker() {
  const self = new Events(), cacheData = new Map(), deleted = [], core = [];
  const prefix = 'pocket-aquarium:' + encodeURIComponent(scope) + ':';
  let offline = false, skipped = 0, claimed = 0, responseText = 'online';
  const cache = {addAll:async requests => { core.push(...requests); }, put:async (key, value) => cacheData.set(typeof key === 'string' ? key : key.url, value), match:async key => cacheData.get(typeof key === 'string' ? key : key.url)};
  Object.assign(self, {registration:{scope}, location:{origin:'https://example.test'}, clients:{claim:async () => { claimed++; }}, skipWaiting:async () => { skipped++; }});
  const context = vm.createContext({self, URL, Request, Response, caches:{open:async () => cache, keys:async () => [prefix + version, prefix + 'old', 'other-project', 'pocket-aquarium-v1'], delete:async key => { deleted.push(key); }}, fetch:async () => { if (offline) throw Error('offline'); return new Response(responseText); }});
  vm.runInContext(swSource, context);
  async function emit(type, extra = {}) { const waits = []; let response; self.emit(type, {...extra, waitUntil:p => waits.push(p), respondWith:p => { response = p; }}); if (response) response = await response; await Promise.all(waits); return response; }
  await emit('install');
  assert.equal(skipped, 0, 'install must wait for client save');
  assert(core.some(request => request.url.endsWith('/pwa-updates.js')));
  assert(core.every(request => request.cache === 'reload'));
  await emit('activate');
  assert.deepEqual(deleted, [prefix + 'old'], 'only this scope caches may be removed');
  assert.equal(claimed, 1);
  let reply;
  await emit('message', {source:{url:scope}, data:{type:'AQUARIUM_VERSION_REQUEST'}, ports:[{postMessage:data => { reply = data; }}]});
  assert.equal(reply.version, version);
  await emit('message', {source:{url:'https://example.test/other/'}, data:{type:'AQUARIUM_ACTIVATE', version}});
  assert.equal(skipped, 0);
  await emit('message', {source:{url:scope}, data:{type:'AQUARIUM_ACTIVATE', version}});
  assert.equal(skipped, 1);
  const navigation = {url:scope + '?invite=private-code', method:'GET', mode:'navigate'};
  // Node's Request does not construct navigate-mode requests, so use a clone
  // adapter only in this service worker environment.
  context.Request = class extends Request { constructor(input, init) { super(typeof input === 'object' && !(input instanceof Request) ? input.url : input, init); } };
  await emit('fetch', {request:navigation});
  assert(cacheData.has(scope + 'index.html'));
  assert(!cacheData.has(navigation.url), 'do not cache invitation URLs');
  responseText = 'giant lab';
  await emit('fetch', {request:{...navigation, url:scope + 'giant-lab.html?mode=all'}});
  assert.equal(await cacheData.get(scope + 'index.html').clone().text(), 'online', 'lab navigation must not overwrite main shell');
  assert.equal(await cacheData.get(scope + 'giant-lab.html').clone().text(), 'giant lab');
  offline = true;
  const page = await emit('fetch', {request:{...navigation, url:scope + '?offline=1'}});
  assert.equal(await page.text(), 'online');
  const lab = await emit('fetch', {request:{...navigation, url:scope + 'giant-lab.html?offline=1'}});
  assert.equal(await lab.text(), 'giant lab', 'offline lab uses its own canonical page');
  const missingLab = await emit('fetch', {request:{...navigation, url:scope + 'shark-lab.html'}});
  assert.equal(missingLab.status, 503, 'uncached lab must not fall back to the main aquarium');
  const script = await emit('fetch', {request:new Request(scope + 'missing.js')});
  assert.equal(script.type, 'error', 'missing assets must not receive HTML fallback');
  assert.equal(await emit('fetch', {request:new Request('https://example.test/other/index.html')}), undefined, 'ignore other GitHub Pages projects');
  return 13;
}

function makeUpdater(options = {}) {
  const window = new Events(), document = new Events(), sw = new Events(), reg = new Events();
  const timers = new Map(), storage = options.storage || new Map(), notices = [];
  let serial = 0, saves = 0, reloads = 0, activations = 0, updates = 0, busy = !!options.busy, saveResult = options.saveResult !== false;
  let registeredOptions, replaced = '';
  class Channel { constructor() { const one = {onmessage:null, close() {}}, two = {close() {}, postMessage:data => Promise.resolve().then(() => one.onmessage?.({data}))}; this.port1 = one; this.port2 = two; } }
  function worker(build) { const w = new Events(); w.state = 'installed'; w.postMessage = (data, ports) => {
    if (data.type === 'AQUARIUM_VERSION_REQUEST') ports[0].postMessage({type:'AQUARIUM_VERSION', version:build});
    if (data.type === 'AQUARIUM_ACTIVATE') { activations++; reg.waiting = null; sw.controller = w; Promise.resolve().then(() => sw.emit('controllerchange')); }
  }; return w; }
  sw.controller = options.active === false ? null : worker(options.active || '2026.11.24.1');
  reg.waiting = options.waiting === false ? null : worker(options.waiting || version);
  reg.installing = null; reg.update = async () => { updates++; };
  sw.register = async (url, opts) => { registeredOptions = opts; assert.equal(url, scope + 'sw.js'); return reg; };
  Object.assign(document, {baseURI:scope, visibilityState:'visible', readyState:'loading'});
  window.aquariumUpdateHooks = {build:options.build || '2026.11.24.1', enabled:true, ready:() => true, busy:() => busy, save:async () => { saves++; if (options.busyDuringSave) busy = true; return saveResult; }, notify:message => notices.push(message)};
  const location = {href:options.href || scope, reload:() => { reloads++; }, replace:href => { replaced = href; reloads++; }};
  const sessionStorage = {getItem:key => { if (options.blockStorage) throw Error('blocked'); return storage.get(key) || null; }, setItem:(key, value) => { if (options.blockStorage) throw Error('blocked'); storage.set(key, value); }};
  const navigator = {serviceWorker:sw, onLine:true};
  const context = vm.createContext({window, document, navigator, location, sessionStorage, URL, MessageChannel:Channel, setTimeout:(fn, ms) => { const id = ++serial; timers.set(id, {fn, ms}); return id; }, clearTimeout:id => timers.delete(id), setInterval:(fn, ms) => { const id = ++serial; timers.set(id, {fn, ms, interval:true}); return id; }});
  vm.runInContext(updaterSource, context);
  return {window, document, sw, reg, storage, timers, navigator, notices, worker,
    get counts() { return {saves, reloads, activations, updates}; }, get registeredOptions() { return registeredOptions; }, get replaced() { return replaced; },
    setBusy:value => { busy = value; }, setSave:value => { saveResult = value; },
    async retry() { for (const [id, timer] of [...timers]) if (timer.ms === 5000) { timers.delete(id); timer.fn(); } await flush(); },
    async check() { await window.aquariumPWA.check(true); await flush(); }
  };
}

async function testUpdater() {
  const busy = makeUpdater({busy:true}); await busy.check();
  assert.equal(busy.registeredOptions.updateViaCache, 'none');
  assert.deepEqual(busy.counts, {saves:0, reloads:0, activations:0, updates:1});
  busy.setBusy(false); await busy.retry(); await busy.retry();
  assert.equal(busy.counts.activations, 1); assert.equal(busy.counts.reloads, 1);
  assert(busy.counts.saves >= 2, 'save before activation and again immediately before reload');
  busy.sw.emit('controllerchange'); await flush(); assert.equal(busy.counts.reloads, 1);
  const failed = makeUpdater({saveResult:false}); await failed.check();
  assert.equal(failed.counts.activations, 0); assert.equal(failed.counts.reloads, 0);
  failed.setSave(true); await failed.retry(); await failed.retry(); assert.equal(failed.counts.reloads, 1);
  const first = makeUpdater({build:version, active:false, waiting:version}); await first.check(); await first.retry();
  assert.equal(first.counts.reloads, 0, 'first install/current build must not reload');
  const freshPage = makeUpdater({build:version, active:'2026.11.24.1', waiting:false}); await freshPage.check();
  assert.equal(freshPage.counts.reloads, 0, 'new network HTML must not downgrade to its old controller');
  const staleWaiting = makeUpdater({build:version, active:'2026.11.24.1', waiting:'2026.11.24.2'}); await staleWaiting.check();
  assert.equal(staleWaiting.counts.activations, 0, 'do not activate an older waiting worker');
  const interruptedSave = makeUpdater({busyDuringSave:true}); await interruptedSave.check();
  assert.equal(interruptedSave.counts.activations, 0, 'recheck busy state after awaiting save');
  assert.equal(interruptedSave.counts.reloads, 0);
  const stale = makeUpdater({storage:busy.storage, active:version, waiting:false}); await stale.check();
  assert.equal(stale.counts.reloads, 0, 'one attempt per version prevents reload loops');
  const blocked = makeUpdater({blockStorage:true, active:version, waiting:false}); await blocked.check();
  assert.equal(new URL(blocked.replaced).searchParams.get('__aquarium_update'), version);
  const blockedAgain = makeUpdater({blockStorage:true, active:version, waiting:false, href:blocked.replaced}); await blockedAgain.check();
  assert.equal(blockedAgain.counts.reloads, 0, 'URL fallback also prevents loops');
  const anotherTab = makeUpdater({busy:true, waiting:false}); await anotherTab.check();
  anotherTab.sw.controller = anotherTab.worker(version); anotherTab.sw.emit('controllerchange'); await flush();
  assert.equal(anotherTab.counts.reloads, 0); anotherTab.setBusy(false); await anotherTab.retry(); assert.equal(anotherTab.counts.reloads, 1);
  const triggers = makeUpdater({build:version, active:version, waiting:false});
  triggers.window.emit('load'); await flush(); const initial = triggers.counts.updates;
  triggers.document.emit('visibilitychange'); await flush(); triggers.window.emit('online'); await flush();
  for (const timer of triggers.timers.values()) if (timer.interval) timer.fn(); await flush();
  assert(triggers.counts.updates >= initial + 3, 'startup, foreground, online and periodic checks');
  assert.equal(triggers.counts.reloads, 0);
  return 18;
}

(async () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8'));
  assert.deepEqual([manifest.id, manifest.start_url, manifest.scope], ['./', './', './']);
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert(html.includes("APP_BUILD = '" + version + "'") || html.includes("APP_BUILD='" + version + "'"));
  assert(html.includes('src="pwa-updates.js"'));
  const n = await testWorker() + await testUpdater();
  console.log('PWA validation passed: ' + n + ' worker/update scenarios; manifest identity unchanged.');
})().catch(error => { console.error(error); process.exitCode = 1; });
