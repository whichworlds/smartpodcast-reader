'use strict';
const CACHE='smartpodcast-phone-v12';
const SHELL=['./','index.html','i18n.js','core.js','reader.js','reader.css','manifest.webmanifest','icon-192.png','icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL.map(url=>new Request(url,{cache:'reload'})))).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('smartpodcast-phone-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
 // Network first, revalidating past the HTTP cache so updates arrive at once; cached shell keeps it working offline.
 const fresh=(request,key)=>fetch(request.url,{cache:'no-cache',credentials:'same-origin'}).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(key,copy));}return response;}).catch(()=>caches.match(key).then(cached=>cached||Promise.reject(Error('offline'))));
 if(event.request.mode==='navigate'){event.respondWith(fresh(event.request,new URL('./',self.location.href).href));return;}
 const pathname=new URL(event.request.url).pathname;
 if(!SHELL.some(asset=>asset!=='./'&&pathname.endsWith('/'+asset)))return;
 event.respondWith(fresh(event.request,event.request));
});
