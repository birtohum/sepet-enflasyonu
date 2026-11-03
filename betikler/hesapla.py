"""Ham fiyatlardan endeksleri hesaplar ve sitenin okuduğu JSON dosyalarını yazar.

Yöntem (README'de ayrıntılı):
  * Ürün düzeyi: her ürünün bugünkü fiyatı, aynı serideki son gözlenen fiyatıyla
    (en çok BOSLUK_GUN önce) karşılaştırılır. İkameye geçiş yeni seri başlatır;
    geçiş günü fiyat farkı endekse girmez.
  * Toplama: eşit ağırlıklı geometrik ortalama (Jevons), günlük zincirleme.
    Kategori endeksleri aynı yolla, yalnız o kategorinin ürünleriyle.
  * Aylık: günlük endeksin ay ortalaması; aylık değişim = bu ay ort. / geçen ay ort.
  * Aşırı sıçrama (bir günde 3 kattan fazla ya da üçte birden az) veri hatası
    sayılır, endekse girmez ve seri yeniden başlar.
"""
from __future__ import annotations

import csv
import json
import math
from collections import defaultdict
from datetime import date

from ortak import SEPET, SITE_VERI, VERI, bugun

BOSLUK_GUN = 14
ASIRI = 3.0
TAM_AY_GUN = 15  # bir ayın karşılaştırmaya girmesi için gereken en az veri günü
TOPLANIYOR_GUN = 28  # bundan az veri günü varken site yalnız "veri toplanıyor" der

KATEGORILER = {
    "ekmek_tahil": "Ekmek ve tahıllar",
    "et": "Et ve et ürünleri",
    "sut": "Süt, peynir, yumurta",
    "yag": "Yağlar",
    "meyve": "Meyveler",
    "sebze": "Sebze ve bakliyat",
    "seker": "Şeker, tatlı, çikolata",
    "diger_gida": "Diğer gıda",
    "icecek": "Alkolsüz içecekler",
    "temizlik": "Temizlik ürünleri",
    "kisisel_bakim": "Kişisel bakım",
}


def gun_farki(a: str, b: str) -> int:
    return (date.fromisoformat(b) - date.fromisoformat(a)).days


def zincir_endeks(gozlem: dict[str, dict[str, tuple[float, str]]],
                  kategori: dict[str, str] | None = None,
                  bosluk: int = BOSLUK_GUN) -> dict:
    """gozlem: tarih -> {urun: (fiyat, seri_kimligi)}.

    Döner: {"gunler": [...], "genel": [...], "kategori": {k: [...]},
            "eslesen": [...], "atilan": [(tarih, urun, oran)]}
    Endeks ilk gün 100'dür. Hiç eşleşen ürün olmayan gün bir önceki değeri taşır.
    """
    kategori = kategori or {}
    son: dict[str, tuple[float, str, str]] = {}  # urun -> (fiyat, seri, tarih)
    genel, kat_seri, eslesen, atilan = [], defaultdict(list), [], []
    g_deger = 100.0
    k_deger: dict[str, float] = defaultdict(lambda: 100.0)
    gunler = sorted(gozlem)
    for gun in gunler:
        loglar, k_loglar = [], defaultdict(list)
        for urun, (fiyat, seri) in gozlem[gun].items():
            if not fiyat or fiyat <= 0:
                continue
            onceki = son.get(urun)
            if onceki and onceki[1] == seri and gun_farki(onceki[2], gun) <= bosluk:
                oran = fiyat / onceki[0]
                if oran > ASIRI or oran < 1 / ASIRI:
                    # endekse girmez; seri bu fiyattan yeniden başlar
                    atilan.append((gun, urun, round(oran, 3)))
                else:
                    loglar.append(math.log(oran))
                    if urun in kategori:
                        k_loglar[kategori[urun]].append(math.log(oran))
            son[urun] = (fiyat, seri, gun)
        if loglar:
            g_deger *= math.exp(sum(loglar) / len(loglar))
        genel.append(round(g_deger, 3))
        eslesen.append(len(loglar))
        for k in set(kategori.values()):
            if k_loglar.get(k):
                k_deger[k] *= math.exp(sum(k_loglar[k]) / len(k_loglar[k]))
            kat_seri[k].append(round(k_deger[k], 3))
    return {"gunler": gunler, "genel": genel, "kategori": dict(kat_seri),
            "eslesen": eslesen, "atilan": atilan}


def aylik_ortalama(gunler: list[str], degerler: list[float]) -> list[dict]:
    aylar: dict[str, list[float]] = defaultdict(list)
    for g, d in zip(gunler, degerler):
        aylar[g[:7]].append(d)
    return [{"ay": a, "ort": sum(v) / len(v), "gun": len(v)} for a, v in sorted(aylar.items())]


def tufe_oku() -> list[dict]:
    f = VERI / "tufe.csv"
    if not f.exists():
        return []
    with open(f, encoding="utf-8", newline="") as fh:
        return [{"ay": r["ay"], "yillik": float(r["yillik_yuzde"]), "aylik": float(r["aylik_yuzde"])}
                for r in csv.DictReader(fh)]


def tufe_endeksi(tufe: list[dict], taban_ay: str) -> dict[str, float]:
    """Aylık değişimlerden, taban_ay = 100 olacak şekilde TÜFE endeksi kurar."""
    endeks, deger = {}, None
    for r in tufe:
        if r["ay"] == taban_ay:
            deger = 100.0
        elif deger is not None:
            deger *= 1 + r["aylik"] / 100
        if deger is not None:
            endeks[r["ay"]] = round(deger, 3)
    return endeks


def karsilastirma(aylik: list[dict], tufe: list[dict]) -> list[dict]:
    """Yalnız iki ardışık 'tam' ay için aylık değişim üretir."""
    t = {r["ay"]: r for r in tufe}
    satirlar = []
    for onceki, simdiki in zip(aylik, aylik[1:]):
        if onceki["gun"] < TAM_AY_GUN or simdiki["gun"] < TAM_AY_GUN:
            continue
        satirlar.append({
            "ay": simdiki["ay"],
            "seri_aylik": round((simdiki["ort"] / onceki["ort"] - 1) * 100, 2),
            "tufe_aylik": t.get(simdiki["ay"], {}).get("aylik"),
            "gun": simdiki["gun"],
        })
    return satirlar


# ---------------------------------------------------------------- ŞOK sepeti

def sepet_oku() -> list[dict]:
    with open(SEPET, encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f, delimiter=";"))


def sok_gozlemleri() -> dict[str, list[dict]]:
    gunler = {}
    for f in sorted((VERI / "ham" / "sok").glob("*.csv")):
        with open(f, encoding="utf-8", newline="") as fh:
            gunler[f.stem] = list(csv.DictReader(fh))
    return gunler


def sepet_hesapla(tufe: list[dict]) -> tuple[dict, list[dict]]:
    sepet = sepet_oku()
    ham = sok_gozlemleri()
    kategori = {s["kod"]: s["kategori"] for s in sepet}
    gozlem = {
        gun: {r["kod"]: (float(r["fiyat"]), r["url"]) for r in satirlar if r["durum"] == "tamam"}
        for gun, satirlar in ham.items()
    }
    sonuc = zincir_endeks(gozlem, kategori)
    gunler = sonuc["gunler"]

    # ürün geçmişleri ve değişimler (yalnız aynı seri içinde)
    urunler = []
    for s in sepet:
        gecmis = []
        for gun in gunler:
            r = next((r for r in ham[gun] if r["kod"] == s["kod"]), None)
            if r and r["durum"] == "tamam":
                gecmis.append([gun, float(r["fiyat"]), float(r["liste_fiyati"]), r["kullanilan"]])
        ayni_seri = [g for g in gecmis if gecmis and g[3] == gecmis[-1][3]]
        degisim = None
        if len(ayni_seri) >= 2 and gun_farki(ayni_seri[0][0], ayni_seri[-1][0]) >= 1:
            degisim = round((ayni_seri[-1][1] / ayni_seri[0][1] - 1) * 100, 2)
        miktar = float(s["miktar"])
        urunler.append({
            "kod": s["kod"], "ad": s["ad"], "kategori": s["kategori"],
            "miktar": miktar, "birim": s["birim"], "url": s["url"],
            "gecmis": [[g[0], g[1], g[2]] for g in gecmis],
            "ikamede": bool(gecmis and gecmis[-1][3] == "ikame"),
            "son_fiyat": gecmis[-1][1] if gecmis else None,
            "birim_fiyat": round(gecmis[-1][1] / miktar, 2) if gecmis else None,
            "ilk_tarih": ayni_seri[0][0] if ayni_seri else None,
            "degisim_yuzde": degisim,
        })

    aylik = aylik_ortalama(gunler, sonuc["genel"])
    kapsama = [sum(r["durum"] == "tamam" for r in ham[g]) for g in gunler]
    ozet = {
        "gunler": gunler,
        "genel": sonuc["genel"],
        "kategori": {k: sonuc["kategori"].get(k, []) for k in KATEGORILER},
        "kapsama": kapsama,
        "eslesen": sonuc["eslesen"],
        "urun_sayisi": len(sepet),
        "atilan": sonuc["atilan"],
        "aylik": [{"ay": a["ay"], "ort": round(a["ort"], 3), "gun": a["gun"]} for a in aylik],
        "karsilastirma": karsilastirma(aylik, tufe),
        "veri_gunu": len(gunler),
        "durum": "toplaniyor" if len(gunler) < TOPLANIYOR_GUN else "hazir",
    }
    return ozet, urunler


# ---------------------------------------------------------------- İzmir hali

def hal_hesapla(tufe: list[dict]) -> dict:
    gozlem: dict[str, dict[str, tuple[float, str]]] = defaultdict(dict)
    adlar = {}
    for f in sorted((VERI / "ham" / "hal_izmir").glob("*.csv")):
        with open(f, encoding="utf-8", newline="") as fh:
            for r in csv.DictReader(fh):
                # yalnız kg ile satılan yerli sebze ve meyve
                if r["birim"].upper() != "KG" or r["tip"] not in ("SEBZE", "MEYVE"):
                    continue
                try:
                    fiyat = float(r["ortalama"])
                except ValueError:
                    continue
                gozlem[r["tarih"]][r["mal_id"]] = (fiyat, "hal")
                adlar[r["mal_id"]] = r["mal_adi"]
    if not gozlem:
        return {}
    sonuc = zincir_endeks(gozlem)
    aylik = aylik_ortalama(sonuc["gunler"], sonuc["genel"])
    tam = [a for a in aylik if a["gun"] >= TAM_AY_GUN]
    taban = tam[0]["ay"] if tam else aylik[0]["ay"]
    taban_ort = next(a["ort"] for a in aylik if a["ay"] == taban)
    tufe_e = tufe_endeksi(tufe, taban)
    t = {r["ay"]: r for r in tufe}
    aylar = []
    ort = {a["ay"]: a["ort"] for a in aylik}
    for a in aylik:
        y, m = int(a["ay"][:4]), int(a["ay"][5:])
        gecen_yil = f"{y - 1}-{m:02d}"
        yillik = round((a["ort"] / ort[gecen_yil] - 1) * 100, 1) if gecen_yil in ort else None
        aylar.append({
            "ay": a["ay"], "gun": a["gun"],
            "hal": round(a["ort"] / taban_ort * 100, 2),
            "tufe": tufe_e.get(a["ay"]),
            "hal_yillik": yillik,
            "tufe_yillik": t.get(a["ay"], {}).get("yillik"),
        })
    return {
        "taban_ay": taban,
        "aylar": aylar,
        "mal_sayisi": len(adlar),
        "ilk_gun": sonuc["gunler"][0],
        "son_gun": sonuc["gunler"][-1],
        "gun_sayisi": len(sonuc["gunler"]),
        "karsilastirma": karsilastirma(aylik, tufe),
    }


def main() -> None:
    SITE_VERI.mkdir(parents=True, exist_ok=True)
    tufe = tufe_oku()
    ozet, urunler = sepet_hesapla(tufe)
    hal = hal_hesapla(tufe)
    son_tufe = tufe[-1] if tufe else None
    cikti = {
        "guncelleme": bugun(),
        "kategori_adlari": KATEGORILER,
        "sepet": ozet,
        "hal": hal,
        "tufe_son": son_tufe,
    }
    with open(SITE_VERI / "ozet.json", "w", encoding="utf-8") as f:
        json.dump(cikti, f, ensure_ascii=False, separators=(",", ":"))
    with open(SITE_VERI / "urunler.json", "w", encoding="utf-8") as f:
        json.dump(urunler, f, ensure_ascii=False, separators=(",", ":"))
    print(f"site verisi: {ozet['veri_gunu']} gün sepet, hal {hal.get('gun_sayisi', 0)} gün")


if __name__ == "__main__":
    main()
