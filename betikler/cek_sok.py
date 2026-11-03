"""ŞOK (sokmarket.com.tr) ürün sayfalarından sepet fiyatlarını çeker.

Çıktı: veri/ham/sok/YYYY-MM-DD.csv — her sepet ürünü için bir satır.
Fiyat sayfanın içine gömülü Next.js (RSC) verisinden okunur; sayfa başına bir istek.
"""
from __future__ import annotations

import csv
import json
import re
import shutil
import sys
from datetime import datetime

from ortak import ONBELLEK, SEPET, TR, VERI, NazikIstemci, bugun, sade

PUSH = re.compile(r'self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)')
ALANLAR = [
    "tarih", "kod", "durum", "kullanilan", "url", "sitedeki_ad",
    "fiyat", "liste_fiyati", "stok", "magaza", "saat",
]


def sepeti_oku() -> list[dict]:
    with open(SEPET, encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f, delimiter=";"))


def sayfayi_coz(html: str) -> dict:
    """Ürün sayfasından ad, ödenen fiyat, liste fiyatı, stok ve mağaza kimliğini çıkarır."""
    rsc = "".join(json.loads('"' + m + '"') for m in PUSH.findall(html))
    dec = json.JSONDecoder()
    i = rsc.find('"initialVariant":')
    j = rsc.find('"productData":', i)
    if i < 0 or j < 0:
        raise ValueError("ürün verisi sayfada yok")
    varyant, _ = dec.raw_decode(rsc, i + len('"initialVariant":'))
    urun, _ = dec.raw_decode(rsc, j + len('"productData":'))
    fiyatlar = varyant["prices"]
    return {
        "sitedeki_ad": urun["product"]["name"],
        "fiyat": float(fiyatlar["discounted"]["value"]),
        "liste_fiyati": float(fiyatlar["original"]["value"]),
        "stok": int(bool(varyant.get("hasStock"))),
        "magaza": (urun.get("store") or {}).get("id", ""),
    }


def eslesiyor_mu(sitedeki_ad: str, eslesme: str) -> bool:
    """Eşleştirme kuralı: sepet satırındaki her anahtar sözcük sitedeki adda geçmeli."""
    ad = " " + sade(sitedeki_ad) + " "
    return all(sade(s) in ad for s in eslesme.split())


def urunu_cek(ist: NazikIstemci, satir: dict) -> dict:
    """Önce asıl URL, olmazsa ikame URL. Ad eşleşmezse fiyat kaydedilmez."""
    denemeler = [("asil", satir["url"])]
    if satir.get("ikame_url"):
        denemeler.append(("ikame", satir["ikame_url"]))
    son_hata = ""
    for tur, url in denemeler:
        try:
            bilgi = sayfayi_coz(ist.get(url).decode("utf-8", "replace"))
        except Exception as e:  # 404, ağ, değişen sayfa yapısı
            son_hata = f"{tur}: {type(e).__name__}: {e}"[:160]
            continue
        # ikame farklı marka olabilir; ad denetimi yalnız asıl ürün için yapılır
        if tur == "asil" and not eslesiyor_mu(bilgi["sitedeki_ad"], satir["eslesme"]):
            son_hata = f"asil: ad eşleşmedi ({bilgi['sitedeki_ad']})"
            continue
        return {"durum": "tamam", "kullanilan": tur, "url": url, **bilgi}
    return {"durum": "yok", "kullanilan": "", "url": "", "sitedeki_ad": son_hata,
            "fiyat": "", "liste_fiyati": "", "stok": "", "magaza": ""}


def eski_onbellegi_sil() -> None:
    if ONBELLEK.exists():
        for d in ONBELLEK.iterdir():
            if d.is_dir() and d.name != bugun():
                shutil.rmtree(d, ignore_errors=True)


def main() -> int:
    eski_onbellegi_sil()
    tarih = bugun()
    hedef = VERI / "ham" / "sok" / f"{tarih}.csv"
    hedef.parent.mkdir(parents=True, exist_ok=True)
    ist = NazikIstemci()
    satirlar = []
    for s in sepeti_oku():
        sonuc = urunu_cek(ist, s)
        sonuc.update(tarih=tarih, kod=s["kod"], saat=datetime.now(TR).strftime("%H:%M"))
        satirlar.append(sonuc)
        print(f"{s['kod']} {sonuc['durum']:5} {sonuc['fiyat']!s:>8}  {sonuc['sitedeki_ad'][:60]}", flush=True)
    with open(hedef, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=ALANLAR)
        w.writeheader()
        w.writerows(satirlar)
    tamam = sum(r["durum"] == "tamam" for r in satirlar)
    print(f"{hedef.name}: {tamam}/{len(satirlar)} ürün fiyatlandı")
    # yarıdan azı geldiyse iş başarısız sayılsın (site yapısı değişmiş olabilir)
    return 0 if tamam >= len(satirlar) / 2 else 1


if __name__ == "__main__":
    sys.exit(main())
