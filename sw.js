'use strict';
const CACHE='smartpodcast-phone-v1';
const SHELL=['./','index.html','core.js','reader.js','reader.css','manifest.webmanifest','icon-192.png','icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('smartpodcast-phone-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
 if(event.request.mode==='navigate'){event.respondWith(caches.match(new URL('./',self.location.href).href).then(cached=>cached||fetch(event.request)));return;}
 const pathname=new URL(event.request.url).pathname;
 if(!SHELL.some(asset=>asset!=='./'&&pathname.endsWith('/'+asset)))return;
 event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));
});
