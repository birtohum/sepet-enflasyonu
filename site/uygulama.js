"use strict";

const AYLAR = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
const AYLAR_UZUN = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const sayi = (x, k = 1) => x == null ? "—" : x.toLocaleString("tr-TR", { minimumFractionDigits: k, maximumFractionDigits: k });
const para = x => x == null ? "—" : sayi(x, 2);
const tl = x => x == null ? "—" : para(x) + " ₺";
const yuzde = (x, k = 1) => x == null ? "—" : (x > 0 ? "+" : x < 0 ? "−" : "") + "%" + sayi(Math.abs(x), k);
const gunYaz = g => { const [y, a, d] = g.split("-"); return `${+d} ${AYLAR[+a - 1]} ${y}`; };
const gunKisa = g => { const [, a, d] = g.split("-"); return `${+d} ${AYLAR[+a - 1]}`; };
const gunUzun = g => { const [y, a, d] = g.split("-"); return `${+d} ${AYLAR_UZUN[+a - 1]} ${y}`; };
const fisTarih = g => g.split("-").reverse().join(".");
const ayYaz = a => { const [y, m] = a.split("-"); return `${AYLAR_UZUN[+m - 1]} ${y}`; };
const ayKisa = a => { const [y, m] = a.split("-"); return `${AYLAR[+m - 1]} ${y.slice(2)}`; };
const $ = id => document.getElementById(id);
const el = (etiket, ozellik = {}, ...cocuk) => {
  const e = document.createElement(etiket);
  for (const [k, v] of Object.entries(ozellik)) {
    if (k === "class") e.className = v; else if (k === "html") e.innerHTML = v; else e.setAttribute(k, v);
  }
  for (const c of cocuk) if (c != null) e.append(c);
  return e;
};
const fisSatir = (ad, tutar, sinif = "") => el("div", { class: "fis-satir " + sinif },
  el("span", { class: "ad" }, ad), el("span", { class: "tutar", html: tutar }));

/* ---------------- çizgi grafik (tek eksen, ortak x) ---------------- */
const ipucu = $("ipucu");
function ipucuGoster(ev, html) {
  ipucu.innerHTML = html; ipucu.hidden = false;
  const w = ipucu.offsetWidth, h = ipucu.offsetHeight;
  let x = ev.clientX + 14, y = ev.clientY - h - 10;
  if (x + w > innerWidth - 8) x = ev.clientX - w - 14;
  if (y < 8) y = ev.clientY + 16;
  ipucu.style.left = x + "px"; ipucu.style.top = y + "px";
}
const ipucuGizle = () => { ipucu.hidden = true; };

function cizgiGrafik(kap, { etiketler, seriler, xYaz = x => x, yYaz = y => sayi(y, 1), eksenYaz, yukseklik = 260, taban = null }) {
  kap.innerHTML = "";
  if (seriler.length > 1) {
    kap.append(el("div", { class: "lejant" }, ...seriler.map(s => {
      const sp = el("span", {}, s.ad); sp.style.setProperty("--r", `var(${s.renk})`); return sp;
    })));
  }
  const G = Math.max(320, kap.clientWidth || 600), Y = yukseklik;
  const sol = 48, sag = 12, ust = 10, alt = 26;
  const n = etiketler.length;
  const tum = seriler.flatMap(s => s.veri.filter(v => v != null));
  if (taban != null) tum.push(taban);
  let min = Math.min(...tum), max = Math.max(...tum);
  if (min === max) { min -= 1; max += 1; }
  const pay = (max - min) * 0.08; min -= pay; max += pay;
  const adim = guzelAdim((max - min) / 4);
  const yMin = Math.floor(min / adim) * adim, yMax = Math.ceil(max / adim) * adim;
  const xP = i => sol + (n === 1 ? (G - sol - sag) / 2 : i * (G - sol - sag) / (n - 1));
  const yP = v => ust + (yMax - v) * (Y - ust - alt) / (yMax - yMin);
  const ey = eksenYaz || (v => sayi(v, adim < 1 ? 1 : 0));
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${G} ${Y}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", seriler.map(s => s.ad).join(", ") + " grafiği");
  let icerik = '<g class="izgara">';
  for (let v = yMin; v <= yMax + 1e-9; v += adim) icerik += `<line x1="${sol}" x2="${G - sag}" y1="${yP(v)}" y2="${yP(v)}"/>`;
  icerik += '</g><g class="eksen">';
  for (let v = yMin; v <= yMax + 1e-9; v += adim) icerik += `<text x="${sol - 6}" y="${yP(v) + 4}" text-anchor="end">${ey(v)}</text>`;
  const xAdim = Math.max(1, Math.ceil(n / Math.floor((G - sol - sag) / 70)));
  for (let i = 0; i < n; i += xAdim) icerik += `<text x="${xP(i)}" y="${Y - 6}" text-anchor="middle">${xYaz(etiketler[i])}</text>`;
  icerik += "</g>";
  if (taban != null && taban > yMin && taban < yMax) icerik += `<line class="taban" x1="${sol}" x2="${G - sag}" y1="${yP(taban)}" y2="${yP(taban)}" stroke-dasharray="3 3"/>`;
  for (const s of seriler) {
    let d = "", acik = false;
    s.veri.forEach((v, i) => {
      if (v == null) { acik = false; return; }
      d += (acik ? "L" : "M") + xP(i).toFixed(1) + " " + yP(v).toFixed(1); acik = true;
    });
    icerik += `<path d="${d}" fill="none" stroke="var(${s.renk})" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
    const sonI = s.veri.map((v, i) => v == null ? -1 : i).filter(i => i >= 0).pop();
    if (sonI != null) icerik += `<circle cx="${xP(sonI)}" cy="${yP(s.veri[sonI])}" r="4.5" fill="var(${s.renk})" stroke="var(--zemin)" stroke-width="2"/>`;
  }
  icerik += `<line class="imlec" x1="0" x2="0" y1="${ust}" y2="${Y - alt}" stroke="var(--metin-3)" stroke-width="1" visibility="hidden"/>`;
  icerik += `<g class="noktalar"></g><rect x="${sol}" y="0" width="${G - sol - sag}" height="${Y}" fill="transparent"/>`;
  svg.innerHTML = icerik;
  kap.append(svg);

  const imlec = svg.querySelector(".imlec"), noktalar = svg.querySelector(".noktalar");
  svg.addEventListener("pointermove", ev => {
    const r = svg.getBoundingClientRect();
    const x = (ev.clientX - r.left) * G / r.width;
    const i = n === 1 ? 0 : Math.max(0, Math.min(n - 1, Math.round((x - sol) / ((G - sol - sag) / (n - 1)))));
    imlec.setAttribute("x1", xP(i)); imlec.setAttribute("x2", xP(i)); imlec.setAttribute("visibility", "visible");
    noktalar.innerHTML = seriler.filter(s => s.veri[i] != null).map(s =>
      `<circle cx="${xP(i)}" cy="${yP(s.veri[i])}" r="5" fill="var(${s.renk})" stroke="var(--zemin)" stroke-width="2"/>`).join("");
    ipucuGoster(ev, `<div class="t">${xYaz(etiketler[i], true)}</div>` + seriler.map(s =>
      `<div><i style="--r:var(${s.renk})"></i>${s.ad}: <b>${yYaz(s.veri[i])}</b></div>`).join(""));
  });
  svg.addEventListener("pointerleave", () => { imlec.setAttribute("visibility", "hidden"); noktalar.innerHTML = ""; ipucuGizle(); });
}
function guzelAdim(x) {
  const us = Math.pow(10, Math.floor(Math.log10(x))), o = x / us;
  return (o < 1.5 ? 1 : o < 3 ? 2 : o < 7 ? 5 : 10) * us;
}

/* ---------------- ürün yardımcıları ---------------- */
// ilk ve son fiyat, yalnız aynı seri içinde (ilk_tarih sunucuda hesaplanıyor)
const ilkFiyat = u => u.ilk_tarih ? u.gecmis.find(g => g[0] === u.ilk_tarih)?.[1] : null;

/* ---------------- 1. ekran: ana fiş ---------------- */
function anaFis(o, urunler) {
  const s = o.sepet, son = s.gunler[s.gunler.length - 1], ilk = s.gunler[0];
  const fiyatli = urunler.filter(u => u.son_fiyat != null);
  const toplam = fiyatli.reduce((t, u) => t + u.son_fiyat, 0);
  $("fis-tarih").textContent = `${fisTarih(son)} · FİŞ NO ${String(s.veri_gunu).padStart(4, "0")}`;
  const satirlar = Object.entries(o.kategori_adlari).map(([k, ad]) => {
    const u = fiyatli.filter(x => x.kategori === k);
    return fisSatir(`${ad.toLocaleUpperCase("tr")} ×${u.length}`, para(u.reduce((t, x) => t + x.son_fiyat, 0)));
  });
  if (s.gunler.length > 1) {
    satirlar.push(el("div", { class: "fis-cizgi" }));
    satirlar.push(fisSatir(`ENDEKS (${gunKisa(ilk).toLocaleUpperCase("tr")} = 100)`, sayi(s.genel[s.genel.length - 1], 1), "alt-satir"));
  }
  $("fis-satirlar").replaceChildren(...satirlar);
  $("fis-toplam").textContent = tl(toplam);
  $("fis-alt").textContent = `${fiyatli.length} KALEM · HER ÜRÜNDEN BİRER ADET`;
  const fark = s.genel[s.genel.length - 1] - 100;
  $("fis-damga").textContent = s.durum === "toplaniyor"
    ? `VERİ TOPLANIYOR · ${s.veri_gunu}. GÜN`
    : `İLK GÜNDEN BERİ ${yuzde(fark)}`;
  $("sahne-not").innerHTML = s.durum === "toplaniyor"
    ? `Raf fiyatlarını <b>${gunUzun(ilk)}</b> tarihinde kaydetmeye başladık. Bu fiş her sabah yenileniyor. Birkaç hafta birikmeden "ne kadar arttı" demiyoruz.`
    : `Aynı ${s.urun_sayisi} ürün, ${gunUzun(ilk)} tarihinden beri her sabah kaydediliyor.`;
}

function serit(o) {
  const h = o.hal, son = h && h.aylar && h.aylar[h.aylar.length - 1];
  if (son) { $("hal-ay").textContent = ayYaz(son.ay); $("hal-sayi").textContent = yuzde(son.yillik); }
  if (o.tufe_son) { $("tufe-ay").textContent = ayYaz(o.tufe_son.ay); $("tufe-sayi").textContent = yuzde(o.tufe_son.yillik); }
}

/* ---------------- 01: kendi fişini kur ---------------- */
const HAZIR = {
  "Kahvaltı": ["su09", "su05", "su07", "dg03", "dg04", "su11", "ic01", "sk03", "ek10"],
  "Temel gıda": ["ek01", "ek02", "ek04", "ek06", "ya01", "sk01", "se06", "se07", "se09"],
  "Temizlik": ["te01", "te03", "te05", "te06", "te07", "ki01", "ki03"],
};
const ANAHTAR = "sepet-enflasyonu-secim";
function secimOku() { try { return new Set(JSON.parse(localStorage.getItem(ANAHTAR) || "[]")); } catch { return new Set(); } }
function secimYaz(s) { try { localStorage.setItem(ANAHTAR, JSON.stringify([...s])); } catch { /* özel pencere */ } }

function kendiFisi(o, urunler) {
  const secim = secimOku();
  const harita = Object.fromEntries(urunler.map(u => [u.kod, u]));
  const liste = $("urun-sec");
  const ciz = () => {
    const q = $("ara").value.toLocaleLowerCase("tr").trim();
    liste.replaceChildren(...urunler.filter(u => !q || u.ad.toLocaleLowerCase("tr").includes(q)).map(u => {
      const li = el("li", { role: "checkbox", tabindex: "0", "aria-checked": String(secim.has(u.kod)) },
        el("span", { class: "kutu" }, secim.has(u.kod) ? "✓" : ""),
        el("span", { class: "ad" }, u.ad),
        el("span", { class: "fiyat" }, tl(u.son_fiyat)));
      const gecmisDugme = el("button", { class: "gecmis-ac", "aria-label": u.ad + " fiyat geçmişi" }, "geçmiş");
      li.append(gecmisDugme);
      const degistir = () => { secim.has(u.kod) ? secim.delete(u.kod) : secim.add(u.kod); secimYaz(secim); ciz(); fisiYaz(); };
      li.addEventListener("click", e => { if (e.target !== gecmisDugme) degistir(); });
      li.addEventListener("keydown", e => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); degistir(); } });
      gecmisDugme.addEventListener("click", () => urunGecmisi(li, u));
      return li;
    }));
  };
  const fisiYaz = () => {
    const secili = [...secim].map(k => harita[k]).filter(u => u && u.son_fiyat != null);
    $("k-tarih").textContent = fisTarih(o.sepet.gunler[o.sepet.gunler.length - 1]);
    $("k-satirlar").replaceChildren(...secili.map(u => {
      const eski = ilkFiyat(u);
      const degisti = eski != null && Math.abs(eski - u.son_fiyat) > 0.004;
      return fisSatir(u.ad.toLocaleUpperCase("tr"), (degisti ? `<span class="eski">${para(eski)}</span>` : "") + para(u.son_fiyat));
    }));
    const toplam = secili.reduce((t, u) => t + u.son_fiyat, 0);
    $("k-toplam").textContent = tl(toplam);
    const gecmisli = secili.filter(u => u.ilk_tarih && u.gecmis.length > 1);
    if (!secili.length) $("k-degisim").textContent = "";
    else if (!gecmisli.length) $("k-degisim").textContent = `${secili.length} KALEM · DEĞİŞİM İKİNCİ GÜNDEN İTİBAREN GÖRÜNÜR`;
    else {
      const once = gecmisli.reduce((t, u) => t + ilkFiyat(u), 0), simdi = gecmisli.reduce((t, u) => t + u.son_fiyat, 0);
      $("k-degisim").textContent = `${secili.length} KALEM · İLK KAYITTAN BERİ ${yuzde((simdi / once - 1) * 100)}`;
    }
    $("paylas").disabled = $("temizle").disabled = !secili.length;
    return { secili, toplam };
  };
  $("hizli").replaceChildren(...Object.entries(HAZIR).map(([ad, kodlar]) => {
    const b = el("button", { type: "button" }, "+ " + ad);
    b.addEventListener("click", () => { kodlar.forEach(k => secim.add(k)); secimYaz(secim); ciz(); fisiYaz(); });
    return b;
  }));
  $("ara").addEventListener("input", ciz);
  $("temizle").addEventListener("click", () => { secim.clear(); secimYaz(secim); ciz(); fisiYaz(); });
  $("paylas").addEventListener("click", () => paylas(fisiYaz(), o));
  ciz(); fisiYaz();
}

function urunGecmisi(li, u) {
  const sonraki = li.nextElementSibling;
  if (sonraki && sonraki.classList.contains("detay")) { sonraki.remove(); return; }
  const d = el("li", { class: "detay" });
  li.after(d);
  if (u.gecmis.length < 2) {
    d.append(el("div", { class: "fis-kucuk" }, u.gecmis.length
      ? `${gunYaz(u.gecmis[0][0])}: ${tl(u.gecmis[0][1])} (liste fiyatı ${tl(u.gecmis[0][2])}). Grafik ikinci günden itibaren.`
      : "Bu ürünün fiyatı henüz okunamadı."));
  } else {
    const g = el("div", { class: "grafik" }); d.append(g);
    cizgiGrafik(g, {
      etiketler: u.gecmis.map(x => x[0]), yukseklik: 180,
      seriler: [{ ad: "Ödenen fiyat", renk: "--seri-1", veri: u.gecmis.map(x => x[1]) },
                { ad: "Liste fiyatı", renk: "--seri-2", veri: u.gecmis.map(x => x[2]) }],
      xYaz: (x, uzun) => uzun ? gunYaz(x) : gunKisa(x), yYaz: tl,
    });
  }
  d.append(el("div", { class: "fis-kucuk", html: `<a href="${u.url}" rel="nofollow noopener" target="_blank">ürün sayfası</a> · ${u.miktar} ${u.birim}` }));
}

/* paylaşım kartı: fişin görüntüsü (canvas) */
async function paylas({ secili, toplam }, o) {
  const W = 720, satirH = 34, ust = 210, altH = 250;
  const H = ust + secili.length * satirH + altH;
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const x = c.getContext("2d");
  await document.fonts.ready;
  const mono = (w, b = 22) => `${w} ${b}px "IBM Plex Mono", monospace`;
  x.fillStyle = "#ffd23f"; x.fillRect(0, 0, W, H);
  const kx = 60, kw = W - 120;
  x.fillStyle = "#fffef9"; x.fillRect(kx, 40, kw, H - 80);
  x.fillStyle = "#ffd23f"; // testere dişi
  for (let i = kx; i < kx + kw; i += 20) {
    x.beginPath(); x.moveTo(i, 40); x.lineTo(i + 10, 50); x.lineTo(i + 20, 40); x.fill();
    x.beginPath(); x.moveTo(i, H - 40); x.lineTo(i + 10, H - 50); x.lineTo(i + 20, H - 40); x.fill();
  }
  x.fillStyle = "#1d1c1a"; x.textAlign = "center";
  x.font = `700 34px "IBM Plex Mono", monospace`; x.fillText("BENİM SEPETİM", W / 2, 110);
  x.font = mono(400); x.fillStyle = "#5c5a55";
  x.fillText(fisTarih(o.sepet.gunler[o.sepet.gunler.length - 1]) + " · ŞOK ÇEVRİMİÇİ", W / 2, 150);
  const kesik = y => { x.strokeStyle = "#b9b4a8"; x.setLineDash([8, 6]); x.lineWidth = 2; x.beginPath(); x.moveTo(kx + 30, y); x.lineTo(kx + kw - 30, y); x.stroke(); x.setLineDash([]); };
  kesik(180);
  let y = ust + 10;
  x.font = mono(400); x.fillStyle = "#1d1c1a";
  for (const u of secili) {
    x.textAlign = "left";
    let ad = u.ad.toLocaleUpperCase("tr");
    while (x.measureText(ad).width > kw - 200 && ad.length > 4) ad = ad.slice(0, -2) + "…";
    x.fillText(ad, kx + 30, y);
    x.textAlign = "right"; x.fillText(para(u.son_fiyat), kx + kw - 30, y);
    y += satirH;
  }
  kesik(y); y += 60;
  x.textAlign = "left"; x.font = `700 30px "IBM Plex Mono", monospace`; x.fillText("TOPLAM", kx + 30, y);
  x.textAlign = "right"; x.font = `700 48px "IBM Plex Mono", monospace`; x.fillText(tl(toplam), kx + kw - 30, y + 4);
  x.textAlign = "center"; x.font = mono(400, 17); x.fillStyle = "#5c5a55";
  x.fillText($("k-degisim").textContent, W / 2, y + 60, kw - 40);
  x.fillStyle = "#c8302b"; x.font = `700 19px "IBM Plex Mono", monospace`;
  x.fillText("SEPET ENFLASYONU · birtohum.github.io/enflasyon", W / 2, y + 110, kw - 40);
  const blob = await new Promise(r => c.toBlob(r, "image/png"));
  const dosya = new File([blob], "benim-sepetim.png", { type: "image/png" });
  if (navigator.canShare && navigator.canShare({ files: [dosya] })) {
    try { await navigator.share({ files: [dosya], title: "Benim sepetim" }); return; } catch { /* vazgeçildi */ }
  }
  const a = el("a", { href: URL.createObjectURL(blob), download: "benim-sepetim.png" });
  document.body.append(a); a.click(); a.remove();
}

/* ---------------- 02: sepet endeksi ---------------- */
function sepetBolumu(o) {
  const s = o.sepet, kap = $("g-sepet");
  if (s.gunler.length < 2) {
    $("sepet-ozet").textContent = "İlk gün = 100. Her ürün eşit ağırlıklı; günlük değişimlerin geometrik ortalaması zincirlenir.";
    kap.replaceChildren(el("div", { class: "bos" }, `Şimdilik tek gün var (${gunYaz(s.gunler[0])}). Çizgi ikinci günden itibaren çizilecek.`));
  } else {
    const fark = s.genel[s.genel.length - 1] - 100;
    $("sepet-baslik").textContent = s.durum === "toplaniyor"
      ? "Sepet endeksi (veri toplanıyor)"
      : `Sepet ilk günden beri ${yuzde(fark)}`;
    $("sepet-ozet").textContent = `İlk gün = 100. ${s.veri_gunu} günlük veri. Her ürün eşit ağırlıklı; ilk haftalarda kampanyalar çizgiyi oynatır.`;
    cizgiGrafik(kap, {
      etiketler: s.gunler, taban: 100,
      seriler: [{ ad: "Sepet endeksi", renk: "--seri-1", veri: s.genel }],
      xYaz: (g, uzun) => uzun ? gunYaz(g) : gunKisa(g),
    });
  }
  const k = s.karsilastirma, kk = $("karsilastirma");
  if (!k.length) {
    const [y, m] = s.gunler[0].split("-").map(Number);
    const sonraki = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
    kk.replaceChildren(el("p", { class: "bolum-ozet", html:
      `<b>TÜİK ile karşılaştırma:</b> iki tam ay gerekiyor. İlk satır <b>${ayYaz(sonraki)}</b> için olacak; TÜİK o ayın TÜFE'sini bir sonraki ayın başında açıklar.` }));
    return;
  }
  kk.replaceChildren(el("h3", {}, "Aylık değişim, TÜİK TÜFE ile yan yana"), el("div", { class: "tablo-kap" }, el("table", {},
    el("thead", { html: '<tr><th>Ay</th><th class="s">Sepet</th><th class="s">TÜFE</th><th class="s gizle-dar">Veri günü</th></tr>' }),
    el("tbody", {}, ...k.slice().reverse().map(r => el("tr", { html:
      `<td>${ayYaz(r.ay)}</td><td class="s">${yuzde(r.seri_aylik, 2)}</td><td class="s">${r.tufe_aylik == null ? "açıklanmadı" : yuzde(r.tufe_aylik, 2)}</td><td class="s gizle-dar">${r.gun}</td>` }))))),
    el("p", { class: "bolum-ozet" }, "Kapsamlar farklı: sepet market ürünleri, TÜFE tüm harcamalar. Fark tek başına \"TÜFE yanlış\" anlamına gelmez."));
}

/* ---------------- 03: en çok değişenler ---------------- */
function zamlar(urunler) {
  const kap = $("zamlar");
  const d = urunler.filter(u => u.degisim_yuzde != null && u.degisim_yuzde !== 0).sort((a, b) => b.degisim_yuzde - a.degisim_yuzde);
  if (!d.length) {
    kap.replaceChildren(el("div", { class: "bos" }, "Henüz fiyatı değişen ürün yok: elimizde tek günlük raf fiyatı var. Liste ikinci günlük kayıttan itibaren dolar."));
    return;
  }
  const artan = d.filter(u => u.degisim_yuzde > 0).slice(0, 10);
  const azalan = d.filter(u => u.degisim_yuzde < 0).slice(-5).reverse();
  const satir = u => el("div", { class: "fis-satir" },
    el("span", { class: "ad" }, u.ad.toLocaleUpperCase("tr")),
    el("span", { class: "tutar", html: `<span class="eski">${para(ilkFiyat(u))}</span>${para(u.son_fiyat)}` }),
    el("span", { class: "tutar yuzde " + (u.degisim_yuzde > 0 ? "arti-m" : "eksi-m") }, yuzde(u.degisim_yuzde)));
  kap.replaceChildren(el("article", { class: "fis zam-fis" },
    el("div", { class: "fis-ust" }, el("div", { class: "fis-logo" }, "ZAM FİŞİ"), el("div", { class: "fis-kucuk" }, "İLK KAYIT → BUGÜN")),
    el("div", { class: "fis-cizgi" }), ...artan.map(satir),
    azalan.length ? el("div", { class: "fis-cizgi" }) : null,
    azalan.length ? el("div", { class: "fis-kucuk" }, "UCUZLAYANLAR") : null, ...azalan.map(satir)));
}

/* ---------------- 04: hal ---------------- */
function hal(o) {
  const h = o.hal;
  if (!h || !h.aylar || !h.aylar.length) { $("b-hal").hidden = true; return; }
  const aylar = h.aylar, hy = aylar.map(a => a.yillik), ty = aylar.map(a => a.tufe_yillik).filter(v => v != null);
  $("hal-aciklama").innerHTML = `Son ${aylar.length} ayda İzmir halinde sebze-meyvenin yıllık değişimi <b>${yuzde(Math.min(...hy))}</b> ile <b>${yuzde(Math.max(...hy))}</b> arasında gezdi;
    aynı dönemde TÜFE ${yuzde(Math.min(...ty))} ile ${yuzde(Math.max(...ty))} arasında kaldı. Her ay, bir yıl önceki aynı ayla ve iki ayda da satılan aynı ürünlerle karşılaştırılır.
    Toptan fiyattır ve İzmir'e aittir; TÜFE ise tüm harcamaları kapsar. Aynı şeyi ölçmezler.`;
  cizgiGrafik($("g-hal"), {
    etiketler: aylar.map(a => a.ay), taban: 0,
    seriler: [
      { ad: "İzmir hali, sebze-meyve (toptan)", renk: "--seri-1", veri: hy },
      { ad: "TÜİK TÜFE (genel)", renk: "--seri-2", veri: aylar.map(a => a.tufe_yillik) },
    ],
    xYaz: (a, uzun) => uzun ? ayYaz(a) : ayKisa(a),
    yYaz: y => y == null ? "açıklanmadı" : yuzde(y), eksenYaz: v => (v < 0 ? "−%" : "%") + sayi(Math.abs(v), 0),
  });
  $("t-hal").replaceChildren(el("div", { class: "tablo-kap" }, el("table", {},
    el("thead", { html: '<tr><th>Ay</th><th class="s">Hal, yıllık</th><th class="s">TÜFE, yıllık</th><th class="s gizle-dar">Ürün</th></tr>' }),
    el("tbody", {}, ...aylar.slice().reverse().map(a => el("tr", { html:
      `<td>${ayYaz(a.ay)}</td><td class="s">${yuzde(a.yillik)}</td><td class="s">${a.tufe_yillik == null ? "açıklanmadı" : yuzde(a.tufe_yillik)}</td><td class="s gizle-dar">${a.mal}</td>` }))))));
}

/* ---------------- 05: kategoriler ---------------- */
function kategoriler(o, urunler) {
  const s = o.sepet, kap = $("kategoriler");
  const sayac = {};
  urunler.forEach(u => { sayac[u.kategori] = (sayac[u.kategori] || 0) + 1; });
  if (s.gunler.length < 2) {
    $("kat-ozet").textContent = "Kategori değişimleri ikinci günden itibaren hesaplanır. Şimdilik sepetin dağılımı:";
    kap.replaceChildren(el("div", { class: "tablo-kap" }, el("table", { class: "kat-tablo" },
      el("thead", { html: '<tr><th>Kategori</th><th class="s">Ürün</th></tr>' }),
      el("tbody", {}, ...Object.entries(o.kategori_adlari).map(([k, ad]) => el("tr", { html: `<td>${ad}</td><td class="s">${sayac[k] || 0}</td>` }))))));
    return;
  }
  $("kat-ozet").textContent = `Kategori endekslerinin ${gunYaz(s.gunler[0])} tarihinden bugüne değişimi.`;
  const satirlar = Object.entries(o.kategori_adlari).map(([k, ad]) => {
    const seri = s.kategori[k] || [], son = seri[seri.length - 1] ?? 100;
    return { ad, deger: son - 100, ipucu: `${sayac[k] || 0} ürün · endeks ${sayi(son, 1)}` };
  }).sort((a, b) => b.deger - a.deger);
  const enBuyuk = Math.max(1, ...satirlar.map(x => Math.abs(x.deger)));
  kap.replaceChildren(el("div", { class: "cubuklar" }, ...satirlar.map(x => {
    const gen = Math.abs(x.deger) / enBuyuk * 50;
    const dolgu = el("div", { class: "dolgu " + (x.deger >= 0 ? "arti" : "eksi") });
    dolgu.style.width = gen + "%"; dolgu.style.left = x.deger >= 0 ? "50%" : (50 - gen) + "%";
    const satir = el("div", { class: "cubuk" }, el("div", {}, x.ad), el("div", { class: "yol" }, el("div", { class: "orta" }), dolgu),
      el("div", { class: "yuzde " + (x.deger > 0 ? "arti-m" : x.deger < 0 ? "eksi-m" : "") }, yuzde(x.deger)));
    satir.addEventListener("pointermove", ev => ipucuGoster(ev, `<div class="t">${x.ad}</div>${x.ipucu}`));
    satir.addEventListener("pointerleave", ipucuGizle);
    return satir;
  })));
}

async function basla() {
  try {
    const [o, urunler] = await Promise.all([
      fetch("veri/ozet.json", { cache: "no-cache" }).then(r => r.json()),
      fetch("veri/urunler.json", { cache: "no-cache" }).then(r => r.json()),
    ]);
    document.querySelectorAll(".urun-sayisi").forEach(e => { e.textContent = o.sepet.urun_sayisi; });
    $("guncelleme").textContent = gunYaz(o.guncelleme);
    anaFis(o, urunler); serit(o); kendiFisi(o, urunler); sepetBolumu(o);
    zamlar(urunler); hal(o); kategoriler(o, urunler);
    let gen = innerWidth;
    addEventListener("resize", () => { if (Math.abs(innerWidth - gen) > 40) { gen = innerWidth; sepetBolumu(o); hal(o); } });
  } catch (e) {
    $("sahne-not").textContent = "Veri yüklenemedi: " + e.message;
  }
}
basla();
