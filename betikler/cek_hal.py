"""İzmir Büyükşehir Belediyesi sebze-meyve hal fiyatlarını (açık veri) çeker.

Kaynak: https://acikveri.bizizmir.com/dataset/sebze-ve-meyve-hal-fiyatlari
Lisans: İzmir BB Açık Veri Lisansı (atıf şartıyla yeniden yayına izin verir).

Kullanım:
  python cek_hal.py                 # bugünün bülteni (yoksa dünün)
  python cek_hal.py 2025-01-01      # bu tarihten bugüne eksik günleri doldur
Çıktı: veri/ham/hal_izmir/YYYY-MM.csv (ay başına bir dosya, tarih sütunlu).
"""
from __future__ import annotations

import csv
import json
import sys
from datetime import date, timedelta

from ortak import VERI, NazikIstemci, bugun

API = "https://openapi.izmir.bel.tr/api/ibb/halfiyatlari/sebzemeyve/{}"
KLASOR = VERI / "ham" / "hal_izmir"
ALANLAR = ["tarih", "mal_id", "mal_adi", "tip", "birim", "asgari", "azami", "ortalama"]


def ay_dosyasi(gun: str):
    return KLASOR / f"{gun[:7]}.csv"


def mevcut_gunler() -> set[str]:
    gunler = set()
    for f in KLASOR.glob("*.csv"):
        with open(f, encoding="utf-8", newline="") as fh:
            gunler.update(r["tarih"] for r in csv.DictReader(fh))
    return gunler


def gunu_cek(ist: NazikIstemci, gun: str) -> list[dict]:
    veri = json.loads(ist.get(API.format(gun)).decode("utf-8"))
    satirlar = []
    for m in veri.get("HalFiyatListesi") or []:
        if m.get("HalTuru") != 1:  # 1 = sebze-meyve hali
            continue
        satirlar.append({
            "tarih": gun,
            "mal_id": m["MalId"],
            "mal_adi": " ".join(m["MalAdi"].split()),
            "tip": m.get("MalTipAdi", ""),
            "birim": m.get("Birim", ""),
            "asgari": m.get("AsgariUcret"),
            "azami": m.get("AzamiUcret"),
            "ortalama": m.get("OrtalamaUcret"),
        })
    return satirlar


def ekle(satirlar: list[dict]) -> None:
    if not satirlar:
        return
    f = ay_dosyasi(satirlar[0]["tarih"])
    yeni = not f.exists()
    f.parent.mkdir(parents=True, exist_ok=True)
    with open(f, "a", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=ALANLAR)
        if yeni:
            w.writeheader()
        w.writerows(satirlar)


def main() -> int:
    son = date.fromisoformat(bugun())
    bas = date.fromisoformat(sys.argv[1]) if len(sys.argv) > 1 else son - timedelta(days=3)
    var = mevcut_gunler()
    ist = NazikIstemci(gecikme=1.5, onbellek=False)
    eklenen = 0
    g = bas
    while g <= son:
        gun = g.isoformat()
        if gun not in var:
            try:
                satirlar = gunu_cek(ist, gun)
            except Exception as e:
                print(f"{gun}: hata {e}")
                satirlar = []
            # Pazar ve bayramlarda bülten boş gelir; boş gün kaydedilmez
            if satirlar:
                ekle(satirlar)
                eklenen += 1
                print(f"{gun}: {len(satirlar)} mal", flush=True)
        g += timedelta(days=1)
    print(f"hal: {eklenen} yeni gün")
    return 0


if __name__ == "__main__":
    sys.exit(main())
