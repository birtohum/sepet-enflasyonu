"use strict";

const AYLAR = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
const AYLAR_UZUN = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const sayi = (x, k = 1) => x == null ? "—" : x.toLocaleString("tr-TR", { minimumFractionDigits: k, maximumFractionDigits: k });
const tl = x => x == null ? "—" : x.toLocaleString("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 });
const yuzde = (x, k = 1) => x == null ? "—" : (x > 0 ? "+" : x < 0 ? "−" : "") + "%" + sayi(Math.abs(x), k);
const gunYaz = g => { const [y, a, d] = g.split("-"); return `${+d} ${AYLAR[+a - 1]} ${y}`; };
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
const renk = ad => getComputedStyle(document.documentElement).getPropertyValue(ad).trim();

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

function cizgiGrafik(kap, { etiketler, seriler, xYaz = x => x, yYaz = y => sayi(y, 1), yukseklik = 260, taban = null }) {
  kap.innerHTML = "";
  if (seriler.length > 1) {
    kap.append(el("div", { class: "lejant" }, ...seriler.map(s => {
      const sp = el("span", {}, s.ad); sp.style.setProperty("--r", `var(${s.renk})`); return sp;
    })));
  }
  const G = Math.max(320, kap.clientWidth || 600), Y = yukseklik;
  const sol = 44, sag = 12, ust = 10, alt = 26;
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
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", `0 0 ${G} ${Y}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", seriler.map(s => s.ad).join(", ") + " grafiği");
  let icerik = '<g class="izgara">';
  for (let v = yMin; v <= yMax + 1e-9; v += adim) icerik += `<line x1="${sol}" x2="${G - sag}" y1="${yP(v)}" y2="${yP(v)}"/>`;
  icerik += '</g><g class="eksen">';
  for (let v = yMin; v <= yMax + 1e-9; v += adim) icerik += `<text x="${sol - 6}" y="${yP(v) + 4}" text-anchor="end">${sayi(v, adim < 1 ? 1 : 0)}</text>`;
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
    icerik += `<path d="${d}" fill="none" stroke="var(${s.renk})" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    const sonI = s.veri.map((v, i) => v == null ? -1 : i).filter(i => i >= 0).pop();
    if (sonI != null) icerik += `<circle cx="${xP(sonI)}" cy="${yP(s.veri[sonI])}" r="4" fill="var(${s.renk})" stroke="var(--yuzey)" stroke-width="2"/>`;
  }
  icerik += `<line class="imlec" x1="0" x2="0" y1="${ust}" y2="${Y - alt}" stroke="var(--metin-3)" stroke-width="1" visibility="hidden"/>`;
  icerik += `<g class="noktalar"></g><rect x="${sol}" y="0" width="${G - sol - sag}" height="${Y}" fill="transparent"/>`;
  svg.innerHTML = icerik;
  kap.append(svg);

  const imlec = svg.querySelector(".imlec"), noktalar = svg.querySelector(".noktalar");
  const tasi = ev => {
    const r = svg.getBoundingClientRect();
    const x = (ev.clientX - r.left) * G / r.width;
    const i = n === 1 ? 0 : Math.max(0, Math.min(n - 1, Math.round((x - sol) / ((G - sol - sag) / (n - 1)))));
    imlec.setAttribute("x1", xP(i)); imlec.setAttribute("x2", xP(i)); imlec.setAttribute("visibility", "visible");
    noktalar.innerHTML = seriler.filter(s => s.veri[i] != null).map(s =>
      `<circle cx="${xP(i)}" cy="${yP(s.veri[i])}" r="4.5" fill="var(${s.renk})" stroke="var(--yuzey)" stroke-width="2"/>`).join("");
    ipucuGoster(ev, `<div class="t">${xYaz(etiketler[i], true)}</div>` + seriler.map(s =>
      `<div><i style="--r:var(${s.renk})"></i>${s.ad}: <b>${yYaz(s.veri[i])}</b></div>`).join(""));
  };
  const birak = () => { imlec.setAttribute("visibility", "hidden"); noktalar.innerHTML = ""; ipucuGizle(); };
  svg.addEventListener("pointermove", tasi);
  svg.addEventListener("pointerleave", birak);
}
function guzelAdim(x) {
  const us = Math.pow(10, Math.floor(Math.log10(x))), o = x / us;
  return (o < 1.5 ? 1 : o < 3 ? 2 : o < 7 ? 5 : 10) * us;
}

/* ---------------- bölümler ---------------- */
function durumYaz(o) {
  const s = o.sepet;
  if (s.durum === "toplaniyor") {
    const kalan = 28 - s.veri_gunu;
    $("durum").innerHTML = `<strong>Veri toplanıyor — ${s.veri_gunu} gün</strong>
      Perakende sepet verisi ${gunYaz(s.gunler[0])} tarihinde başladı. Kısa dönemde kampanyalar ve tek tük fiyat değişimleri
      endeksi oynatır; bu yüzden en az ${kalan > 0 ? kalan + " gün daha" : "birkaç hafta"} veri birikmeden sepet hakkında yorum yapmıyoruz.
      TÜFE ile aylık karşılaştırma için iki tam ay gerekiyor.`;
  }
}

function kartlar(o, urunler) {
  const s = o.sepet, son = s.genel[s.genel.length - 1];
  const fiyatli = urunler.filter(u => u.son_fiyat != null);
  const toplam = fiyatli.reduce((t, u) => t + u.son_fiyat, 0);
  const k = [
    ["Sepet endeksi", sayi(son, 1), `İlk gün (${gunYaz(s.gunler[0])}) = 100`],
    ["Sepetin bugünkü tutarı", tl(toplam), `Her üründen birer adet, ${fiyatli.length}/${s.urun_sayisi} ürün fiyatlı`],
    ["Veri günü", String(s.veri_gunu), `Son kayıt: ${gunYaz(s.gunler[s.gunler.length - 1])}`],
  ];
  if (o.tufe_son) k.push(["Son açıklanan TÜFE", yuzde(o.tufe_son.yillik, 2).replace("+", ""), `${ayYaz(o.tufe_son.ay)}, yıllık · aylık ${yuzde(o.tufe_son.aylik, 2)}`]);
  $("kartlar").replaceChildren(...k.map(([e, d, n]) =>
    el("div", { class: "kart" }, el("div", { class: "etiket" }, e), el("div", { class: "deger" }, d), el("div", { class: "not" }, n))));
}

function sepetGrafik(o) {
  const s = o.sepet, kap = $("g-sepet");
  if (s.gunler.length < 2) {
    kap.replaceChildren(el("div", { class: "bos" }, `Şimdilik tek gün var (${gunYaz(s.gunler[0])}). Grafik ikinci günden itibaren çizilecek.`));
    return;
  }
  cizgiGrafik(kap, {
    etiketler: s.gunler, taban: 100,
    seriler: [{ ad: "Sepet endeksi", renk: "--seri-1", veri: s.genel }],
    xYaz: (g, uzun) => uzun ? gunYaz(g) : gunYaz(g).split(" ").slice(0, 2).join(" "),
  });
}

function karsilastirmaYaz(o) {
  const kap = $("karsilastirma"), k = o.sepet.karsilastirma;
  if (!k.length) {
    const ilk = o.sepet.gunler[0];
    const [y, m] = ilk.split("-").map(Number);
    const sonraki = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
    kap.replaceChildren(el("div", { class: "bos", html:
      `Henüz karşılaştırılabilir iki tam ay yok. İlk karşılaştırma <b>${ayYaz(sonraki)}</b> ayının sepet değişimi olacak;
       TÜİK o ayın TÜFE'sini bir sonraki ayın başında açıklar.` }));
    return;
  }
  const t = el("table", {}, el("thead", { html: '<tr><th>Ay</th><th class="s">Sepet, aylık</th><th class="s">TÜFE, aylık</th><th class="s gizle-dar">Veri günü</th></tr>' }),
    el("tbody", {}, ...k.slice().reverse().map(r => el("tr", { html:
      `<td>${ayYaz(r.ay)}</td><td class="s">${yuzde(r.seri_aylik, 2)}</td><td class="s">${r.tufe_aylik == null ? "açıklanmadı" : yuzde(r.tufe_aylik, 2)}</td><td class="s gizle-dar">${r.gun}</td>` }))));
  kap.replaceChildren(el("p", { class: "aciklama" }, "Sepet: günlük endeksin ay ortalamasının bir önceki aya göre değişimi. TÜFE: TÜİK genel endeksi. Kapsamları farklı; fark tek başına \"TÜFE yanlış\" anlamına gelmez."), el("div", { class: "tablo-kap" }, t));
}

function halYaz(o) {
  const h = o.hal;
  if (!h || !h.aylar || !h.aylar.length) { $("b-hal").hidden = true; return; }
  const aylar = h.aylar;
  $("hal-aciklama").innerHTML = `İzmir Büyükşehir Belediyesi sebze-meyve halinin günlük ortalama toptan fiyatları (kg ile satılan yerli ürünler,
    ${gunYaz(h.ilk_gun)}'ten beri ${h.gun_sayisi} bülten günü). Her ay, bir yıl önceki aynı ayla ve iki ayda da satılan aynı ürünlerle karşılaştırılır.
    Toptan fiyattır, yalnız İzmir'e aittir; TÜFE ise tüm harcamaları kapsar. İki çizgi aynı şeyi ölçmez, yan yana durur.`;
  cizgiGrafik($("g-hal"), {
    etiketler: aylar.map(a => a.ay), taban: 0,
    seriler: [
      { ad: "İzmir hali, sebze-meyve (toptan), yıllık", renk: "--seri-1", veri: aylar.map(a => a.yillik) },
      { ad: "TÜİK TÜFE (genel), yıllık", renk: "--seri-2", veri: aylar.map(a => a.tufe_yillik) },
    ],
    xYaz: (a, uzun) => uzun ? ayYaz(a) : ayKisa(a),
    yYaz: y => y == null ? "açıklanmadı" : yuzde(y),
  });
  const t = el("table", {}, el("thead", { html: '<tr><th>Ay</th><th class="s">Hal, yıllık</th><th class="s">TÜFE, yıllık</th><th class="s gizle-dar">Karşılaştırılan ürün</th></tr>' }),
    el("tbody", {}, ...aylar.slice().reverse().map(a => el("tr", { html:
      `<td>${ayYaz(a.ay)}</td><td class="s">${yuzde(a.yillik)}</td><td class="s">${a.tufe_yillik == null ? "açıklanmadı" : yuzde(a.tufe_yillik)}</td><td class="s gizle-dar">${a.mal}</td>` }))));
  $("t-hal").replaceChildren(el("div", { class: "tablo-kap" }, t));
}

function cubukListesi(satirlar) {
  const enBuyuk = Math.max(1, ...satirlar.map(s => Math.abs(s.deger)));
  return el("div", { class: "cubuklar" }, ...satirlar.map(s => {
    const gen = Math.abs(s.deger) / enBuyuk * 50;
    const dolgu = el("div", { class: "dolgu " + (s.deger >= 0 ? "arti" : "eksi") });
    dolgu.style.width = gen + "%";
    dolgu.style.left = s.deger >= 0 ? "50%" : (50 - gen) + "%";
    const satir = el("div", { class: "cubuk" }, el("div", {}, s.ad), el("div", { class: "yol" }, el("div", { class: "orta" }), dolgu),
      el("div", { class: "yuzde " + (s.deger > 0 ? "arti-m" : s.deger < 0 ? "eksi-m" : "") }, yuzde(s.deger)));
    satir.addEventListener("pointermove", ev => ipucuGoster(ev, `<div class="t">${s.ad}</div>${s.ipucu}`));
    satir.addEventListener("pointerleave", ipucuGizle);
    return satir;
  }));
}

function kategoriYaz(o, urunler) {
  const s = o.sepet, kap = $("kategoriler");
  const sayac = {};
  urunler.forEach(u => { sayac[u.kategori] = (sayac[u.kategori] || 0) + 1; });
  if (s.gunler.length < 2) {
    const t = el("table", {}, el("thead", { html: '<tr><th>Kategori</th><th class="s">Ürün</th></tr>' }),
      el("tbody", {}, ...Object.entries(o.kategori_adlari).map(([k, ad]) => el("tr", { html: `<td>${ad}</td><td class="s">${sayac[k] || 0}</td>` }))));
    kap.replaceChildren(el("div", { class: "bos" }, "Kategori değişimleri ikinci günden itibaren hesaplanacak. Şimdilik sepetin dağılımı:"), el("div", { class: "tablo-kap" }, t));
    return;
  }
  const satirlar = Object.entries(o.kategori_adlari).map(([k, ad]) => {
    const seri = s.kategori[k] || [];
    const son = seri[seri.length - 1] ?? 100;
    return { ad, deger: son - 100, ipucu: `${sayac[k] || 0} ürün · endeks ${sayi(son, 1)}` };
  }).sort((a, b) => b.deger - a.deger);
  kap.replaceChildren(cubukListesi(satirlar));
}

function zamYaz(urunler) {
  const kap = $("zamlar");
  const d = urunler.filter(u => u.degisim_yuzde != null && u.degisim_yuzde !== 0)
    .sort((a, b) => b.degisim_yuzde - a.degisim_yuzde);
  if (!d.length) {
    kap.replaceChildren(el("div", { class: "bos" }, "Henüz fiyatı değişen ürün yok ya da yalnız bir günlük veri var."));
    return;
  }
  const secim = d.length > 16 ? [...d.slice(0, 10), ...d.slice(-6)] : d;
  kap.replaceChildren(cubukListesi(secim.map(u => ({
    ad: u.ad, deger: u.degisim_yuzde,
    ipucu: `${gunYaz(u.ilk_tarih)}: ${tl(u.gecmis.find(g => g[0] === u.ilk_tarih)?.[1])} → bugün ${tl(u.son_fiyat)}`,
  }))));
}

function urunListesi(o, urunler) {
  const sec = $("kat-sec");
  for (const [k, ad] of Object.entries(o.kategori_adlari)) sec.append(el("option", { value: k }, ad));
  const kap = $("urun-listesi");
  const ciz = () => {
    const q = $("ara").value.toLocaleLowerCase("tr").trim(), kat = sec.value;
    const liste = urunler.filter(u => (!kat || u.kategori === kat) && (!q || u.ad.toLocaleLowerCase("tr").includes(q)));
    const govde = el("tbody");
    for (const u of liste) {
      const satir = el("tr", { class: "urun-satir", tabindex: "0", "aria-expanded": "false", html:
        `<td>${u.ad}${u.ikamede ? '<span class="rozet">ikame</span>' : ""}</td>
         <td class="gizle-dar">${o.kategori_adlari[u.kategori]}</td>
         <td class="s">${tl(u.son_fiyat)}</td>
         <td class="s gizle-dar">${u.birim_fiyat == null ? "—" : tl(u.birim_fiyat) + "/" + u.birim}</td>
         <td class="s">${yuzde(u.degisim_yuzde)}</td>` });
      const ac = () => {
        const sonraki = satir.nextElementSibling;
        if (sonraki && sonraki.classList.contains("urun-detay")) { sonraki.remove(); satir.setAttribute("aria-expanded", "false"); return; }
        satir.setAttribute("aria-expanded", "true");
        const hucre = el("td", { colspan: "5" });
        satir.after(el("tr", { class: "urun-detay" }, hucre));
        if (u.gecmis.length < 2) {
          hucre.append(el("div", {}, u.gecmis.length ? `Tek gözlem: ${gunYaz(u.gecmis[0][0])}, ${tl(u.gecmis[0][1])} (liste fiyatı ${tl(u.gecmis[0][2])}).` : "Bu ürün için henüz fiyat okunamadı."));
        } else {
          const g = el("div", { class: "grafik" }); hucre.append(g);
          cizgiGrafik(g, {
            etiketler: u.gecmis.map(x => x[0]), yukseklik: 200,
            seriler: [{ ad: "Ödenen fiyat", renk: "--seri-1", veri: u.gecmis.map(x => x[1]) },
                      { ad: "Liste fiyatı", renk: "--seri-2", veri: u.gecmis.map(x => x[2]) }],
            xYaz: (x, uzun) => uzun ? gunYaz(x) : gunYaz(x).split(" ").slice(0, 2).join(" "),
            yYaz: tl,
          });
        }
        hucre.append(el("div", { class: "aciklama", html: `<a href="${u.url}" rel="nofollow noopener" target="_blank">Ürün sayfası</a> · ${u.miktar} ${u.birim}` }));
      };
      satir.addEventListener("click", ac);
      satir.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); ac(); } });
      govde.append(satir);
    }
    kap.replaceChildren(el("div", { class: "tablo-kap" }, el("table", {},
      el("thead", { html: '<tr><th>Ürün</th><th class="gizle-dar">Kategori</th><th class="s">Fiyat</th><th class="s gizle-dar">Birim fiyat</th><th class="s">Değişim</th></tr>' }), govde)),
      liste.length ? null : el("div", { class: "bos" }, "Eşleşen ürün yok."));
  };
  $("ara").addEventListener("input", ciz);
  sec.addEventListener("change", ciz);
  ciz();
}

async function basla() {
  try {
    const [o, urunler] = await Promise.all([
      fetch("veri/ozet.json", { cache: "no-cache" }).then(r => r.json()),
      fetch("veri/urunler.json", { cache: "no-cache" }).then(r => r.json()),
    ]);
    $("urun-sayisi").textContent = o.sepet.urun_sayisi;
    document.querySelectorAll(".urun-sayisi2").forEach(e => { e.textContent = o.sepet.urun_sayisi; });
    $("guncelleme").textContent = gunYaz(o.guncelleme);
    durumYaz(o); kartlar(o, urunler); sepetGrafik(o); karsilastirmaYaz(o);
    halYaz(o); kategoriYaz(o, urunler); zamYaz(urunler); urunListesi(o, urunler);
    let gen = innerWidth;
    addEventListener("resize", () => { if (Math.abs(innerWidth - gen) > 40) { gen = innerWidth; sepetGrafik(o); halYaz(o); } });
  } catch (e) {
    $("durum").innerHTML = `<strong>Veri yüklenemedi</strong>${e.message}`;
  }
}
basla();
