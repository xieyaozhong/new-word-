'use strict';

// Exercise the real game definitions in a Node VM. Browser boot, networking,
// animation frames and persistent storage are deliberately not started.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const args = process.argv.slice(2), fixtureIndex = args.indexOf('--fixture');
const fixturePath = fixtureIndex >= 0 ? path.resolve(args[fixtureIndex + 1] || '.qa/transfer-fixture.json') : '';
const sourceArgument = args.find((value, index) => value !== '--fixture' && (fixtureIndex < 0 || index !== fixtureIndex + 1));

let drawingCalls = 0;
let drawingLabel = '';
let strictDrawing = false;
const drawingWarnings = new Set();
function canvasContext() {
  const numeric = new Set(['arc', 'arcTo', 'ellipse', 'moveTo', 'lineTo', 'bezierCurveTo', 'quadraticCurveTo', 'translate', 'rotate', 'scale', 'setTransform', 'transform', 'clearRect', 'fillRect', 'strokeRect', 'rect', 'roundRect']);
  const context = {canvas: null, getTransform: () => ({a:1,b:0,c:0,d:1,e:0,f:0}), measureText: text => ({width: String(text).length * 8}), getImageData: (x, y, w, h) => ({data: new Uint8ClampedArray(w * h * 4)})};
  for (const name of ['createLinearGradient', 'createRadialGradient', 'createConicGradient']) context[name] = (...args) => {
    assert(args.every(Number.isFinite), `${name}: non-finite gradient coordinates`);
    return {addColorStop: (offset, color) => {
      assert(Number.isFinite(offset) && offset >= 0 && offset <= 1, 'gradient stop outside range');
      assert.equal(typeof color, 'string', 'missing gradient color');
      assert(!/NaN|undefined/.test(color), `invalid gradient color: ${color}`);
    }};
  };
  return new Proxy(context, {get(target, property) {
    if (property in target) return target[property];
    if (typeof property !== 'string') return undefined;
    return (...args) => {
      drawingCalls++;
      if (numeric.has(property)) for (const value of args) {
        if (typeof value === 'number' && !Number.isFinite(value)) {
          if (strictDrawing) assert.fail(`${property}: non-finite canvas coordinate`);
          drawingWarnings.add(drawingLabel + ': ' + property);
        }
      }
    };
  }});
}
function element(tagName = 'div') {
  const listeners = new Map();
  const node = {
    tagName: tagName.toUpperCase(), width: 200, height: 116, children: [], dataset: {}, style: {}, attributes: {},
    textContent: '', innerHTML: '', value: '', scrollTop: 0, clientWidth: 800, clientHeight: 600, hidden: false,
    classList: {add() {}, remove() {}, toggle() {}, contains() { return false; }},
    append(...children) { this.children.push(...children); },
    appendChild(child) { this.children.push(child); return child; },
    replaceChildren(...children) { this.children = children; },
    insertBefore(child) { this.children.push(child); return child; },
    remove() {}, after() {}, focus() {}, blur() {}, click() {},
    setAttribute(name, value) { this.attributes[name] = String(value); },
    getAttribute(name) { return this.attributes[name] || ''; },
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener() {}, contains() { return false; },
    querySelector() { return null; }, querySelectorAll() { return []; },
    getBoundingClientRect() { return {x: 0, y: 0, left: 0, top: 0, width: 800, height: 600}; },
    getContext() { if (!this.context) { this.context = canvasContext(); this.context.canvas = this; } return this.context; },
  };
  return node;
}
const nodes = new Map();
const document = {
  querySelector(selector) { if (!nodes.has(selector)) nodes.set(selector, element(selector === '#tank' ? 'canvas' : 'div')); return nodes.get(selector); },
  getElementById(id) { return nodes.get('#' + id) || null; },
  querySelectorAll() { return []; }, createElement: element,
  createElementNS: (ns, tag) => element(tag), createTextNode: text => ({textContent: text}),
  addEventListener() {}, body: element('body'), documentElement: element('html'), activeElement: null,
};
const window = {addEventListener() {}, removeEventListener() {}, scrollTo() {}, innerWidth: 800, innerHeight: 600};
const context = vm.createContext({
  assert, console, document, window, navigator: {userAgent: 'Node validation'},
  location: {hostname: 'localhost', origin: 'http://localhost', pathname: '/', protocol: 'http:', hash: ''},
  localStorage: {getItem: () => null, setItem() {}, removeItem() {}},
  matchMedia: () => ({matches: false, addEventListener() {}}),
  getComputedStyle: () => ({getPropertyValue: () => '0px', paddingTop: '0px', paddingBottom: '0px'}),
  requestAnimationFrame() {}, cancelAnimationFrame() {}, setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, clearInterval() {},
  performance: {now: () => 0}, devicePixelRatio: 1, innerWidth: 800, innerHeight: 600,
  TextEncoder, TextDecoder, URL, URLSearchParams, Blob,
  btoa: text => Buffer.from(text, 'binary').toString('base64'), atob: text => Buffer.from(text, 'base64').toString('binary'),
  fetch() { throw new Error('Validation must not use the network'); },
  testCanvas: () => element('canvas'),
  testDrawingLabel: (label, strict) => { drawingLabel = label; strictDrawing = strict; },
  fixtureRequested: !!fixturePath,
  writeFixture: text => { fs.mkdirSync(path.dirname(fixturePath),{recursive:true}); fs.writeFileSync(fixturePath,text,'utf8'); console.log('Created opt-in QA fixture: ' + fixturePath); },
});

const htmlPath = sourceArgument ? path.resolve(sourceArgument) : path.resolve(__dirname, '..', 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(match => match[1]).filter(script => script.trim());
assert.equal(scripts.length, 1, 'Expected one inline game script');
let source = scripts[0];
const boot = 'window.claude?.hot?.ready ? window.claude.hot.ready(start) : start(window.claude?.hot?.data ?? {});';
assert(source.includes(boot), 'Game boot call changed; update the test entry point');
source = source.replace(boot, '// Boot disabled by the validation harness.');
const end = source.lastIndexOf('})();');
assert(end > 0, 'Missing game closure');
source = source.slice(0, end) + '\nglobalThis.validationDone = (' + runChecks.toString() + ')();\n' + source.slice(end);
new vm.Script(source, {filename: 'index.html inline game'}).runInContext(context, {timeout: 30000});
Promise.resolve(context.validationDone).then(() => {
  console.log(`Canvas smoke checks exercised ${drawingCalls.toLocaleString('en-US')} drawing calls (layout and pixels require browser QA).`);
  if (drawingWarnings.size) console.log('Existing-renderer diagnostics (outside expansion): ' + [...drawingWarnings].join(', '));
}, error => { console.error(error); process.exitCode = 1; });

async function runChecks() {
  const copy = value => JSON.parse(JSON.stringify(value));
  const reset = () => { state = migrate(newState()); state.light = {on: true, until: Date.now() + 3600000}; rt.temp = 25; countCache(); return state; };
  reset();
  let morphs = 0;
  for (const [key, species] of Object.entries(SPECIES)) {
    assert(['fish', 'inv'].includes(species.kind), key + ': unknown creature kind');
    assert(Array.isArray(PAL[key]) && PAL[key].length, key + ': missing palette');
    assert(Array.isArray(EXT[key]) && EXT[key].slice(0, 2).every(value => Number.isFinite(value) && value > 0), key + ': missing drawing bounds');
    assert.equal(species.morphs.length, PAL[key].length, key + ': morph/palette counts disagree');
    if (species.story) assert(STORY[species.story], key + ': missing story');
    if (species.special) assert(NPCS[species.npc], key + ': missing NPC');
    for (const condition of species.cond || []) assert(CONDS[condition], key + ': unknown condition ' + condition);
    for (let m = 0; m < PAL[key].length; m++) {
      testDrawingLabel(key, !!species.expansion);
      try { drawFishThumb(testCanvas(), key, palette(key, 11, m), 0, {puffK: 0}, .78); }
      catch (error) { throw new Error(`${key}, morph ${m}: ${error.message}`, {cause: error}); }
      morphs++;
    }
    const created = newCreature(key, {name: '驗證', m: 0});
    assert.equal(created.sp, key);
    assert.equal(palOf(created, 0)._m, 0);
  }
  console.log(`PASS: ${Object.keys(SPECIES).length} species, ${morphs} morphs, palettes, drawing bounds and thumbnail execution.`);
  for (const key of Object.keys(DSP)) { testDrawingLabel('deep:' + key, true); deepThumb(testCanvas(), key, true); }
  for (const key of Object.keys(GIANTS)) { testDrawingLabel('giant:' + key, true); giantThumb(testCanvas(), key, true); }
  testDrawingLabel('', false);
  console.log(`PASS: ${Object.keys(DSP).length} deep-sea creatures and ${Object.keys(GIANTS).length} giants render without invalid canvas coordinates.`);

  for (const [key, npc] of Object.entries(NPCS)) {
    assert(NPC_KEYS.includes(key), key + ': missing from visitor rotation');
    for (const item of npc.items || []) assert(SPECIES[item] || ITEMS[item] || DECOS[item] || item === 'feeder10', key + ': invalid inventory item ' + item);
    for (const item of npcAfter(key)) assert(SPECIES[item] || ITEMS[item] || DECOS[item], key + ': invalid unlocked inventory item ' + item);
  }
  for (const [key, quest] of Object.entries(STORY)) {
    assert(NPCS[quest.npc], key + ': unknown story NPC');
    assert(quest.ch.length > 0, key + ': empty story');
    if (quest.unlock) { assert(SPECIES[quest.unlock[0]], key + ': invalid reward species'); assert(quest.unlock[1] > 0, key + ': invalid reward count'); }
    for (const chapter of quest.ch) {
      assert(['check', 'pay', 'give', 'choice'].includes(chapter.type), key + ': invalid chapter type');
      if (chapter.type === 'check') {
        const progress = chapter.prog(chapter.base ? chapter.base() : {});
        assert(Array.isArray(progress) && progress.length === 2 && progress.every(Number.isFinite), key + ': invalid chapter progress');
      }
    }
  }
  console.log(`PASS: ${NPC_KEYS.length} NPC inventories and ${Object.keys(STORY).length} story definitions.`);

  // Older saves have none of the newly introduced state. Migration must retain
  // the player's money, fish identity, collected variants and completed quests.
  const legacy = newState();
  legacy.coins = 12345;
  legacy.story = {lin: {ch: 1, b: {n: 5}, n: 0, done: 0, pick: -1}};
  legacy.fish[0].name = '老朋友';
  legacy.fish[0].rare = Object.keys(RARES)[0];
  const oldId = legacy.fish[0].id;
  const migrated = migrate(copy(legacy));
  assert.equal(migrated.coins, 12345);
  assert.equal(migrated.fish[0].id, oldId);
  assert.equal(migrated.fish[0].name, '老朋友');
  assert.equal(migrated.fish[0].rare, legacy.fish[0].rare);
  assert.equal(migrated.story.lin.ch, 1);
  assert.equal(migrated.story.lin.b.n, 5);
  assert(migrated.dex.guppy && migrated.dex.neon && migrated.dex.cherry);
  assert.deepEqual(copy(migrate(copy(migrated))), copy(migrated), 'Migration must be stable across reloads');
  console.log('PASS: older save preserves coins, fish identity, collection and story progress; second migration is stable.');

  const expansionIds = ['celestialdanio','kubotai','espei','silvertip','blackneon','serpae','threadfin','forktail','honeygourami','pygmycory','peacockgoby','hillstream','vampirefan','pompomcrab','malaysiansnail','spixisnail','seedshrimp','asellus'];
  if (expansionIds.every(key => SPECIES[key])) {
    for (const key of expansionIds) {
      const species = SPECIES[key];
      assert(species.kind === 'fish' ? SHOP_FISH.includes(key) : INVS.includes(key), key + ': unavailable from standard shop catalog');
      reset();
      const creature = newCreature(key, {name: '新朋友', m: Math.max(0, species.morphs.length - 1)});
      state.fish = [creature]; dexAddTo(state, creature);
      const loaded = migrate(copy(state));
      assert.equal(loaded.fish[0].sp, key, key + ': removed on save load');
      assert.equal(loaded.fish[0].m, creature.m, key + ': morph lost on save load');
      assert(loaded.dex[key], key + ': dex lost on save load');
    }
    console.log('PASS: all 18 expansion creatures are in the shop catalog and survive save/reload with their morph and dex record.');
  } else console.log('PENDING: expansion species have not all been written yet.');

  reset();
  Object.assign(dexFilter, {query:' 孔雀魚 ', kind:'all', discovery:'all'});
  assert(dexMatches('sp', 'guppy', '魚'));
  assert(!dexMatches('sp', 'neon', '魚'));
  dexFilter.query = 'ＧＵＰＰＹ'; assert(dexMatches('sp', 'guppy', '魚'));
  dexFilter.query = '新夥伴 群游'; assert(dexMatches('sp', 'celestialdanio', '魚'));
  assert(!dexMatches('sp', 'vampirefan', '小生物'));
  dexFilter.query = ''; dexFilter.kind = 'deep'; assert(dexMatches('deep', 'barreleye', '深海'));
  assert(!dexMatches('sp', 'guppy', '魚'));
  dexFilter.discovery = 'found'; assert(!dexMatches('deep', 'barreleye', '深海'));
  state.deep.seen.barreleye = 1; assert(dexMatches('deep', 'barreleye', '深海'));
  dexFilter.kind = 'giant'; assert(!dexMatches('giant', 'kraken', '巨獸'));
  state.deep.gown.kraken = 1; assert(dexMatches('giant', 'kraken', '巨獸'));
  dexFilter.discovery = 'missing'; assert(!dexMatches('giant', 'kraken', '巨獸'));
  Object.assign(dexFilter, {query:'不存在xyz', kind:'all', discovery:'all'});
  assert(!Object.keys(SPECIES).some(k => dexMatches('sp', k, '魚')));
  Object.assign(dexFilter, {query:'', kind:'all', discovery:'all'});
  const grouped = new Set([...SHOP_FISH,...INVS,...SEASONAL,...MYSTERY,...SPECIALS,...WILD,...ALIENS,...STORYS,...MYTHS,...PESTS]);
  for (const k of Object.keys(SPECIES)) if (!SPECIES[k].hidden) assert(grouped.has(k), 'Dex missing species: ' + k);
  console.log('PASS: Chinese/English/fullwidth/multiple-keyword dex search, category/discovery filters, empty results and catalog coverage.');

  const originalNow = Date.now, originalRandom = Math.random;
  const fixedNow = originalNow(); Date.now = () => fixedNow; Math.random = () => .91;
  const event = key => { evCache = {k:dayKey(), v:key}; };
  reset(); W = 800; H = 600; U = DPR = 1; sandTop = 500; initRuntime();
  event(''); const dirt = dirtRate(); event('clearwater'); assert(Math.abs(dirtRate() - dirt * .7) < 1e-8);
  state.deco = []; state.museum = {}; event(''); assert.equal(tipAmount({score:100}), 300);
  event('openhouse'); assert.equal(tipAmount({score:100}), 450);
  function feedGrowth(ev) { event(ev); const d = newCreature('guppy', {grow:2, full:40}); const r = makeRunner(d, false), p = {k:'pellet', x:100,y:100}; rt.food = [p]; eatFood(r,p); return d.grow; }
  assert.equal(feedGrowth('nutrition') - feedGrowth(''), 1);
  state.region = {builtin:'taichung'}; applyRegion(state.region); const site = Object.keys(SITES)[0];
  function expedition(ev) { event(ev); state.trips = []; const d = newCreature('guppy', {name:'探險員', grow:GROW_MAX, full:90}); state.fish = [d]; initRuntime(); const risk = tripRisk(d,site); startTrip(d,site); assert.equal(state.trips.length,1); return {risk, coins:state.trips[0].out.coins}; }
  const ordinary = expedition(''), survey = expedition('survey');
  assert(Math.abs(survey.risk - ordinary.risk * .75) < 1e-8);
  assert(Math.abs(survey.coins - ordinary.coins * 1.3) <= 1);
  event(''); Math.random = originalRandom;
  console.log('PASS: new daily events change dirt accumulation, feeding growth, tips, expedition risk and rewards.');

  reset(); W = 800; H = 600; U = DPR = 1; sandTop = 500; initRuntime(); sheetKind = null;
  assert.equal(state.tankRooms.length,1); assert.equal(state.tankRooms[0].data,null);
  const originalWallet = state.coins; assert.equal(buyTank(),false); assert.equal(state.coins,originalWallet); assert.equal(state.tankRooms.length,1);
  state.coins = 750000;
  for (const expected of [50000,100000,200000,400000]) { assert.equal(tankPrice(), expected); const before = state.coins; assert.equal(buyTank(),true); assert.equal(state.coins,before-expected); }
  assert.equal(state.coins,0); assert.equal(state.tankRooms.length,5); assert.equal(buyTank(),false);
  const home = state.activeTank, second = state.tankRooms[1].id;
  state.coins = 12345; state.up.tank = 3; state.up.filter = 2; applyUpgrades(state.up);
  while (state.fish.length < 34) state.fish.push(newCreature('guppy',{name:'原缸',grow:GROW_MAX,full:80}));
  state.dirt = 37; state.theme = 'amazon'; state.themes.push('amazon'); initRuntime();
  const originalIds = state.fish.map(f=>f.id), originalDeco = copy(state.deco), sandValue = () => rt.coins.reduce((n,c)=>n+c.v,0), initialSand = sandValue();
  rt.testTransient = {fish:state.fish[0]};
  assert.equal(switchTank(second),true); assert.equal(state.fish.length,0); assert.equal(state.deco.length,0); assert.equal(state.dirt,0); assert.equal(state.up.tank,0); assert.equal(state.coins,12345); assert(!('testTransient' in rt));
  const newFish = newCreature('celestialdanio',{name:'第二缸夥伴'}); addCreature(newFish); state.deco.push(newDeco('rock')); state.up.tank = 1; applyUpgrades(state.up); state.dirt=6;
  assert.equal(switchTank(home),true); assert.deepEqual(state.fish.map(f=>f.id), originalIds); assert.deepEqual(copy(state.deco),originalDeco); assert.equal(state.dirt,37); assert.equal(state.up.tank,3); assert.equal(state.up.filter,2); assert.equal(state.theme,'amazon'); assert.equal(sandValue(),initialSand);
  assert.equal(switchTank(second),true); assert.equal(state.fish[0].id,newFish.id); assert.equal(state.up.tank,1); assert.equal(state.dirt,6);
  assert.equal(switchTank(home),true); assert.equal(sandValue(),initialSand);
  const saved = copy(serialize()); state=migrate(copy(saved)); initRuntime();
  assert.deepEqual(state.fish.map(f=>f.id),originalIds); assert.equal(state.tankRooms[1].data.fish[0].id,newFish.id); assert.equal(state.tankRooms[1].data.up.tank,1); assert.equal(MAXFISH,40);
  assert.deepEqual(copy(migrate(copy(state))),copy(state),'Multi-tank migration must be stable');
  state.tankRooms[1].data.t = fixedNow - 3600000; assert.equal(switchTank(second),true); const earned = sandValue(); assert(earned>0,'Away tank must earn offline coins');
  assert.equal(switchTank(home),true); assert.equal(switchTank(second),true); assert.equal(sandValue(),earned,'Switching twice must not repeat offline rewards');
  assert.equal(switchTank(home),true);
  const renderCard = renderFishCard; renderFishCard = () => {};
  const moveId = state.fish[0].id; assert.equal(transferFish(moveId,second),true); assert.equal(state.activeTank,second);
  assert.equal(state.fish.filter(f=>f.id===moveId).length,1); assert(!state.tankRooms.find(r=>r.id===home).data.fish.some(f=>f.id===moveId));
  assert.equal(state.coins,12345); assert(state.dex.guppy && state.dex.celestialdanio);
  sheetKind = null; assert.equal(switchTank(home),true);
  state.eggs.push({mom:{id:state.fish[0].id}, dad:{id:'dad'}, n:1});
  assert.equal(transferFish(state.fish[0].id,second),false,'Parent with pending eggs must stay'); state.eggs=[];
  const capacityData = cleanTankData({},state); capacityData.fish = Array.from({length:20},()=>newCreature('guppy',{name:'滿缸'})); assert(tankTransferReason(capacityData,state.fish[0])); applyUpgrades(state.up);
  // An expedition fish still owns its destination-tank slot. Moving another
  // fish into that slot would overflow on return and lose a fish at reload.
  capacityData.fish.pop();
  capacityData.trips = [{d:newCreature('guppy',{name:'出遊中'})}];
  assert(tankTransferReason(capacityData,state.fish[0]),'Expedition fish must reserve tank capacity');
  capacityData.trips = [];
  assert.equal(tankTransferReason(capacityData,state.fish[0]),'','The last free slot should accept a transfer');
  capacityData.fish = [];
  capacityData.trips = [{d:newCreature('betta',{name:'出遊鬥魚'})}];
  assert.equal(tankTransferReason(capacityData,newCreature('betta',{name:'另一隻鬥魚'})),'已達同種上限','Expedition fish must reserve its species limit');
  renderFishCard = renderCard;
  assert.equal(renameTank(home,'草原缸'),true); assert.equal(tankRoom().name,'草原缸'); assert.equal(renameTank(home,'   '),false);
  state.region = {builtin:'taichung'}; applyRegion(state.region);
  const awayRoom = state.tankRooms.find(r => r.id === second), traveler = newCreature('guppy',{name:'遠行朋友',grow:GROW_MAX,full:80});
  const returnSite = Object.keys(SITES)[0];
  awayRoom.data.t = fixedNow - 1000;
  awayRoom.data.trips = [{id:'regression-trip', site:returnSite, start:fixedNow-60000, end:fixedNow-1, d:traveler, out:{dead:0,coins:777,deco:'',friend:'asellus',sick:0,tale:0}}];
  assert.equal(state.trips.length,0);
  assert.equal(anyTankTrips(),true,'Inactive aquarium expeditions must block changing the shared region');
  const oldRegion = copy(state.region), oldSites = Object.keys(SITES), renderExpedition = renderExpo;
  renderExpo = () => {};
  setRegion(null);
  assert.deepEqual(copy(state.region),oldRegion,'Region must remain unchanged while another tank has an expedition');
  assert.deepEqual(Object.keys(SITES),oldSites,'The shared expedition map must remain unchanged');
  renderExpo = renderExpedition;
  const beforeReturnCoins = state.coins, beforeReturnCount = awayRoom.data.fish.length;
  Math.random = () => .91;
  assert.equal(switchTank(second),true);
  assert.equal(state.trips.length,0);
  assert.equal(state.fish.filter(f => f.id === traveler.id).length,1,'The expedition fish must return exactly once');
  assert.equal(state.fish.length,beforeReturnCount+2,'The returning fish and discovered creature must each be added once');
  assert.equal(state.coins,beforeReturnCoins+777,'The expedition reward must be paid once');
  assert.equal(anyTankTrips(),false);
  const returnedIds = state.fish.map(f => f.id);
  assert.equal(switchTank(home),true); assert.equal(switchTank(second),true);
  assert.deepEqual(state.fish.map(f => f.id),returnedIds,'Repeated switching must not duplicate the expedition fish or discovered creature');
  assert.equal(state.coins,beforeReturnCoins+777,'Repeated switching must not repeat expedition rewards');
  Math.random = originalRandom;
  Date.now = originalNow;
  console.log('PASS: high-price tank purchases, cap/funds guards, independent fish/decor/equipment, save/reload, one-time offline settlement, transfers, shared wallet/dex and transient cleanup.');
  console.log('PASS: inactive-tank expeditions block region changes and settle their fish, discovered creature and reward exactly once.');

  // Storage is intentionally absent from the browser stub above. Install a
  // deterministic storage model here to exercise failure and stale-tab paths.
  const storage = new Map(); let failStorageKey = '', dropStorageKey = '';
  localStorage.getItem = key => storage.has(key) ? storage.get(key) : null;
  localStorage.setItem = (key, value) => { if (key === failStorageKey) throw Error('quota_exceeded'); if (key !== dropStorageKey) storage.set(key, String(value)); };
  localStorage.removeItem = key => storage.delete(key);
  const freshSave = () => { storage.clear(); failStorageKey = dropStorageKey = ''; saveSuspended = storageConflict = false; saveError = ''; ownershipReady = false; lastLocalText = ''; docRef = null; writing = writeAgain = false; cloudDone = true; reset(); initRuntime(); assert(claimSaveOwnership()); markDirty(); assert(saveNow()); };
  freshSave();
  const firstStored = storage.get(LS_KEY), firstSavedAt = state.savedAt;
  state.coins += 17; markDirty(); failStorageKey = LS_KEY;
  assert.equal(saveNow(true),false); assert.equal(dirty,true); assert.equal(state.savedAt,firstSavedAt); assert.equal(storage.get(LS_KEY),firstStored); assert(saveError);
  failStorageKey = ''; assert(saveNow(true)); assert.equal(dirty,false); assert.equal(JSON.parse(storage.get(LS_KEY)).coins,state.coins);
  assert.equal(storage.get(SAVE_ROLLING_KEY),firstStored,'Automatic backup must contain the previous successfully persisted snapshot');
  const currentStored = storage.get(LS_KEY), currentRuntime = state;
  const imported = copy(state); imported.coins = 9999;
  failStorageKey = SAVE_BACKUP_KEY;
  assert.equal(persistSnapshot(imported,currentStored),false); assert.equal(storage.get(LS_KEY),currentStored); assert.equal(state,currentRuntime);
  failStorageKey = ''; dropStorageKey = LS_KEY;
  assert.equal(persistSnapshot(imported,currentStored),false,'A silent failed write must fail read-back verification'); assert.equal(storage.get(LS_KEY),currentStored);
  dropStorageKey = ''; assert(persistSnapshot(imported,currentStored)); assert.equal(state,currentRuntime,'persistSnapshot must not replace live state'); assert.equal(storage.get(SAVE_BACKUP_KEY),currentStored);
  state.coins += 1; markDirty(); assert(saveNow(true));
  assert.equal(storage.get(SAVE_BACKUP_KEY),currentStored,'Autosave must preserve the explicit pre-import restore point');
  const newerTab = copy(imported); newerTab.coins = 45678;
  storage.set(SAVE_OWNER_KEY,'new-tab-owner'); storage.set(LS_KEY,JSON.stringify(newerTab));
  onStorageChange({key:SAVE_OWNER_KEY,storageArea:localStorage});
  assert(saveSuspended && storageConflict); dirty = true;
  assert.equal(saveNow(true),false); assert.equal(JSON.parse(storage.get(LS_KEY)).coins,45678,'A stale pagehide save must not overwrite the newer tab');
  let cloudWrites = 0; docRef = {set:async () => { cloudWrites++; }}; await writeCloud(); assert.equal(cloudWrites,0,'A stale tab must not start cloud writes'); docRef = null;
  console.log('PASS: quota failures and silent writes retain dirty state; backups persist; stale tabs cannot overwrite local or cloud progress.');

  freshSave();
  const healthy = storage.get(LS_KEY), validBackup = copy(state); validBackup.coins = 4321; validBackup.savedAt += 100;
  storage.set(SAVE_ROLLING_KEY,JSON.stringify(validBackup)); storage.set(LS_KEY,'{broken json');
  const recovered = loadLocal(); assert.equal(recovered.coins,4321); assert.equal(storage.get(SAVE_RECOVERY_KEY),'{broken json');
  storage.set(LS_KEY,'{second broken json'); failStorageKey = SAVE_RECOVERY_KEY;
  assert(loadLocal()); assert(saveSuspended); assert.equal(saveNow(true),false,'Failed corruption preservation must block automatic overwrites'); assert.equal(storage.get(LS_KEY),'{second broken json');
  failStorageKey = ''; freshSave(); failStorageKey = SAVE_OWNER_KEY;
  assert.equal(claimSaveOwnership(),false); assert.equal(saveNow(true),false); assert.doesNotThrow(exportSaveText,'Storage-unavailable play must remain exportable'); failStorageKey = '';
  console.log('PASS: corrupt saves restore a valid backup while preserving evidence; blocked storage cannot be mistaken for a successful update checkpoint.');

  freshSave();
  state.coins = 750000; assert(buyTank()); assert(buyTank());
  const portable = exportSaveText(), exportState = copy(state), capacityBeforePreview = MAXFISH;
  const prepared = prepareSave(portable);
  assert.deepEqual(copy(saveSummary(prepared)),copy(saveSummary(exportState)),'Portable saves must preserve all tank and creature counts');
  assert.deepEqual(copy(state),exportState,'Import preview must not mutate the current game'); assert.equal(MAXFISH,capacityBeforePreview);
  assert.throws(() => prepareSave('{')); assert.throws(() => prepareSave('{"__proto__":{}}'));
  const future = copy(exportState); future.v = 99; assert.throws(() => prepareSave(JSON.stringify(future)));
  const unknown = copy(exportState); unknown.fish[0].sp = 'future-fish'; assert.throws(() => prepareSave(JSON.stringify(unknown)));
  const overflow = copy(exportState); overflow.fish = Array.from({length:100},()=>copy(exportState.fish[0])); assert.throws(() => prepareSave(JSON.stringify(overflow)),'Import must reject silent creature truncation');
  const duplicateTank = copy(exportState); duplicateTank.tankRooms[1].id = duplicateTank.tankRooms[0].id; assert.throws(() => prepareSave(JSON.stringify(duplicateTank)));
  assert.throws(() => prepareSave(portable.replace('"coins":600000','"coins":1e309')),'Non-finite imported money must be rejected');
  const renderSave = renderSavePanel; renderSavePanel = () => {};
  inspectImport(portable); assert(pendingImport); assert.equal(state.coins,exportState.coins);
  inspectImport('{bad'); assert.equal(pendingImport,null); assert.equal(state.coins,exportState.coins);
  inspectImport(portable); let reloads = 0; location.reload = () => { reloads++; };
  failStorageKey = LS_KEY; const beforeImportDisk = storage.get(LS_KEY); assert.equal(commitImport(),false); assert.equal(reloads,0); assert.equal(storage.get(LS_KEY),beforeImportDisk); assert.equal(state.coins,exportState.coins);
  failStorageKey = ''; assert.equal(commitImport(),true); assert.equal(reloads,1); assert(saveSuspended); assert.equal(dirty,false); assert.equal(prepareSave(storage.get(LS_KEY)).coins,exportState.coins); assert.equal(prepareSave(storage.get(SAVE_BACKUP_KEY)).coins,exportState.coins);
  const afterImportDisk = storage.get(LS_KEY); dirty = true; assert.equal(saveNow(true),false); assert.equal(storage.get(LS_KEY),afterImportDisk,'The pre-reload pagehide must not overwrite the imported snapshot');
  renderSavePanel = renderSave;
  console.log('PASS: portable multi-tank previews, malformed/future/unknown/truncated saves, transactional import failures and import reload protection.');

  async function cloudRace(change) {
    freshSave(); let resolveRemote; const originalState = state, remote = copy(state); remote.coins = 88888; remote.savedAt += 1000;
    const ref = {get:() => new Promise(resolve => { resolveRemote = resolve; }),set:async () => { cloudWrites++; }};
    window.claude = {use:async name => name === 'user' ? {id:async () => 'test-user'} : {doc:() => ref}};
    const pendingCloud = connectCloud();
    for (let i=0; i<12 && !resolveRemote; i++) await Promise.resolve();
    assert(resolveRemote,'Cloud test must reach its pending response'); change();
    resolveRemote({exists:true,data:() => remote}); await pendingCloud;
    assert.equal(state,originalState,'A stale cloud response must not replace the live state'); assert.notEqual(state.coins,88888); window.claude = undefined; docRef = null;
  }
  await cloudRace(() => { cloudEpoch++; });
  await cloudRace(() => { state.coins += 5; markDirty(); });
  await cloudRace(() => { storage.set(SAVE_OWNER_KEY,'other-owner'); });
  freshSave();
  const unreadableCloud = copy(state); unreadableCloud.v = 99; unreadableCloud.savedAt += 1000; cloudWrites = 0;
  window.claude = {use:async name => name === 'user' ? {id:async () => 'test-user'} : {doc:() => ({get:async () => ({exists:true,data:() => unreadableCloud}),set:async () => { cloudWrites++; }})}};
  await connectCloud(); markDirty(); assert(saveNow(true)); await Promise.resolve();
  assert.equal(docRef,null); assert.equal(cloudWrites,0,'An unsupported cloud save must never be overwritten by local autosave');
  window.claude = undefined;
  console.log('PASS: delayed cloud responses cannot overwrite an import generation, intervening gameplay or a new owner tab.');
  if (fixtureRequested) {
    state = migrate(newState()); state.region = {builtin:'taichung'}; state.coins = 81337; state.fish[0].name = '轉移測試魚';
    state.tankRooms[0].name = '轉移測試・原始缸';
    const schooling = cleanTankData({},state), small = cleanTankData({},state);
    schooling.fish = ['celestialdanio','kubotai','espei','threadfin'].map((sp,i) => newCreature(sp,{name:'群游夥伴'+(i+1),grow:18}));
    schooling.deco = [newDeco('rock'),newDeco('vallis')];
    small.fish = ['vampirefan','pompomcrab','malaysiansnail','spixisnail','seedshrimp','asellus'].map((sp,i) => newCreature(sp,{name:'生態夥伴'+(i+1),grow:18}));
    state.tankRooms.push({id:'qa-schooling',name:'轉移測試・群游缸',data:schooling},{id:'qa-creatures',name:'轉移測試・小生物缸',data:small});
    const now = Date.now(), D = deepS(); D.built = true; D.lv = 2; D.rp = 30000; D.rpT = now; D.lights = 1;
    D.seen = Object.fromEntries(Object.keys(DSP).map(key => [key,1]));
    D.list = Object.keys(DSP).slice(0,12).map((sp,i) => ({id:'qa-deep-'+i,sp,name:DSP[sp].name,at:now,seed:i+31,full:100}));
    D.gown = Object.fromEntries(Object.keys(GIANTS).map(key => [key,now])); D.gclue = Object.fromEntries(Object.keys(GIANTS).map(key => [key,3])); D.gseen = Object.fromEntries(Object.keys(GIANTS).map(key => [key,1])); D.gcur = 'kraken';
    state = migrate(state); applyRegion(state.region); initRuntime(); state.savedAt = now;
    const fixture = exportSaveText(); const checked = prepareSave(fixture);
    assert.equal(checked.tankRooms.length,3); assert.equal(checked.coins,81337); assert.equal(checked.deep.list.length,12);
    writeFixture(fixture);
  }
}
