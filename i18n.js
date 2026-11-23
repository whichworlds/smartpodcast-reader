'use strict';
// Interface language (Turkish / German). Book text keeps its own language.
(function(root){
 const S={
  title:['Smart Podcast · Cep Okuyucu','Smart Podcast · Taschenleser'],
  appSuffix:[' · Cep Okuyucu',' · Taschenleser'],
  tagline:['CEP OKUYUCU','TASCHENLESER'],
  langButton:['DE','TR'],langAria:['Arayüzü Almanca yap','Oberfläche auf Türkisch umstellen'],
  install:['Yükle ↗','Installieren ↗'],
  eyebrow:['KENDİ RİTMİNDE','IN DEINEM RHYTHMUS'],
  headline:['Dinle.<br><span>Kelime kelime.</span>','Hören.<br><span>Wort für Wort.</span>'],
  intro:['Sesin ve metnin aynı yerde.<br>Kitapların her zaman yanında.','Stimme und Text an einem Ort.<br>Deine Bücher immer dabei.'],
  library:['Kitaplığım','Meine Bibliothek'],
  addBook:['＋ Kitap ekle','＋ Buch hinzufügen'],
  emptyTitle:['İlk kitabına yer aç.','Platz für dein erstes Buch.'],
  emptyText:['Bilgisayarda <strong>Dışa aktar → Telefon için indir</strong> seçeneğini kullan. Dosyayı telefonuna aktarıp buradan ekle.','Wähle am Computer <strong>Dışa aktar → Telefon için indir</strong> (Exportieren → Für das Telefon). Übertrage die Datei aufs Telefon und füge sie hier hinzu.'],
  storageNote:['Kitaplar ve dinleme noktaları yalnız bu cihazda saklanır. Tarayıcı verilerini temizlemek kitaplığı kaldırır; paketlerini sakla.','Bücher und Hörpositionen bleiben nur auf diesem Gerät. Wenn du die Browserdaten löschst, ist die Bibliothek weg – bewahre deine Pakete auf.'],
  help:['Nasıl kullanırım?','Wie funktioniert es?'],
  back:['Kitaplığa dön','Zurück zur Bibliothek'],
  settings:['Okuma ayarları','Leseeinstellungen'],
  prevSentence:['Önceki cümle','Vorheriger Satz'],nextSentence:['Sonraki cümle','Nächster Satz'],
  section:['Bölüm','Abschnitt'],seekAria:['Dinleme konumu','Hörposition'],
  rewind:['{n} saniye geri','{n} Sekunden zurück'],forward:['{n} saniye ileri','{n} Sekunden vor'],sec:['sn','s'],step:['Atlama süresi {n} sn · değiştirmek için dokun','Sprungweite {n} s · zum Ändern tippen'],
  rateAria:['Oynatma hızı','Wiedergabegeschwindigkeit'],
  close:['Kapat','Schließen'],fontSize:['Yazı boyutu','Schriftgröße'],view:['Görünüm','Darstellung'],
  dark:['Koyu','Dunkel'],paper:['Kâğıt','Papier'],keepAwake:['Ekranı açık tut','Bildschirm anlassen'],
  brightness:['Okuma alanı parlaklığı','Helligkeit des Lesebereichs'],language:['Arayüz dili','Sprache der Oberfläche'],
  settingsNote:['Kelime hızı sesin hızını izler. Uzun kelimeler ekrana sığacak şekilde küçülür.','Das Worttempo folgt der Stimme. Lange Wörter werden verkleinert, damit sie passen.'],
  ok:['Tamam','Fertig'],
  helpTitle:['Cebindeki okuyucu','Dein Taschenleser'],
  help1:['Bilgisayarda hazır kesiti seç. Dışa aktar içinden <strong>Telefon için indir</strong> seçeneğini kullan.','Wähle am Computer den fertigen Abschnitt und nutze unter Dışa aktar <strong>Telefon için indir</strong>.'],
  help2:['<strong>.smartpodcast</strong> dosyasını USB veya kullandığın dosya aktarımıyla telefonuna taşı.','Übertrage die <strong>.smartpodcast</strong>-Datei per USB oder Dateiübertragung aufs Telefon.'],
  help3:['<strong>Kitap ekle</strong> ile dosyayı seç. İlk kayıttan sonra bağlantı gerekmez.','Wähle die Datei mit <strong>Buch hinzufügen</strong>. Danach ist keine Verbindung mehr nötig.'],
  helpTap:['Kitabın ▶ düğmesine dokununca hemen dinlemeye başlarsın. Okurken birkaç saniye sonra odak modu açılır: yalnız kelime kalır. Ekrana dokununca her şey geri gelir; kelimeye dokunarak odak modunu elle de açabilirsin. ↶ ↷ altındaki sayıya dokunarak atlama süresini 5, 10, 15 veya 30 saniye yap.','Tippe auf ▶ beim Buch, um sofort zu hören. Beim Lesen startet nach wenigen Sekunden der Fokusmodus: Nur das Wort bleibt. Ein Tipp auf den Bildschirm holt alles zurück; tippe auf das Wort, um den Fokusmodus selbst zu starten. Tippe auf die Zahl unter ↶ ↷, um die Sprungweite auf 5, 10, 15 oder 30 Sekunden zu stellen.'],
  helpInstall:['Android Chrome menüsünden <strong>Uygulamayı yükle / Ana ekrana ekle</strong> seçeneğini kullan. İlk kurulumda internet gerekir; ardından okuyucu ve içeri aktardığın kitaplar çevrimdışı açılır.','Nutze im Chrome-Menü <strong>App installieren / Zum Startbildschirm hinzufügen</strong>. Nur beim ersten Mal braucht es Internet; danach öffnen sich Leser und Bücher offline.'],
  gotIt:['Anladım','Verstanden'],
  sleep:['Uyku zamanlayıcısı','Schlaf-Timer'],sleepOff:['Kapalı','Aus'],min:['dk','Min.'],hour:['1 saat','1 Stunde'],sleepSection:['Bölüm bitince','Am Abschnittsende'],sleepEnd:['bölüm sonu','Abschnittsende'],
  sleepNote:['Son 30 saniyede ses yavaşça kısılır ve durur. Bir sonraki oynatmada 1 dakika geri sarılır. Zamanlayıcı açıkken ekran kendiliğinden kapanabilir; ses çalmaya devam eder.','In den letzten 30 Sekunden wird der Ton leiser und stoppt. Beim nächsten Abspielen geht es 1 Minute zurück. Mit Timer darf sich der Bildschirm ausschalten; der Ton läuft weiter.'],
  ready:['Hazır','Bereit'],slice:['Kesit ','Abschnitt '],slices:['kesit','Abschnitte'],resume:['Devam: ','Weiter: '],left:[' kaldı',' übrig'],remaining:['Kalan ','Noch '],
  play:['Oynat','Abspielen'],pause:['Duraklat','Pause'],listen:['Dinle: ','Anhören: '],
  remove:['Bu cihazdan kaldır: ','Von diesem Gerät entfernen: '],
  removeConfirm:['Bu cihazdan kaldırılsın mı? Bilgisayardaki dosyalar korunur.','Von diesem Gerät entfernen? Die Dateien auf dem Computer bleiben erhalten.'],
  showParagraph:['Paragrafı göster','Absatz zeigen'],singleWord:['Tek kelimeye dön','Zurück zum Einzelwort'],
  adding:['Ekleniyor: ','Wird hinzugefügt: '],added:['Eklendi: ','Hinzugefügt: '],already:['Bu kesit zaten kitaplıkta.','Dieser Abschnitt ist schon in der Bibliothek.'],
  newVersion:['Yeni sürüm eklensin mi? Eski sürüm ve dinleme noktası değişecek.','Neue Version hinzufügen? Alte Version und Hörposition werden ersetzt.'],
  offlinePreparing:['Çevrimdışı kullanım hazırlanıyor…','Offline-Nutzung wird vorbereitet…'],
  offlineReady:['✓ Çevrimdışı kullanıma hazır','✓ Bereit für die Offline-Nutzung'],
  offlineHttps:['Çevrimdışı kurulum için okuyucuyu HTTPS adresinden aç.','Öffne den Leser über eine HTTPS-Adresse, um ihn offline zu nutzen.'],
  offlineFailed:['Çevrimdışı hazırlık tamamlanamadı. İnternet açıkken sayfayı yenile.','Offline-Vorbereitung fehlgeschlagen. Lade die Seite mit Internet neu.'],
  playFailed:['Ses başlatılamadı. Oynat düğmesine tekrar dokun.','Ton konnte nicht starten. Tippe noch einmal auf Abspielen.'],
  mp3Failed:['MP3 okunamadı. Paketi yeniden ekle.','MP3 konnte nicht gelesen werden. Füge das Paket erneut hinzu.'],
  positionFailed:['Dinleme noktası saklanamadı. Tarayıcının saklama iznini kontrol et.','Hörposition konnte nicht gespeichert werden. Prüfe die Speicherberechtigung des Browsers.'],
  storageOpenFailed:['Cihazda saklama açılamadı. Normal Chrome sekmesinde dene. ','Gerätespeicher nicht verfügbar. Versuche es in einem normalen Chrome-Tab. '],
  quota:['Telefonda yeterli saklama alanı yok. Eski bir kitabı kaldırıp yeniden dene.','Nicht genug Speicher auf dem Telefon. Entferne ein altes Buch und versuche es erneut.']
 };
 // Errors raised in Turkish by core.js / storage, translated by their exact text.
 const ERRORS={
  'Başka bir okuyucu sekmesini kapatıp yeniden dene.':'Schließe den anderen Leser-Tab und versuche es erneut.',
  'Kayıt tamamlanamadı.':'Speichern fehlgeschlagen.',
  'Kitap bulunamadı. Paketi yeniden ekle.':'Buch nicht gefunden. Füge das Paket erneut hinzu.',
  'Bu dosya geçerli bir Smart Podcast telefon paketi değil.':'Diese Datei ist kein gültiges Smart-Podcast-Paket.',
  'Kitap bilgileri eksik.':'Buchangaben fehlen.',
  'Bölüm bilgileri veya kelime zamanları geçersiz.':'Abschnittsangaben oder Wortzeiten sind ungültig.',
  'Kelime zamanları metinle eşleşmiyor.':'Wortzeiten passen nicht zum Text.',
  'Boş veya çok büyük paket. Kesitleri ayrı aktar.':'Paket leer oder zu groß. Übertrage die Abschnitte einzeln.',
  'Paket okunamadı. Bilgisayardan Telefon için indir seçeneğiyle yeniden hazırla.':'Paket nicht lesbar. Erstelle es am Computer neu mit „Telefon için indir“.',
  'Paket yapısı geçersiz.':'Paketstruktur ungültig.','Paket dizini bozuk.':'Paketverzeichnis beschädigt.','Paket dizini eksik.':'Paketverzeichnis unvollständig.',
  'Desteklenmeyen paket. Telefon için indir seçeneğini kullan.':'Nicht unterstütztes Paket. Nutze „Telefon için indir“.',
  'Paket dosyası bozuk.':'Paketdatei beschädigt.','Paket yarım aktarılmış.':'Paket wurde nur teilweise übertragen.',
  'Paket içeriği eksik veya çok büyük.':'Paketinhalt fehlt oder ist zu groß.','MP3 eksik. Paketi yeniden aktar.':'MP3 fehlt. Übertrage das Paket erneut.'
 };
 let language='tr';
 try{const saved=localStorage.getItem('sp.phone.language');language=saved==='de'||saved==='tr'?saved:((navigator.language||'').toLowerCase().startsWith('de')?'de':'tr');}catch{}
 const t=key=>(S[key]||[key,key])[language==='de'?1:0];
 const translateError=text=>language==='de'&&ERRORS[text]?ERRORS[text]:text;
 function applyStatic(){
  document.documentElement.lang=language;
  for(const n of document.querySelectorAll('[data-i18n]'))n.textContent=t(n.dataset.i18n);
  for(const n of document.querySelectorAll('[data-i18n-html]'))n.innerHTML=t(n.dataset.i18nHtml);
  for(const n of document.querySelectorAll('[data-i18n-aria]'))n.setAttribute('aria-label',t(n.dataset.i18nAria));
 }
 function setLanguage(value){language=value==='de'?'de':'tr';try{localStorage.setItem('sp.phone.language',language);}catch{}applyStatic();}
 root.I18n={t,translateError,applyStatic,setLanguage,get language(){return language;}};
})(globalThis);
