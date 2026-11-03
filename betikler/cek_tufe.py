"""TÜİK TÜFE aylık ve yıllık değişim oranlarını TCMB'nin yayımladığı tablodan çeker.

TCMB, TÜİK'in açıkladığı genel TÜFE değişimlerini tek tabloda yeniden yayımlıyor:
https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Istatistikler/Enflasyon+Verileri/Tuketici+Fiyatlari
Çıktı: veri/tufe.csv (ay, yillik_yuzde, aylik_yuzde) — eskiden yeniye.
"""
from __future__ import annotations

import csv
import html
import re
import sys

from ortak import VERI, NazikIstemci

URL = ("https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/"
       "Istatistikler/Enflasyon+Verileri/Tuketici+Fiyatlari")
HEDEF = VERI / "tufe.csv"


def tabloyu_coz(sayfa: str) -> list[dict]:
    satirlar = []
    for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", sayfa, re.S):
        hucreler = [html.unescape(re.sub(r"<[^>]+>", "", h)).strip()
                    for h in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", tr, re.S)]
        if len(hucreler) >= 3 and re.fullmatch(r"\d{2}-\d{4}", hucreler[0]):
            ay, yil = hucreler[0].split("-")
            try:
                satirlar.append({"ay": f"{yil}-{ay}",
                                 "yillik_yuzde": float(hucreler[1].replace(",", ".")),
                                 "aylik_yuzde": float(hucreler[2].replace(",", "."))})
            except ValueError:
                continue
    return sorted({s["ay"]: s for s in satirlar}.values(), key=lambda s: s["ay"])


def main() -> int:
    sayfa = NazikIstemci(onbellek=False).get(URL).decode("utf-8", "replace")
    satirlar = tabloyu_coz(sayfa)
    if len(satirlar) < 12:
        print("TÜFE tablosu okunamadı; dosya değiştirilmedi")
        return 1
    with open(HEDEF, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["ay", "yillik_yuzde", "aylik_yuzde"])
        w.writeheader()
        w.writerows(satirlar)
    print(f"tufe: {len(satirlar)} ay, son {satirlar[-1]['ay']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
