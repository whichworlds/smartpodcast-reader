'use strict';
// Shared by the browser and lightweight Node tests. No network or UI dependencies.
(function(root){
 function validateBook(book){
  const finite=x=>typeof x==='number'&&Number.isFinite(x);
  if(book?.format!=='smartpodcast-reader'||book.version!==1||typeof book.id!=='string'||!book.id||book.id.length>200||typeof book.revision!=='string'||!book.revision||!finite(book.duration)||book.duration<=0||!Array.isArray(book.sections)||!book.sections.length)throw Error('Bu dosya geçerli bir Smart Podcast telefon paketi değil.');
  if(typeof book.title!=='string'||typeof book.source_title!=='string'||typeof book.source_id!=='string'||!finite(book.source_offset)||book.source_offset<0||!finite(book.source_duration)||book.source_duration<0)throw Error('Kitap bilgileri eksik.');
  const ids=new Set();let previousSection=0;
  for(const section of book.sections){
   if(typeof section.id!=='string'||ids.has(section.id)||typeof section.text!=='string'||typeof section.label!=='string'||!finite(section.start)||!finite(section.end)||section.start<previousSection||section.end<=section.start||section.end>book.duration+.05||!Array.isArray(section.words)||!section.words.length)throw Error('Bölüm bilgileri veya kelime zamanları geçersiz.');
   ids.add(section.id);previousSection=section.end;
   const points=Array.from(section.text);let previous=section.start,lastChar=0;
   for(const word of section.words){
    if(typeof word.word!=='string'||!finite(word.start)||!finite(word.end)||word.start<previous-.0002||word.end<word.start||word.end>section.end+.05||!Number.isInteger(word.char_start)||!Number.isInteger(word.char_end)||word.char_start<lastChar||word.char_end<=word.char_start||points.slice(word.char_start,word.char_end).join('')!==word.word)throw Error('Kelime zamanları metinle eşleşmiyor.');
    previous=word.end;lastChar=word.char_end;
   }
  }
  return book;
 }
 function sequenceInfo(book){
  const s=book.sequence;
  if(s&&typeof s.id==='string'&&s.id&&Number.isInteger(s.index)&&Number.isInteger(s.total)&&s.index>0&&s.index<=s.total)return s;
  const legacy=/^(.*)-telegram-(\d+)$/.exec(book.id||'');
  return legacy&&Number(legacy[2])>0?{id:legacy[1],index:Number(legacy[2]),total:null}:null;
 }
 function nextSequenceBook(books,current){
  const seq=sequenceInfo(current);if(!seq||seq.total&&seq.index>=seq.total)return null;
  return books.find(book=>{const next=sequenceInfo(book);return book.source_id===current.source_id&&book.language===current.language&&next?.id===seq.id&&next.index===seq.index+1;})||null;
 }
 function indexWords(book){return book.sections.flatMap((section,sectionIndex)=>section.words.map((word,wordIndex)=>({...word,sectionIndex,wordIndex})));}
 function wordAt(words,time){let lo=0,hi=words.length;while(lo<hi){const m=(lo+hi)>>>1;if(words[m].start<=time)lo=m+1;else hi=m;}return lo-1;}
 function remaining(duration,position,rate){return Math.ceil(Math.max(0,duration-position)/(rate>0?rate:1));}
 function clock(seconds){seconds=Math.max(0,Math.floor(seconds||0));const m=Math.floor(seconds/60);return (m>=60?Math.floor(m/60)+':'+String(m%60).padStart(2,'0'):String(m).padStart(2,'0'))+':'+String(seconds%60).padStart(2,'0');}
 // Stored (uncompressed) ZIP only: every entry is a byte range of the file, read as a Blob slice.
 async function readZip(file,maxEntries){
  if(file.size<22||file.size>2*1024**3)throw Error('Boş veya çok büyük paket. Kesitleri ayrı aktar.');
  const tail=new DataView(await file.slice(Math.max(0,file.size-65557)).arrayBuffer());let end=-1;
  for(let i=tail.byteLength-22;i>=0;i--)if(tail.getUint32(i,true)===0x06054b50&&i+22+tail.getUint16(i+20,true)===tail.byteLength){end=i;break;}
  if(end<0||tail.getUint16(end+4,true)||tail.getUint16(end+6,true))throw Error('Paket okunamadı. Bilgisayardan Telefon için indir seçeneğiyle yeniden hazırla.');
  const count=tail.getUint16(end+10,true),size=tail.getUint32(end+12,true),offset=tail.getUint32(end+16,true);
  if(!count||count>maxEntries||size>1024**2||offset+size>file.size-22)throw Error('Paket yapısı geçersiz.');
  const directory=new DataView(await file.slice(offset,offset+size).arrayBuffer()),entries=[],names=new Set();let cursor=0;
  for(let i=0;i<count;i++){
   if(cursor+46>size||directory.getUint32(cursor,true)!==0x02014b50)throw Error('Paket dizini bozuk.');
   const flags=directory.getUint16(cursor+8,true),method=directory.getUint16(cursor+10,true),compressed=directory.getUint32(cursor+20,true),length=directory.getUint32(cursor+24,true),nameLength=directory.getUint16(cursor+28,true),extra=directory.getUint16(cursor+30,true),comment=directory.getUint16(cursor+32,true),local=directory.getUint32(cursor+42,true);
   if(cursor+46+nameLength+extra+comment>size)throw Error('Paket dizini eksik.');
   const name=new TextDecoder().decode(new Uint8Array(directory.buffer,cursor+46,nameLength));
   if(names.has(name)||flags&1||method!==0||compressed!==length||local+30>offset)throw Error('Desteklenmeyen paket. Telefon için indir seçeneğini kullan.');
   const header=new DataView(await file.slice(local,local+30).arrayBuffer());
   if(header.getUint32(0,true)!==0x04034b50||header.getUint16(8,true)!==0)throw Error('Paket dosyası bozuk.');
   const dataStart=local+30+header.getUint16(26,true)+header.getUint16(28,true);
   if(dataStart+length>offset)throw Error('Paket yarım aktarılmış.');
   names.add(name);entries.push({name,start:dataStart,length});
   cursor+=46+nameLength+extra+comment;
  }
  return entries;
 }
 async function readPackage(file){
  const entries=new Map();
  for(const entry of await readZip(file,2)){
   if(!['book.json','audio.mp3'].includes(entry.name))throw Error('Desteklenmeyen paket. Telefon için indir seçeneğini kullan.');
   entries.set(entry.name,file.slice(entry.start,entry.start+entry.length,entry.name==='audio.mp3'?'audio/mpeg':'application/json'));
  }
  if(!entries.has('book.json')||!entries.has('audio.mp3')||entries.get('book.json').size>20*1024**2)throw Error('Paket içeriği eksik veya çok büyük.');
  const book=validateBook(JSON.parse(await entries.get('book.json').text())),audio=entries.get('audio.mp3');
  if(!audio.size||book.audio!=='audio.mp3'||book.audio_bytes!==audio.size)throw Error('MP3 eksik. Paketi yeniden aktar.');
  return {book,audio};
 }
 // A bundle from "Telefon için toplu indir" holds whole .smartpodcast packages; a single package holds book.json + audio.mp3.
 async function packagesIn(file){
  const entries=await readZip(file,500);
  if(entries.every(entry=>/\.smartpodcast$/i.test(entry.name)))return entries.map(entry=>({name:entry.name.replace(/^\d+-/,''),file:file.slice(entry.start,entry.start+entry.length)}));
  return [{name:file.name,file}];
 }
 root.PhoneReader={validateBook,sequenceInfo,nextSequenceBook,indexWords,wordAt,remaining,clock,readZip,readPackage,packagesIn};
 if(typeof module!=='undefined')module.exports=root.PhoneReader;
})(globalThis);
