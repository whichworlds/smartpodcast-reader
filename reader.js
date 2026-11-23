'use strict';
const APP_VERSION='2026.11.23-8';
const $=id=>document.getElementById(id),audio=$('audio'),P=PhoneReader,L=I18n,t=L.t;
const state={offline:'offlinePreparing',book:null,words:[],index:-2,url:null,request:0,paragraph:false,section:-1,pending:null,wake:null,wakeRequest:0,lastSave:0};
function readLocal(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}}
function writeLocal(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}}
const settings=readLocal('sp.phone.settings',{rate:1,font:64,theme:'dark',awake:true,brightness:100,step:5});
if(![5,10,15,30].includes(settings.step))settings.step=5;
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
function message(error){$('importStatus').textContent=error?.name==='QuotaExceededError'?t('quota'):L.translateError(error?.message||String(error));}
function node(tag,text,className){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;}
// One entry per project; projects with several slices fold into an expandable tree.
function bookRow(book,label){
 const row=node('div',undefined,'book-card'),open=node('button',undefined,'book-open'),position=bookmark(book)?.position||0;
 open.append(node('strong',label),node('span',`${position>0?t('resume')+P.clock(position)+' · ':''}${P.clock(P.remaining(book.duration,position,settings.rate))}${t('left')} · ${settings.rate}×`));
 const progress=node('div',undefined,'mini-progress'),bar=node('span');bar.style.width=Math.min(100,100*position/book.duration)+'%';progress.append(bar);open.append(progress);open.onclick=()=>openBook(book.id).catch(message);
 const play=node('button','▶','book-play');play.setAttribute('aria-label',t('listen')+label);play.onclick=()=>openBook(book.id,true).catch(message);
 const remove=node('button','×','delete-book');remove.setAttribute('aria-label',t('remove')+label);remove.onclick=async()=>{if(!confirm(label+'\n'+t('removeConfirm')))return;try{await dbWrite(book,null,true);try{localStorage.removeItem('sp.phone.position:'+book.id);}catch{}await renderLibrary();}catch(error){message(error);}};
 row.append(play,open,remove);return row;
}
async function renderLibrary(){
 const books=await dbRead('books'),groups=new Map(),expanded=readLocal('sp.phone.expanded',{});$('books').replaceChildren();
 for(const book of books.sort((a,b)=>a.source_title.localeCompare(b.source_title,L.language)||a.source_offset-b.source_offset)){
  const key=book.source_id+'|'+book.language;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(book);
 }
  $('bookCount').textContent=groups.size;$('empty').hidden=books.length>0;
 // User order from drag and drop; books never placed by hand keep their default order after the placed ones.
 const rank=new Map(readLocal('sp.phone.order',[]).map((key,index)=>[key,index])),keys=[...groups.keys()];
 keys.sort((a,b)=>(rank.has(a)?rank.get(a):1e6+keys.indexOf(a))-(rank.has(b)?rank.get(b):1e6+keys.indexOf(b)));
 for(const [number,key] of keys.entries()){const group=groups.get(key);
  const range=book=>book.source_duration?`${P.clock(book.source_offset)}–${P.clock(book.source_offset+book.source_duration)}`:P.clock(book.duration);
   if(group.length===1){const book=group[0],section=node('section',undefined,'book-group');const row=bookRow(book,book.source_title);row.querySelector('strong').after(node('small',`${range(book)} · ${book.language.toUpperCase()}`,'book-meta'));row.prepend(orderHandle(section,key,number));section.append(row);$('books').append(section);continue;}
  const tree=node('details',undefined,'book-tree'),summary=node('summary'),left=group.reduce((sum,book)=>sum+P.remaining(book.duration,bookmark(book)?.position||0,settings.rate),0);
  const started=group.some(book=>(bookmark(book)?.position||0)>0);tree.open=key in expanded?!!expanded[key]:started;
  const text=node('span',undefined,'tree-text');text.append(node('strong',group[0].source_title),node('small',`${group.length} ${t('slices')} · ${group[0].language.toUpperCase()} · ${P.clock(left)}${t('left')}`));
   summary.append(orderHandle(tree,key,number),node('span','›','tree-chevron'),text);tree.append(summary);
  tree.addEventListener('toggle',()=>{const state=readLocal('sp.phone.expanded',{});state[key]=tree.open;writeLocal('sp.phone.expanded',state);});
  const list=node('div',undefined,'tree-items');for(const [index,book] of group.entries())list.append(bookRow(book,`${t('slice')}${index+1} · ${range(book)}`));
  tree.append(list);$('books').append(tree);
 }
}
// Hold the number and drag: pointer events, because Android Chrome has no HTML drag and drop.
function orderHandle(item,key,number){
 const handle=node('span',String(number+1),'order-handle');item.dataset.orderKey=key;
 handle.setAttribute('role','button');handle.setAttribute('aria-label',t('dragHint'));handle.title=t('dragHint');
 handle.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();});
 handle.addEventListener('pointerdown',event=>{
  if(event.button>0)return;event.preventDefault();event.stopPropagation();
  const list=$('books');let moved=false,frame=0,lastY=event.clientY;
  try{handle.setPointerCapture(event.pointerId);}catch{}
  item.classList.add('dragging');navigator.vibrate?.(12);
  const place=y=>{const others=[...list.children].filter(el=>el!==item&&el.dataset.orderKey);
   const next=others.find(el=>{const r=el.getBoundingClientRect();return y<r.top+r.height/2;});
   if(next){if(item.nextElementSibling!==next){list.insertBefore(item,next);moved=true;}}else if(list.lastElementChild!==item){list.append(item);moved=true;}};
  const scroll=()=>{const edge=70;if(lastY<edge)scrollBy(0,-12);else if(lastY>innerHeight-edge)scrollBy(0,12);place(lastY);frame=requestAnimationFrame(scroll);};
  frame=requestAnimationFrame(scroll);
  const move=e=>{lastY=e.clientY;place(lastY);};
  const end=()=>{cancelAnimationFrame(frame);handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',end);handle.removeEventListener('pointercancel',end);
   item.classList.remove('dragging');
   const order=[...list.children].map(el=>el.dataset.orderKey).filter(Boolean);
   order.forEach((_,index)=>{const badge=list.children[index]?.querySelector('.order-handle');if(badge)badge.textContent=String(index+1);});
   if(moved)writeLocal('sp.phone.order',order);};
  handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',end);handle.addEventListener('pointercancel',end);
 });
 return handle;
}
function savePosition(force=false){
 if(!state.book||state.pending!==null||(!force&&Date.now()-state.lastSave<2000))return;
 state.lastSave=Date.now();if(!writeLocal('sp.phone.position:'+state.book.id,{revision:state.book.revision,position:Math.max(0,Math.min(state.book.duration,audio.currentTime||0))}))$('playerStatus').textContent=t('positionFailed');
}
async function openBook(id,autoplay=false){
 setSleep(null);setFocus(false);const request=++state.request;savePosition(true);audio.pause();
 const [book,track]=await Promise.all([dbRead('books',id),dbRead('audio',id)]);if(request!==state.request)return;
 if(!book||!track?.blob)throw Error('Kitap bulunamadı. Paketi yeniden ekle.');
 audio.removeAttribute('src');audio.load();if(state.url)URL.revokeObjectURL(state.url);
 state.book=book;state.words=P.indexWords(book);state.index=-2;state.section=-1;state.paragraph=false;state.pending=Math.min(book.duration,bookmark(book)?.position||0);
 state.url=URL.createObjectURL(track.blob);audio.src=state.url;audio.playbackRate=settings.rate;audio.preservesPitch=true;audio.load();
 $('library').hidden=true;$('reader').hidden=false;$('wordStage').hidden=false;$('paragraphPanel').hidden=true;$('paragraphToggle').textContent=t('showParagraph');$('playerStatus').textContent='';
 $('bookTitle').textContent=book.source_title;$('sliceTitle').textContent=book.source_duration?P.clock(book.source_offset)+'–'+P.clock(book.source_offset+book.source_duration)+' · '+book.language.toUpperCase():book.title;
 $('word').lang=book.language;$('paragraph').lang=book.language;$('seek').max=book.duration;
 $('sectionPicker').replaceChildren(...book.sections.map((s,i)=>new Option(s.label,i)));
 document.title=book.source_title+t('appSuffix');if('mediaSession' in navigator)navigator.mediaSession.metadata=new MediaMetadata({title:book.title,artist:'Smart Podcast'});
 update();syncWake();
 if(autoplay)audio.play().catch(()=>{$('playerStatus').textContent=t('playFailed');});
}
function fitWord(){const width=$('wordStage').clientWidth-10;if(width<=0)return;const n=$('word');n.style.fontSize=settings.font+'px';if(n.scrollWidth>width)n.style.fontSize=Math.max(12,settings.font*width/n.scrollWidth)+'px';}
function update(){
 if(!state.book)return;const time=state.pending??audio.currentTime,at=P.wordAt(state.words,time),word=state.words[at],sectionIndex=word?.sectionIndex??0;
 if(at!==state.index){state.index=at;$('word').textContent=word?.word||state.words[0]?.word||t('ready');fitWord();}
 $('chapterTitle').textContent=state.book.sections[sectionIndex].label;
 if(state.paragraph){if(state.section!==sectionIndex)renderParagraph(sectionIndex);const old=$('paragraph').querySelector('.active'),active=$('paragraph').querySelector(`[data-word="${word?.wordIndex}"]`);if(old!==active){old?.classList.remove('active');active?.classList.add('active');}}
 if(document.activeElement!==$('seek'))$('seek').value=time;
 const rate=audio.playbackRate||settings.rate;$('seek').setAttribute('aria-valuetext',P.clock(time/rate)+' / '+P.clock(state.book.duration/rate));$('elapsed').textContent=P.clock(time/rate);$('remaining').textContent=t('remaining')+P.clock(P.remaining(state.book.duration,time,rate));
 tickSleep(word?.sectionIndex);$('focusProgress').firstChild.style.width=Math.min(100,100*time/state.book.duration)+'%';$('play').textContent=audio.paused?'▶':'Ⅱ';$('play').setAttribute('aria-label',t(audio.paused?'play':'pause'));savePosition();
}
function renderParagraph(index){
 state.section=index;$('sectionPicker').value=index;const section=state.book.sections[index],points=Array.from(section.text);let cursor=0;const content=document.createDocumentFragment();
 for(const [i,word] of section.words.entries()){content.append(document.createTextNode(points.slice(cursor,word.char_start).join('')));const token=node('button',word.word);token.dataset.word=i;token.onclick=()=>seek(word.start);content.append(token);cursor=word.char_end;}
 content.append(document.createTextNode(points.slice(cursor).join('')));$('paragraph').replaceChildren(content);$('paragraphPanel').scrollTop=0;
}
function seek(time){if(!state.book)return;const position=Math.max(0,Math.min(state.book.duration,time));if(state.pending!==null)state.pending=position;else audio.currentTime=position;update();savePosition(true);}
// Focus mode: only the word stays; faint transport and a hairline progress remain.
const focus={on:false,timer:0,reveal:0};
function canFocus(){return !!state.book&&!state.paragraph&&!audio.paused&&!$('reader').hidden&&!$('settings').open&&!$('sleepDialog').open;}
function scheduleFocus(){clearTimeout(focus.timer);if(!focus.on&&canFocus())focus.timer=setTimeout(()=>{if(canFocus())setFocus(true);},4000);}
// The installed app has no address bar; asking for fullscreen there only adds Chrome's exit notice.
function installedApp(){return ['standalone','fullscreen','minimal-ui'].some(mode=>matchMedia(`(display-mode: ${mode})`).matches);}
function enterFullscreen(){const root=document.documentElement;if(!installedApp()&&!document.fullscreenElement&&root.requestFullscreen)root.requestFullscreen({navigationUI:'hide'}).catch(()=>{});}
function leaveFullscreen(){if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});}
function setFocus(on){
 if(on===focus.on){if(!on)scheduleFocus();return;}
 focus.on=on;$('reader').classList.toggle('focus',on);$('reader').classList.remove('reveal');clearTimeout(focus.timer);clearTimeout(focus.reveal);
 if(on)history.pushState({focus:true},'');else{if(history.state?.focus)history.back();scheduleFocus();}
}
function revealControls(){$('reader').classList.add('reveal');clearTimeout(focus.reveal);focus.reveal=setTimeout(()=>$('reader').classList.remove('reveal'),3000);}
$('reader').addEventListener('click',event=>{
 if(focus.on){if(event.target.closest('.transport')){revealControls();return;}event.preventDefault();event.stopPropagation();setFocus(false);return;}
 if(event.target.closest('#wordStage')&&state.book&&!state.paragraph){enterFullscreen();setFocus(true);return;}
 scheduleFocus();
},true);
$('reader').addEventListener('input',scheduleFocus,true);
window.addEventListener('popstate',()=>{if(focus.on){focus.on=false;$('reader').classList.remove('focus','reveal');scheduleFocus();}});
document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement&&focus.on)setFocus(false);});
audio.addEventListener('play',scheduleFocus);audio.addEventListener('pause',()=>clearTimeout(focus.timer));
// Sleep timer: runs on the wall clock from the moment it is set, playing or not.
// It fades out over the last 30 s and pauses; the next play of that book starts
// half the timer length earlier (section mode: half the time it ran).
const FADE=30000;
const sleep={mode:null,deadline:0,started:0,length:0,section:-1,interval:0};
function sleepLeft(){return Math.max(0,sleep.deadline-Date.now());}
function sleepLabel(){if(!sleep.mode)return '';return sleep.mode==='section'?t('sleepEnd'):P.clock(Math.ceil(sleepLeft()/1000));}
function renderSleep(){const label=sleepLabel();$('sleepButton').textContent=label?'☾ '+label:'☾';$('sleepButton').classList.toggle('active',!!sleep.mode);$('sleepBadge').textContent=label?'☾ '+label:'';}
function setSleep(mode){
 clearInterval(sleep.interval);sleep.mode=null;audio.volume=1;
 if(typeof mode==='number'){sleep.mode='time';sleep.length=mode*60000;sleep.started=Date.now();sleep.deadline=sleep.started+sleep.length;settings.sleep=mode;saveSettings();}
 else if(mode==='section'){sleep.mode='section';sleep.started=Date.now();sleep.section=state.words[Math.max(0,P.wordAt(state.words,audio.currentTime))]?.sectionIndex??0;settings.sleep='section';saveSettings();}
 if(sleep.mode)sleep.interval=setInterval(()=>tickSleep(),1000);
 renderSleep();syncWake();
}
function sleepFinish(){
 const id=state.book?.id,playing=!audio.paused,rewind=Math.round((sleep.mode==='time'?sleep.length:Date.now()-sleep.started)/2000);
 setSleep(null);
 if(playing){audio.pause();if(id&&rewind>0)writeLocal('sp.phone.sleepRewind:'+id,rewind);}
}
function tickSleep(sectionIndex){
 if(!sleep.mode)return;
 if(sleep.mode==='section'){if(!audio.paused&&sectionIndex!==undefined){if(sectionIndex>sleep.section)sleepFinish();else if(sectionIndex<sleep.section)sleep.section=sectionIndex;}return;}
 const left=sleepLeft();
 if(left<=0){sleepFinish();return;}
 if(!audio.paused)audio.volume=Math.max(0,Math.min(1,left/FADE));
 renderSleep();
}
function openSleepDialog(){
 const options=[[null,t('sleepOff')],[5],[10],[15],[20],[30],[45],[60,t('hour')],['section',t('sleepSection')]];
 $('sleepOptions').replaceChildren(...options.map(([value,label])=>{const b=node('button',label||value+' '+t('min'),'sleep-option');b.type='button';
  const current=sleep.mode==='section'?'section':sleep.mode?settings.sleep:null;if(value===current)b.classList.add('active');
  b.onclick=()=>{setSleep(value);$('sleepDialog').close();};return b;}));
 $('sleepDialog').showModal();
}
$('sleepButton').onclick=openSleepDialog;
audio.addEventListener('play',()=>{
 if(sleep.mode==='time'&&sleepLeft()<=0)setSleep(null);
 if(!state.book)return;const key='sp.phone.sleepRewind:'+state.book.id,value=readLocal(key,0);if(!value)return;
 try{localStorage.removeItem(key);}catch{}
 const back=value===true?60:Math.max(0,Number(value)||0);
 if(state.pending!==null)state.pending=Math.max(0,state.pending-back);else audio.currentTime=Math.max(0,audio.currentTime-back);
});
audio.addEventListener('pause',()=>{if(sleep.mode)audio.volume=1;});
async function togglePlay(){if(!state.book)return;try{if(audio.paused)await audio.play();else audio.pause();}catch{$('playerStatus').textContent=t('playFailed');}}
let frame;
function animate(){update();if(!audio.paused)frame=requestAnimationFrame(animate);}
audio.addEventListener('loadedmetadata',()=>{if(!state.book)return;audio.playbackRate=settings.rate;if(state.pending!==null){audio.currentTime=state.pending;state.pending=null;}update();});
audio.addEventListener('timeupdate',update);audio.addEventListener('play',()=>{cancelAnimationFrame(frame);animate();syncWake();});audio.addEventListener('pause',()=>{cancelAnimationFrame(frame);update();savePosition(true);syncWake();});audio.addEventListener('ended',()=>{update();savePosition(true);});audio.addEventListener('error',()=>{if(state.book)$('playerStatus').textContent=t('mp3Failed');});
$('play').onclick=()=>{if(audio.paused)enterFullscreen();togglePlay();};$('rewind').onclick=()=>seek((state.pending??audio.currentTime)-settings.step);$('forward').onclick=()=>seek((state.pending??audio.currentTime)+settings.step);
for(const id of ['stepBack','stepForward'])$(id).onclick=()=>{const steps=[5,10,15,30];settings.step=steps[(steps.indexOf(settings.step)+1)%steps.length];saveSettings();};
function applyStep(){const n=String(settings.step);for(const id of ['stepBack','stepForward']){$(id).textContent=n+' '+t('sec');$(id).setAttribute('aria-label',t('step').replace('{n}',n));}$('rewind').setAttribute('aria-label',t('rewind').replace('{n}',n));$('forward').setAttribute('aria-label',t('forward').replace('{n}',n));}$('seek').oninput=()=>seek(Number($('seek').value));
$('rate').onchange=()=>{settings.rate=Number($('rate').value);audio.playbackRate=settings.rate;audio.preservesPitch=true;saveSettings();update();};
$('sectionPicker').onchange=()=>{const index=Number($('sectionPicker').value);seek(state.book.sections[index].start);renderParagraph(index);};
$('paragraphToggle').onclick=()=>{state.paragraph=!state.paragraph;$('paragraphPanel').hidden=!state.paragraph;$('wordStage').hidden=state.paragraph;$('paragraphToggle').textContent=t(state.paragraph?'singleWord':'showParagraph');state.section=-1;update();fitWord();};
$('back').onclick=()=>{setSleep(null);setFocus(false);leaveFullscreen();++state.request;savePosition(true);audio.pause();state.book=null;audio.removeAttribute('src');audio.load();if(state.url)URL.revokeObjectURL(state.url);state.url=null;$('reader').hidden=true;$('library').hidden=false;document.title=t('title');syncWake();renderLibrary().catch(message);};
$('packages').onchange=async()=>{
 const files=[...$('packages').files];$('packages').disabled=true;
 try{
  const count={added:0,same:0,failed:0};let lastError=null,single=true;
  for(const file of files){
   $('importStatus').textContent=t('adding')+file.name;
   let items;try{items=await P.packagesIn(file);}catch(error){count.failed++;lastError=error;continue;}
   if(items.length>1||files.length>1)single=false;
   for(const [index,item] of items.entries()){
    try{
     $('importStatus').textContent=t('adding')+(items.length>1?(index+1)+'/'+items.length+' · ':'')+item.name;
     const {book,audio:blob}=await P.readPackage(item.file),old=await dbRead('books',book.id);
     if(old?.revision===book.revision){count.same++;continue;}
     if(old&&!confirm(book.title+'\n'+t('newVersion')))continue;
     await dbWrite(book,blob);if(old)try{localStorage.removeItem('sp.phone.position:'+book.id);}catch{}count.added++;
     if(single)$('importStatus').textContent=t('added')+book.title;
    }catch(error){if(error?.name==='QuotaExceededError')throw error;count.failed++;lastError=error;}
   }
  }
  if(single&&count.same&&!count.added)$('importStatus').textContent=t('already');
  else if(single&&lastError&&!count.added)message(lastError);
  else if(!single)$('importStatus').textContent=t('importSummary').replace('{added}',count.added).replace('{same}',count.same).replace('{failed}',count.failed)+(lastError?' · '+L.translateError(lastError.message||String(lastError)):'');
  await renderLibrary();if(navigator.storage?.persist)await navigator.storage.persist().catch(()=>false);
 }catch(error){message(error);await renderLibrary().catch(()=>{});}finally{$('packages').disabled=false;$('packages').value='';}
};
function saveSettings(){writeLocal('sp.phone.settings',settings);applySettings();}
function applySettings(){applyStep();document.body.classList.toggle('paper',settings.theme==='paper');$('rate').value=settings.rate;document.documentElement.style.setProperty('--font',settings.font+'px');document.documentElement.style.setProperty('--brightness',Math.max(.45,Math.min(1,(settings.brightness||100)/100)));$('fontSize').value=settings.font;$('theme').value=settings.theme==='paper'?'paper':'dark';$('keepAwake').checked=!!settings.awake;$('brightness').value=settings.brightness||100;fitWord();syncWake();}
$('settingsButton').onclick=()=>$('settings').showModal();$('fontSize').oninput=()=>{settings.font=Number($('fontSize').value);saveSettings();};$('theme').onchange=()=>{settings.theme=$('theme').value;saveSettings();};$('keepAwake').onchange=()=>{settings.awake=$('keepAwake').checked;saveSettings();};$('brightness').oninput=()=>{settings.brightness=Number($('brightness').value);saveSettings();};
async function syncWake(){const version=++state.wakeRequest,wanted=!!state.book&&settings.awake&&!sleep.mode&&document.visibilityState==='visible';if(!wanted){await state.wake?.release().catch(()=>{});state.wake=null;return;}if(state.wake&&!state.wake.released)return;try{const lock=await navigator.wakeLock?.request('screen');if(version!==state.wakeRequest){await lock?.release();return;}state.wake=lock;}catch{}}
document.addEventListener('visibilitychange',()=>{savePosition(true);syncWake();if(document.visibilityState==='visible')update();});window.addEventListener('pagehide',()=>savePosition(true));window.addEventListener('resize',fitWord);
if('mediaSession' in navigator)for(const [action,handler] of Object.entries({play:()=>audio.play().catch(()=>{}),pause:()=>audio.pause(),seekbackward:()=>seek(audio.currentTime-10),seekforward:()=>seek(audio.currentTime+10),seekto:d=>seek(d.seekTime)})){try{navigator.mediaSession.setActionHandler(action,handler);}catch{}}
let installPrompt;window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;$('install').hidden=false;});$('install').onclick=async()=>{if(installPrompt){await installPrompt.prompt();installPrompt=null;$('install').hidden=true;}else $('helpDialog').showModal();};$('help').onclick=()=>$('helpDialog').showModal();window.addEventListener('appinstalled',()=>{$('install').hidden=true;});
function setOffline(key){state.offline=key;$('offlineStatus').textContent=t(key);}
function applyLanguage(){L.applyStatic();applyStep();if(typeof renderSleep==='function')renderSleep();$('languageSelect').value=L.language;$('offlineStatus').textContent=t(state.offline);document.title=state.book?state.book.source_title+t('appSuffix'):t('title');$('paragraphToggle').textContent=t(state.paragraph?'singleWord':'showParagraph');if(state.book){state.index=-2;update();}else $('word').textContent=t('ready');}
function changeLanguage(value){L.setLanguage(value);applyLanguage();renderLibrary().catch(message);}
$('language').onclick=()=>changeLanguage(L.language==='de'?'tr':'de');$('languageSelect').onchange=()=>changeLanguage($('languageSelect').value);
async function offlineSetup(){if(!('serviceWorker' in navigator)||!window.isSecureContext){setOffline('offlineHttps');return;}try{await navigator.serviceWorker.register('sw.js');await navigator.serviceWorker.ready;setOffline('offlineReady');}catch{setOffline('offlineFailed');}}
$('appVersion').textContent='v'+APP_VERSION;applyLanguage();applySettings();dbReady.then(renderLibrary).catch(error=>message(Error(t('storageOpenFailed')+L.translateError(error.message))));offlineSetup();
