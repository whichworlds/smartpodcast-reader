'use strict';
const $=id=>document.getElementById(id),audio=$('audio'),P=PhoneReader;
const state={book:null,words:[],index:-2,url:null,request:0,paragraph:false,section:-1,pending:null,wake:null,wakeRequest:0,lastSave:0};
function readLocal(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}}
function writeLocal(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}}
const settings=readLocal('sp.phone.settings',{rate:1,font:64,theme:'dark',awake:true,brightness:100});
if(![.75,1,1.25,1.5,1.75,2].includes(settings.rate))settings.rate=1;
settings.font=Math.max(30,Math.min(100,Number(settings.font)||64));
let database;
const dbReady=new Promise((resolve,reject)=>{
 const request=indexedDB.open('smartpodcast-phone',1);
 request.onupgradeneeded=()=>{for(const name of ['books','audio'])request.result.createObjectStore(name,{keyPath:'id'});};
 request.onsuccess=()=>{database=request.result;resolve(database);};request.onerror=()=>reject(request.error);request.onblocked=()=>reject(Error('Başka bir okuyucu sekmesini kapatıp yeniden dene.'));
});
async function dbRead(store,id){const db=await dbReady;return new Promise((resolve,reject)=>{const object=db.transaction(store).objectStore(store),request=id===undefined?object.getAll():object.get(id);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
async function dbWrite(book,blob,remove=false){const db=await dbReady;return new Promise((resolve,reject)=>{const tx=db.transaction(['books','audio'],'readwrite');if(remove){for(const name of ['books','audio'])tx.objectStore(name).delete(book.id);}else{tx.objectStore('books').put(book);tx.objectStore('audio').put({id:book.id,blob});}tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error||Error('Kayıt tamamlanamadı.'));tx.onerror=()=>{};});}
function bookmark(book){const point=readLocal('sp.phone.position:'+book.id,null);return point?.revision===book.revision?point:null;}
function message(error){$('importStatus').textContent=error?.name==='QuotaExceededError'?'Telefonda yeterli saklama alanı yok. Eski bir kitabı kaldırıp yeniden dene.':error.message||String(error);}
function node(tag,text,className){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;}
async function renderLibrary(){
 const books=await dbRead('books'),groups=new Map();$('bookCount').textContent=books.length;$('empty').hidden=books.length>0;$('books').replaceChildren();
 for(const book of books.sort((a,b)=>a.source_title.localeCompare(b.source_title,'tr')||a.source_offset-b.source_offset)){
  const key=book.source_id+'|'+book.language;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(book);
 }
 for(const group of groups.values()){
  const section=node('section',undefined,'book-group');section.append(node('h3',group[0].source_title));
  for(const [index,book] of group.entries()){
   const row=node('div',undefined,'book-card'),open=node('button',undefined,'book-open'),position=bookmark(book)?.position||0;
   const range=book.source_duration?`${P.clock(book.source_offset)}–${P.clock(book.source_offset+book.source_duration)}`:P.clock(book.duration);
   open.append(node('strong',`${group.length>1?'Kesit '+(index+1)+' · ':''}${range} · ${book.language.toUpperCase()}`),node('span',`${position>0?'Devam: '+P.clock(position)+' · ':''}${P.clock(P.remaining(book.duration,position,settings.rate))} kaldı · ${settings.rate}×`));
   const progress=node('div',undefined,'mini-progress'),bar=node('span');bar.style.width=Math.min(100,100*position/book.duration)+'%';progress.append(bar);open.append(progress);open.onclick=()=>openBook(book.id).catch(message);
   const remove=node('button','×','delete-book');remove.setAttribute('aria-label','Bu cihazdan kaldır: '+book.title);remove.onclick=async()=>{if(!confirm(book.title+'\nBu cihazdan kaldırılsın mı? Bilgisayardaki dosyalar korunur.'))return;try{await dbWrite(book,null,true);try{localStorage.removeItem('sp.phone.position:'+book.id);}catch{}await renderLibrary();}catch(error){message(error);}};
   row.append(node('span','▻','book-symbol'),open,remove);section.append(row);
  }$('books').append(section);
 }
}
function savePosition(force=false){
 if(!state.book||state.pending!==null||(!force&&Date.now()-state.lastSave<2000))return;
 state.lastSave=Date.now();if(!writeLocal('sp.phone.position:'+state.book.id,{revision:state.book.revision,position:Math.max(0,Math.min(state.book.duration,audio.currentTime||0))}))$('playerStatus').textContent='Dinleme noktası saklanamadı. Tarayıcının saklama iznini kontrol et.';
}
async function openBook(id){
 const request=++state.request;savePosition(true);audio.pause();
 const [book,track]=await Promise.all([dbRead('books',id),dbRead('audio',id)]);if(request!==state.request)return;
 if(!book||!track?.blob)throw Error('Kitap bulunamadı. Paketi yeniden ekle.');
 audio.removeAttribute('src');audio.load();if(state.url)URL.revokeObjectURL(state.url);
 state.book=book;state.words=P.indexWords(book);state.index=-2;state.section=-1;state.paragraph=false;state.pending=Math.min(book.duration,bookmark(book)?.position||0);
 state.url=URL.createObjectURL(track.blob);audio.src=state.url;audio.playbackRate=settings.rate;audio.preservesPitch=true;audio.load();
 $('library').hidden=true;$('reader').hidden=false;$('wordStage').hidden=false;$('paragraphPanel').hidden=true;$('paragraphToggle').textContent='Paragrafı göster';$('playerStatus').textContent='';
 $('bookTitle').textContent=book.source_title;$('sliceTitle').textContent=book.source_duration?P.clock(book.source_offset)+'–'+P.clock(book.source_offset+book.source_duration)+' · '+book.language.toUpperCase():book.title;
 $('word').lang=book.language;$('paragraph').lang=book.language;$('seek').max=book.duration;
 $('sectionPicker').replaceChildren(...book.sections.map((s,i)=>new Option(s.label,i)));
 document.title=book.source_title+' · Cep Okuyucu';if('mediaSession' in navigator)navigator.mediaSession.metadata=new MediaMetadata({title:book.title,artist:'Smart Podcast'});
 update();syncWake();
}
function fitWord(){const width=$('wordStage').clientWidth-10;if(width<=0)return;const n=$('word');n.style.fontSize=settings.font+'px';if(n.scrollWidth>width)n.style.fontSize=Math.max(12,settings.font*width/n.scrollWidth)+'px';}
function update(){
 if(!state.book)return;const time=state.pending??audio.currentTime,at=P.wordAt(state.words,time),word=state.words[at],sectionIndex=word?.sectionIndex??0;
 if(at!==state.index){state.index=at;$('word').textContent=word?.word||state.words[0]?.word||'Hazır';fitWord();}
 $('chapterTitle').textContent=state.book.sections[sectionIndex].label;
 if(state.paragraph){if(state.section!==sectionIndex)renderParagraph(sectionIndex);const old=$('paragraph').querySelector('.active'),active=$('paragraph').querySelector(`[data-word="${word?.wordIndex}"]`);if(old!==active){old?.classList.remove('active');active?.classList.add('active');}}
 if(document.activeElement!==$('seek'))$('seek').value=time;
 $('seek').setAttribute('aria-valuetext',P.clock(time)+' / '+P.clock(state.book.duration));$('elapsed').textContent=P.clock(time)+' / '+P.clock(state.book.duration);$('remaining').textContent='Kalan '+P.clock(P.remaining(state.book.duration,time,audio.playbackRate||settings.rate));
 $('play').textContent=audio.paused?'▶':'Ⅱ';$('play').setAttribute('aria-label',audio.paused?'Oynat':'Duraklat');savePosition();
}
function renderParagraph(index){
 state.section=index;$('sectionPicker').value=index;const section=state.book.sections[index],points=Array.from(section.text);let cursor=0;const content=document.createDocumentFragment();
 for(const [i,word] of section.words.entries()){content.append(document.createTextNode(points.slice(cursor,word.char_start).join('')));const token=node('button',word.word);token.dataset.word=i;token.onclick=()=>seek(word.start);content.append(token);cursor=word.char_end;}
 content.append(document.createTextNode(points.slice(cursor).join('')));$('paragraph').replaceChildren(content);$('paragraphPanel').scrollTop=0;
}
function seek(time){if(!state.book)return;const position=Math.max(0,Math.min(state.book.duration,time));if(state.pending!==null)state.pending=position;else audio.currentTime=position;update();savePosition(true);}
function sentence(direction){
 if(!state.book)return;const time=state.pending??audio.currentTime,at=Math.max(0,P.wordAt(state.words,time)),boundaries=[0];
 for(let i=1;i<state.words.length;i++)if(/[.!?…]["'»”)]*$/.test(state.words[i-1].word))boundaries.push(i);
 const target=direction<0?[...boundaries].reverse().find(i=>state.words[i].start<time-.5):boundaries.find(i=>i>at);
 seek(target===undefined?(direction<0?0:state.book.duration):state.words[target].start);
}
async function togglePlay(){if(!state.book)return;try{if(audio.paused)await audio.play();else audio.pause();}catch{$('playerStatus').textContent='Ses başlatılamadı. Oynat düğmesine tekrar dokun.';}}
let frame;
function animate(){update();if(!audio.paused)frame=requestAnimationFrame(animate);}
audio.addEventListener('loadedmetadata',()=>{if(!state.book)return;audio.playbackRate=settings.rate;if(state.pending!==null){audio.currentTime=state.pending;state.pending=null;}update();});
audio.addEventListener('timeupdate',update);audio.addEventListener('play',()=>{cancelAnimationFrame(frame);animate();syncWake();});audio.addEventListener('pause',()=>{cancelAnimationFrame(frame);update();savePosition(true);syncWake();});audio.addEventListener('ended',()=>{update();savePosition(true);});audio.addEventListener('error',()=>{if(state.book)$('playerStatus').textContent='MP3 okunamadı. Paketi yeniden ekle.';});
$('play').onclick=togglePlay;$('rewind').onclick=()=>seek((state.pending??audio.currentTime)-10);$('forward').onclick=()=>seek((state.pending??audio.currentTime)+10);$('previousSentence').onclick=()=>sentence(-1);$('nextSentence').onclick=()=>sentence(1);$('seek').oninput=()=>seek(Number($('seek').value));
$('rate').onchange=()=>{settings.rate=Number($('rate').value);audio.playbackRate=settings.rate;audio.preservesPitch=true;saveSettings();update();};
$('sectionPicker').onchange=()=>{const index=Number($('sectionPicker').value);seek(state.book.sections[index].start);renderParagraph(index);};
$('paragraphToggle').onclick=()=>{state.paragraph=!state.paragraph;$('paragraphPanel').hidden=!state.paragraph;$('wordStage').hidden=state.paragraph;$('paragraphToggle').textContent=state.paragraph?'Tek kelimeye dön':'Paragrafı göster';state.section=-1;update();fitWord();};
$('back').onclick=()=>{++state.request;savePosition(true);audio.pause();state.book=null;audio.removeAttribute('src');audio.load();if(state.url)URL.revokeObjectURL(state.url);state.url=null;$('reader').hidden=true;$('library').hidden=false;document.title='Smart Podcast · Cep Okuyucu';syncWake();renderLibrary().catch(message);};
$('packages').onchange=async()=>{
 const files=[...$('packages').files];$('packages').disabled=true;
 try{
  for(const file of files){$('importStatus').textContent='Ekleniyor: '+file.name;const {book,audio:blob}=await P.readPackage(file),old=await dbRead('books',book.id);
   if(old?.revision===book.revision){$('importStatus').textContent='Bu kesit zaten kitaplıkta.';continue;}
   if(old&&!confirm(book.title+'\nYeni sürüm eklensin mi? Eski sürüm ve dinleme noktası değişecek.'))continue;
   await dbWrite(book,blob);if(old)try{localStorage.removeItem('sp.phone.position:'+book.id);}catch{}$('importStatus').textContent='Eklendi: '+book.title;
  }await renderLibrary();if(navigator.storage?.persist)await navigator.storage.persist().catch(()=>false);
 }catch(error){message(error);await renderLibrary().catch(()=>{});}finally{$('packages').disabled=false;$('packages').value='';}
};
function saveSettings(){writeLocal('sp.phone.settings',settings);applySettings();}
function applySettings(){document.body.classList.toggle('paper',settings.theme==='paper');$('rate').value=settings.rate;document.documentElement.style.setProperty('--font',settings.font+'px');document.documentElement.style.setProperty('--brightness',Math.max(.45,Math.min(1,(settings.brightness||100)/100)));$('fontSize').value=settings.font;$('theme').value=settings.theme==='paper'?'paper':'dark';$('keepAwake').checked=!!settings.awake;$('brightness').value=settings.brightness||100;fitWord();syncWake();}
$('settingsButton').onclick=()=>$('settings').showModal();$('fontSize').oninput=()=>{settings.font=Number($('fontSize').value);saveSettings();};$('theme').onchange=()=>{settings.theme=$('theme').value;saveSettings();};$('keepAwake').onchange=()=>{settings.awake=$('keepAwake').checked;saveSettings();};$('brightness').oninput=()=>{settings.brightness=Number($('brightness').value);saveSettings();};
async function syncWake(){const version=++state.wakeRequest,wanted=!!state.book&&settings.awake&&document.visibilityState==='visible';if(!wanted){await state.wake?.release().catch(()=>{});state.wake=null;return;}if(state.wake&&!state.wake.released)return;try{const lock=await navigator.wakeLock?.request('screen');if(version!==state.wakeRequest){await lock?.release();return;}state.wake=lock;}catch{}}
document.addEventListener('visibilitychange',()=>{savePosition(true);syncWake();if(document.visibilityState==='visible')update();});window.addEventListener('pagehide',()=>savePosition(true));window.addEventListener('resize',fitWord);
if('mediaSession' in navigator)for(const [action,handler] of Object.entries({play:()=>audio.play().catch(()=>{}),pause:()=>audio.pause(),seekbackward:()=>seek(audio.currentTime-10),seekforward:()=>seek(audio.currentTime+10),seekto:d=>seek(d.seekTime)})){try{navigator.mediaSession.setActionHandler(action,handler);}catch{}}
let installPrompt;window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;$('install').hidden=false;});$('install').onclick=async()=>{if(installPrompt){await installPrompt.prompt();installPrompt=null;$('install').hidden=true;}else $('helpDialog').showModal();};$('help').onclick=()=>$('helpDialog').showModal();window.addEventListener('appinstalled',()=>{$('install').hidden=true;});
async function offlineSetup(){if(!('serviceWorker' in navigator)||!window.isSecureContext){$('offlineStatus').textContent='Çevrimdışı kurulum için okuyucuyu HTTPS adresinden aç.';return;}try{await navigator.serviceWorker.register('sw.js');await navigator.serviceWorker.ready;$('offlineStatus').textContent='✓ Çevrimdışı kullanıma hazır';}catch{$('offlineStatus').textContent='Çevrimdışı hazırlık tamamlanamadı. İnternet açıkken sayfayı yenile.';}}
applySettings();dbReady.then(renderLibrary).catch(error=>message(Error('Cihazda saklama açılamadı. Normal Chrome sekmesinde dene. '+error.message)));offlineSetup();
