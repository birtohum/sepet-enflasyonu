# Sepet Enflasyonu

Aynı market ürünlerinin fiyatını her gün kaydeden ve TÜİK'in tüketici fiyat endeksiyle (TÜFE) yan yana gösteren açık kaynaklı bir izleme. Veri GitHub Actions'ta her sabah toplanır, depoya CSV olarak yazılır, statik site (GitHub Pages) bu dosyalardan beslenir.

**Durum (3 Kasım 2026):** Perakende sepet verisi bugün başladı; tek günlük veri var. Sitede "veri toplanıyor" uyarısı 28 gün dolana kadar kalır, TÜFE ile ilk aylık karşılaştırma Aralık 2026 için (Ocak 2027 başında) mümkün olur. İzmir hal fiyatları açık veri olduğu için 2025 başından beri geriye dönük dolduruldu.

Bu proje bir iddia kurmak için değil, ölçmek için var. Sepetin kapsamı TÜFE'den çok dar (aşağıya bakın); iki sayı arasındaki fark tek başına "TÜFE yanlış" demek değildir.

## Kaynak incelemesi (Kasım 2026)

Kural: robots.txt'in ya da kullanım şartlarının otomatik veri çekmeyi veya içeriğin kopyalanıp yeniden yayımlanmasını açıkça yasakladığı kaynak kullanılmaz.

| Kaynak | robots.txt | Kullanım şartları | Karar |
|---|---|---|---|
| **ŞOK** (sokmarket.com.tr) | Yalnız `/arama` kapalı; ürün sayfaları açık | Yayımlanan kullanım koşulları, yasal uyarı ve güvenlik politikasında otomatik erişim ya da yeniden yayın yasağı bulunamadı | **Kullanılıyor** |
| **İzmir BB hal fiyatları** (açık veri) | API'de robots.txt yok | İzmir BB Açık Veri Lisansı: atıfla kopyalama, dağıtım, ticari kullanım serbest (CC BY 4.0 uyumlu) | **Kullanılıyor** |
| **TCMB tüketici fiyatları tablosu** (TÜİK verisi) | Yalnız arama sonuçları kapalı | Kamu istatistiği | **Kullanılıyor** |
| Migros / Macrocenter | Ürün sayfaları açık | "page-scrape, robot, spider veya diğer otomatik cihaz" kullanımı açıkça yasak | Kullanılmıyor |
| A101 | Ürün sayfaları açık | Üyelik sözleşmesi 4.18: "otomatik cihaz, program, algoritma" ile erişim yasak; sade istemcilere 403 | Kullanılmıyor |
| CarrefourSA | Ürün sayfaları açık | Sitedeki "bilgiler... veri" yazılı izin olmadan kopyalanamaz, üçüncü kişilere sunulamaz | Kullanılmıyor (yeniden yayın yasağı) |
| Getir | `/product/`, `/category/` kapalı | — | Kullanılmıyor |
| Market Fiyatı (marketfiyati.org.tr, Ticaret Bak./TÜBİTAK) | Tümü açık | İçerik TÜBİTAK BİLGEM'in yazılı izni olmadan kopyalanamaz, işlenemez, üçüncü kişilere açıklanamaz | Kullanılmıyor (izin alınırsa en iyi kaynak olur) |
| Hakmar Express | Açık | Şart metnine ulaşılamadı | Şimdilik kullanılmıyor |
| Cimri, Akakçe | `/api/` ve sepet karşılaştırma kapalı | — | Kullanılmıyor (zaten ikincil kaynak) |
| İBB hal fiyatları web servisi | — | İBB Açık Veri Lisansı | Uygun; İzmir'le aynı işi gördüğü için şimdilik eklenmedi |

Notlar:
- "Yasak bulunamadı" açık izin demek değildir. ŞOK'tan itiraz gelirse toplama durdurulur. Yük düşük tutuldu: günde bir kez, ürün başına tek sayfa, istekler arasında 3 saniye, kimliğini ve depo adresini bildiren User-Agent, robots.txt her çalışmada denetlenir.
- Tek zincir kullanmak en büyük sınır. Market Fiyatı'ndan (TÜBİTAK BİLGEM, marketfiyati.iletisim@tubitak.gov.tr) yazılı izin istemek, yedi zinciri kapsayan bir sepete giden en temiz yol.

## Sepet

[`sepet/sepet.csv`](sepet/sepet.csv): 83 ürün, 11 kategori. Kategoriler TÜİK'in gıda alt gruplarına (ekmek ve tahıllar, et, süt-peynir-yumurta, yağlar, meyve, sebze, şeker-tatlı, diğer gıda), alkolsüz içeceklere, temizlik ürünlerine ve kişisel bakıma kabaca denk gelir. Kira, ulaşım, enerji, giyim, sağlık, eğitim, lokanta yok.

Sütunlar: `kod`, `kategori`, `ad`, `miktar` + `birim` (birim fiyat için), `eslesme`, `url`, `ikame_url`.

- **Sabit ürün:** Her satır belli bir marka ve gramajdır (meyve-sebze kg fiyatıyla). Gramaj değişirse ürün aynı ürün sayılmaz.
- **Eşleştirme kuralı:** Sitedeki ürün adı, `eslesme` sütunundaki her anahtar sözcüğü içermeli (Türkçe harfler sadeleştirilerek). İçermezse o gün fiyat kaydedilmez. Bu, URL'nin başka bir ürüne dönmesine ya da gramaj değişikliğine karşı koruma.
- **İkame kuralı:** Asıl ürün sayfası açılmazsa, satırda tanımlıysa önceden seçilmiş benzer ürüne (çoğunlukla aynı gramajda başka marka) geçilir. İkame fiyatı ayrı bir seri sayılır: geçiş günündeki fiyat farkı endekse girmez, sonraki değişimler girer. Sitede ikamedeki ürünler işaretlenir.
- **Fiyat:** Ödenen fiyat (kampanya indirimi dahil). Liste fiyatı ve stok bilgisi de ham veride saklanır. Fiyatlar ŞOK'un çevrimiçi sitesinin adres seçilmeden gösterdiği varsayılan mağazaya (kimlik 13412) aittir.

## Endeks yöntemi

Kod: [`betikler/hesapla.py`](betikler/hesapla.py), testler: [`testler/`](testler/).

1. **Ürün oranı:** Bugünkü fiyat ÷ aynı serideki son gözlenen fiyat (en çok 14 gün geriye). Daha eski gözlem varsa seri yeniden başlar.
2. **Toplama:** Oranların eşit ağırlıklı geometrik ortalaması (Jevons), günlük zincirleme. İlk gün = 100. TÜİK de en alt düzeyde (aynı maddenin farklı fiyatları) Jevons kullanır; ama bu sepette üst düzey **TÜİK ağırlıkları uygulanmıyor**. TÜİK'in 2026 alt grup ağırlıklarını güvenilir biçimde bulup doğrulayamadım; tahmini ağırlık uydurmak yerine her ürüne eşit ağırlık verdim. Bu yüzden sepet endeksi "her ürün bir oy" demektir; çok tüketilen ekmek ile az tüketilen kahve aynı ağırlıktadır.
3. **Kategori endeksleri:** Aynı yöntem, yalnız o kategorinin ürünleriyle.
4. **Eksik gün / ürün:** Fiyatı okunamayan ürün o gün hesaba girmez; geri geldiğinde aradaki toplam değişim o gün yansır. Hiç veri olmayan günde endeks önceki değerini taşır.
5. **Hatalı veri:** Bir günde 3 kattan fazla artış ya da üçte birden fazla düşüş veri hatası sayılır, endekse girmez, seri o fiyattan yeniden başlar. Atılan gözlemler `ozet.json` içinde `atilan` alanında listelenir.
6. **Aylık değişim:** Günlük endeksin ay ortalaması ÷ önceki ayın ortalaması. Bir ayda 15 günden az veri varsa o ay karşılaştırmaya girmez.
7. **TÜFE karşılaştırması:** Sepetin aylık değişimi TÜİK genel TÜFE'nin aylık değişimiyle aynı satırda gösterilir. (`tufe_endeksi()` TÜFE'yi istenen aya = 100 olacak biçimde yeniden tabanlar; birkaç ay birikince aynı tabanlı seviye grafiği için kullanılacak.)

**İzmir hal serisi — farklı yöntem, nedeniyle:** Kg ile satılan yerli sebze ve meyvelerin (ithal ve adet/bağ ile satılanlar hariç) günlük ortalama toptan fiyatları. Önce sepetle aynı günlük zincirleme yöntemi denedim; 21 aylık veride endeks belirgin biçimde aşağı kaydı (Ocak 2025 = 100 iken Ekim 2026'da ~90). Doğrudan karşılaştırma bunun yanlış olduğunu gösterdi: aynı ürünlerin Ekim 2026 ortalaması Ekim 2025'ten ~%12, Nisan 2026 ortalaması Nisan 2025'ten ~%55 yüksek. Sebebi bilinen bir zincir sapması: mevsimlik ürün sezona pahalı girer, sezon içinde ucuzlar (bu düşüşler endekse girer), sezon sonunda pahalanırken listeden çıkar ya da uzun aradan sonra yeni seri olarak döner (bu artışlar girmez). Bu yüzden hal için **doğrudan yıllık karşılaştırma** kullanılıyor: her ay, bir yıl önceki aynı ayla, iki ayda da en az 5 bülten günü bulunan aynı ürünlerle; fiyat oranlarının geometrik ortalaması. Zincirleme yok, mevsim aynı ayla eşleştiği için büyük ölçüde nötrlenir. Seri Ocak 2026'dan başlar (2025 başından beri veri var).

ŞOK sepeti bu sapmadan büyük ölçüde etkilenmez: ürünler sabittir ve girip çıkmaz; sabit bir küme için zincirlenmiş Jevons, ilk gün ile bugünün doğrudan karşılaştırmasına eşittir. Sapma yalnız sık sık kaybolan ürünlerde ortaya çıkabilir; ürün kapsaması `ozet.json` içinde günlük tutulur ve izlenmeli.

## Sınırlar

- Tek zincir, yalnız çevrimiçi fiyat, tek (varsayılan) mağaza. Bölge farkı, mağaza içi fiyat ve diğer marketler yansımıyor.
- Sepet TÜFE'nin yaklaşık dörtte birini oluşturan gıda ve alkolsüz içecekler ağırlıklı; genel TÜFE ile birebir karşılaştırılamaz. TÜFE'nin gıda alt endeksi şu an otomatik çekilmiyor (TCMB tablosu yalnız genel endeksi veriyor).
- Geçmiş kısa. Kampanyalar ve mevsim etkisi kısa dönemde endeksi oynatır. İlk 28 gün sitede yalnız "veri toplanıyor" yazar.
- Hal fiyatı toptandır ve İzmir'e aittir; tezgâh fiyatı değildir. Sebze-meyve fiyatı mevsimsel olarak çok oynar; tek ay farkı bir şey göstermez.
- ŞOK site yapısını değiştirirse çekme bozulur. Ürünlerin yarısından azı okunursa günlük iş başarısız olur (sessizce yanlış veri yazmaz).
- GitHub Actions sunucuları yurt dışındadır; ŞOK bu adresleri engellerse ya da farklı fiyat gösterirse yerelde yapılan testten farklı sonuç çıkabilir. İlk Actions çalışmasının çıktısı yerel çalışmayla karşılaştırılmalı.

## Dosyalar

```
sepet/sepet.csv            sabit sepet
betikler/ortak.py          nazik HTTP istemcisi (robots.txt, gecikme, önbellek, User-Agent)
betikler/cek_sok.py        ŞOK ürün sayfaları  -> veri/ham/sok/YYYY-MM-DD.csv
betikler/cek_hal.py        İzmir hal API'si    -> veri/ham/hal_izmir/YYYY-MM.csv
betikler/cek_tufe.py       TCMB TÜFE tablosu   -> veri/tufe.csv
betikler/hesapla.py        endeksler           -> site/veri/ozet.json, urunler.json
site/                      statik site (HTML + CSS + JS, harici kütüphane yok)
.github/workflows/gunluk.yml  her gün 09:15'te toplar, depoya yazar
.github/workflows/yayin.yml   siteyi GitHub Pages'e yayınlar
```

## Yerelde çalıştırma

```bash
python -m venv .venv
.venv/Scripts/python -m pip install pytest
.venv/Scripts/python -m pytest -q testler
cd betikler
python cek_sok.py              # ~4-5 dakika (83 ürün x 3 sn)
python cek_hal.py              # son 3 gün; geçmiş için: python cek_hal.py 2025-01-01
python cek_tufe.py
python hesapla.py
python -m http.server 8812 --directory ../site
```

Bağımlılık yok (yalnız Python 3.12 standart kütüphanesi; testler için pytest).

## Lisans ve atıf

Kod: MIT. Hal verisi İzmir Büyükşehir Belediyesi Açık Veri Portalı'ndan alınmıştır; Atıf 4.0 Uluslararası (CC BY 4.0) kapsamında lisanslanan kamu sektörü bilgilerini içerir. TÜFE verisi TÜİK'e aittir (TCMB tablosu üzerinden). Ürün adları ve fiyatları ŞOK'un sitesinde herkese açık bilgilerdir. Bu proje hiçbir kurum ya da marketle bağlantılı değildir.
