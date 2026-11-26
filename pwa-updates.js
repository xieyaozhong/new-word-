/* Game-owned hooks: {build, enabled, ready(), busy(), save():Promise<boolean>, notify(message)}. */
(() => {
  'use strict';
  const hooks = window.aquariumUpdateHooks;
  if (!hooks || hooks.enabled === false || !hooks.build || !('serviceWorker' in navigator)) return;
  const scope = new URL('./', document.baseURI).href;
  const reloadKey = 'aquarium:update:' + scope, queryKey = '__aquarium_update';
  const sw = navigator.serviceWorker;
  let registration = null, registering = null, checking = null, applying = false;
  let pending = null, retryTimer = 0, didReload = false, state = 'idle', noticeKey = '';
  const notify = message => { try { hooks.notify(message); } catch (_) {} };
  const safe = () => document.visibilityState !== 'hidden' && hooks.ready() && !hooks.busy();
  const sayOnce = (key, message) => { if (noticeKey !== key) { noticeKey = key; notify(message); } };
  const newerBuild = version => {
    if (!/^\d+(?:\.\d+)*$/.test(version) || !/^\d+(?:\.\d+)*$/.test(hooks.build)) return false;
    const a = version.split('.').map(Number), b = hooks.build.split('.').map(Number);
    for (let i = 0; i < Math.max(a.length, b.length); i++) { if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0); }
    return false;
  };
  const later = () => { if (!retryTimer && !didReload) retryTimer = setTimeout(() => { retryTimer = 0; applyPending(); }, 5000); };
  function versionOf(worker) {
    if (!worker) return Promise.resolve(null);
    return new Promise(resolve => {
      const channel = new MessageChannel();
      const finish = value => { clearTimeout(timer); channel.port1.close(); channel.port2.close(); resolve(value); };
      const timer = setTimeout(() => finish(null), 3000);
      channel.port1.onmessage = event => { if (event.data && event.data.type === 'AQUARIUM_VERSION' && typeof event.data.version === 'string') finish(event.data.version); };
      try { worker.postMessage({type:'AQUARIUM_VERSION_REQUEST'}, [channel.port2]); } catch (_) { finish(null); }
    });
  }
  function reloadAlreadyAttempted(version) {
    if (new URL(location.href).searchParams.get(queryKey) === version) return true;
    try { return sessionStorage.getItem(reloadKey) === version; } catch (_) { return false; }
  }
  function reloadOnce(version) {
    if (didReload || reloadAlreadyAttempted(version)) {
      state = 'deferred'; sayOnce('stale:' + version, '新版已準備好，但頁面仍是舊版本。稍後再開啟魚缸即可，進度已保留。'); return;
    }
    didReload = true; state = 'reloading';
    try {
      sessionStorage.setItem(reloadKey, version);
      if (sessionStorage.getItem(reloadKey) === version) { location.reload(); return; }
    } catch (_) {}
    // A URL marker prevents loops even when session storage is blocked.
    const url = new URL(location.href); url.searchParams.set(queryKey, version); location.replace(url.href);
  }
  async function queue(worker, active) {
    const version = await versionOf(worker);
    if (!version || didReload) return;
    // A fresh network HTML can be newer than its still-active controller.
    // Never reload that page to adopt an older worker's version.
    if (active && !newerBuild(version)) { state = 'current'; return; }
    if (!active && version !== hooks.build && !newerBuild(version)) { state = 'current'; return; }
    pending = {worker, version, active};
    if (version !== hooks.build) sayOnce('ready:' + version, '新版魚缸已下載，會在目前操作完成並存檔後自動更新。');
    await applyPending();
  }
  async function applyPending() {
    if (!pending || applying || didReload) return;
    if (!safe()) { state = 'waiting-safe'; later(); return; }
    applying = true;
    const job = pending;
    try {
      state = 'saving';
      if (await hooks.save() !== true) { state = 'save-failed'; sayOnce('save:' + job.version, '目前無法確認存檔成功，已暫緩更新，請先檢查存檔狀態。'); later(); return; }
      if (!safe() || pending !== job) { state = 'waiting-safe'; later(); return; }
      if (!job.active) {
        // Activate the inspected worker, not a newer replacement.
        if (!registration || registration.waiting !== job.worker) { pending = null; later(); return; }
        state = 'activating'; pending = null;
        job.worker.postMessage({type:'AQUARIUM_ACTIVATE', version:job.version});
        return;
      }
      pending = null;
      if (job.version !== hooks.build) { notify('進度已儲存，正在載入新版魚缸。'); reloadOnce(job.version); }
      else state = 'current';
    } catch (_) { state = 'deferred'; later(); }
    finally { applying = false; if (pending) later(); }
  }
  async function inspect() {
    if (!registration || didReload) return;
    if (registration.waiting) await queue(registration.waiting, false);
    else if (!registration.installing && sw.controller) await queue(sw.controller, true);
  }
  function watch(worker) {
    if (!worker) return;
    worker.addEventListener('statechange', () => { if (worker.state === 'installed') inspect(); });
  }
  async function register() {
    if (registration) return registration;
    if (!registering) registering = sw.register(new URL('sw.js', scope).href, {scope, updateViaCache:'none'}).then(value => {
      registration = value;
      registration.addEventListener('updatefound', () => watch(registration.installing));
      watch(registration.installing); return registration;
    }).finally(() => { registering = null; });
    return registering;
  }
  async function check(manual = false) {
    if (checking) return checking;
    checking = (async () => {
      if (navigator.onLine === false) { state = 'offline'; if (manual) notify('目前離線，連線後會自動檢查更新。'); return state; }
      try {
        state = 'checking'; if (manual) notify('正在檢查魚缸更新……');
        const reg = await register(); await reg.update(); await inspect();
        if (!pending && !reg.waiting && !reg.installing && !didReload && !['activating','deferred','save-failed'].includes(state)) {
          state = 'current'; if (manual) notify('目前已是最新可用版本。');
        } else if (reg.installing) { state = 'downloading'; if (manual) notify('新版正在下載，完成後會安全存檔再更新。'); }
        return state;
      } catch (_) { state = 'offline'; if (manual) notify('暫時連不上更新服務，稍後會再試。'); return state; }
    })().finally(() => { checking = null; });
    return checking;
  }
  window.aquariumPWA = {check, get status() { return state; }};
  sw.addEventListener('controllerchange', () => { if (sw.controller) queue(sw.controller, true); });
  window.addEventListener('online', () => check());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { applyPending(); check(); } });
  setInterval(() => { if (document.visibilityState === 'visible') check(); }, 5 * 60 * 1000);
  if (document.readyState === 'complete') check(); else window.addEventListener('load', () => check(), {once:true});
})();
