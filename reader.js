'use strict';
const $=id=>document.getElementById(id),audio=$('audio'),P=PhoneReader,L=I18n,t=L.t;
const state={offline:'offlinePreparing',book:null,words:[],index:-2,url:null,request:0,paragraph:false,section:-1,pending:null,wake:null,wakeRequest:0,lastSave:0};
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
 for(const [key,group] of groups){
  const range=book=>book.source_duration?`${P.clock(book.source_offset)}–${P.clock(book.source_offset+book.source_duration)}`:P.clock(book.duration);
  if(group.length===1){const book=group[0],section=node('section',undefined,'book-group');const row=bookRow(book,book.source_title);row.querySelector('strong').after(node('small',`${range(book)} · ${book.language.toUpperCase()}`,'book-meta'));section.append(row);$('books').append(section);continue;}
  const tree=node('details',undefined,'book-tree'),summary=node('summary'),left=group.reduce((sum,book)=>sum+P.remaining(book.duration,bookmark(book)?.position||0,settings.rate),0);
  const started=group.some(book=>(bookmark(book)?.position||0)>0);tree.open=key in expanded?!!expanded[key]:started;
  const text=node('span',undefined,'tree-text');text.append(node('strong',group[0].source_title),node('small',`${group.length} ${t('slices')} · ${group[0].language.toUpperCase()} · ${P.clock(left)}${t('left')}`));
  summary.append(node('span','›','tree-chevron'),text);tree.append(summary);
  tree.addEventListener('toggle',()=>{const state=readLocal('sp.phone.expanded',{});state[key]=tree.open;writeLocal('sp.phone.expanded',state);});
  const list=node('div',undefined,'tree-items');for(const [index,book] of group.entries())list.append(bookRow(book,`${t('slice')}${index+1} · ${range(book)}`));
  tree.append(list);$('books').append(tree);
 }
}
function savePosition(force=false){
 if(!state.book||state.pending!==null||(!force&&Date.now()-state.lastSave<2000))return;
 state.lastSave=Date.now();if(!writeLocal('sp.phone.position:'+state.book.id,{revision:state.book.revision,position:Math.max(0,Math.min(state.book.duration,audio.currentTime||0))}))$('playerStatus').textContent=t('positionFailed');
}
async function openBook(id,autoplay=false){
 const request=++state.request;savePosition(true);audio.pause();
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
 $('seek').setAttribute('aria-valuetext',P.clock(time)+' / '+P.clock(state.book.duration));$('elapsed').textContent=P.clock(time)+' / '+P.clock(state.book.duration);$('remaining').textContent=t('remaining')+P.clock(P.remaining(state.book.duration,time,audio.playbackRate||settings.rate));
 $('play').textContent=audio.paused?'▶':'Ⅱ';$('play').setAttribute('aria-label',t(audio.paused?'play':'pause'));savePosition();
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
async function togglePlay(){if(!state.book)return;try{if(audio.paused)await audio.play();else audio.pause();}catch{$('playerStatus').textContent=t('playFailed');}}
let frame;
function animate(){update();if(!audio.paused)frame=requestAnimationFrame(animate);}
audio.addEventListener('loadedmetadata',()=>{if(!state.book)return;audio.playbackRate=settings.rate;if(state.pending!==null){audio.currentTime=state.pending;state.pending=null;}update();});
audio.addEventListener('timeupdate',update);audio.addEventListener('play',()=>{cancelAnimationFrame(frame);animate();syncWake();});audio.addEventListener('pause',()=>{cancelAnimationFrame(frame);update();savePosition(true);syncWake();});audio.addEventListener('ended',()=>{update();savePosition(true);});audio.addEventListener('error',()=>{if(state.book)$('playerStatus').textContent=t('mp3Failed');});
$('play').onclick=togglePlay;$('rewind').onclick=()=>seek((state.pending??audio.currentTime)-10);$('forward').onclick=()=>seek((state.pending??audio.currentTime)+10);$('previousSentence').onclick=()=>sentence(-1);$('nextSentence').onclick=()=>sentence(1);$('seek').oninput=()=>seek(Number($('seek').value));
$('rate').onchange=()=>{settings.rate=Number($('rate').value);audio.playbackRate=settings.rate;audio.preservesPitch=true;saveSettings();update();};
$('sectionPicker').onchange=()=>{const index=Number($('sectionPicker').value);seek(state.book.sections[index].start);renderParagraph(index);};
$('paragraphToggle').onclick=()=>{state.paragraph=!state.paragraph;$('paragraphPanel').hidden=!state.paragraph;$('wordStage').hidden=state.paragraph;$('paragraphToggle').textContent=t(state.paragraph?'singleWord':'showParagraph');state.section=-1;update();fitWord();};
$('back').onclick=()=>{++state.request;savePosition(true);audio.pause();state.book=null;audio.removeAttribute('src');audio.load();if(state.url)URL.revokeObjectURL(state.url);state.url=null;$('reader').hidden=true;$('library').hidden=false;document.title=t('title');syncWake();renderLibrary().catch(message);};
$('packages').onchange=async()=>{
 const files=[...$('packages').files];$('packages').disabled=true;
 try{
  for(const file of files){$('importStatus').textContent=t('adding')+file.name;const {book,audio:blob}=await P.readPackage(file),old=await dbRead('books',book.id);
   if(old?.revision===book.revision){$('importStatus').textContent=t('already');continue;}
   if(old&&!confirm(book.title+'\n'+t('newVersion')))continue;
   await dbWrite(book,blob);if(old)try{localStorage.removeItem('sp.phone.position:'+book.id);}catch{}$('importStatus').textContent=t('added')+book.title;
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
function setOffline(key){state.offline=key;$('offlineStatus').textContent=t(key);}
function applyLanguage(){L.applyStatic();$('languageSelect').value=L.language;$('offlineStatus').textContent=t(state.offline);document.title=state.book?state.book.source_title+t('appSuffix'):t('title');$('paragraphToggle').textContent=t(state.paragraph?'singleWord':'showParagraph');if(state.book){state.index=-2;update();}else $('word').textContent=t('ready');}
function changeLanguage(value){L.setLanguage(value);applyLanguage();renderLibrary().catch(message);}
$('language').onclick=()=>changeLanguage(L.language==='de'?'tr':'de');$('languageSelect').onchange=()=>changeLanguage($('languageSelect').value);
async function offlineSetup(){if(!('serviceWorker' in navigator)||!window.isSecureContext){setOffline('offlineHttps');return;}try{await navigator.serviceWorker.register('sw.js');await navigator.serviceWorker.ready;setOffline('offlineReady');}catch{setOffline('offlineFailed');}}
applyLanguage();applySettings();dbReady.then(renderLibrary).catch(error=>message(Error(t('storageOpenFailed')+L.translateError(error.message))));offlineSetup();
