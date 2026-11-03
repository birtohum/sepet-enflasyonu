"""Ortak yardımcılar: nazik HTTP istemcisi, robots.txt denetimi, yollar."""
from __future__ import annotations

import gzip
import hashlib
import time
import unicodedata
import urllib.error
import urllib.request
import urllib.robotparser
from datetime import datetime, timezone, timedelta
from pathlib import Path
from urllib.parse import urlsplit

KOK = Path(__file__).resolve().parent.parent
VERI = KOK / "veri"
SEPET = KOK / "sepet" / "sepet.csv"
SITE_VERI = KOK / "site" / "veri"
ONBELLEK = KOK / ".onbellek"

USER_AGENT = (
    "sepet-enflasyonu/0.1 (+https://github.com/birtohum/enflasyon; "
    "gunde bir kez, acik kaynak fiyat endeksi)"
)
GECIKME_SN = 3.0  # aynı sunucuya iki istek arasındaki en az süre

TR = timezone(timedelta(hours=3))


def bugun() -> str:
    """Türkiye saatine göre bugünün tarihi (YYYY-MM-DD)."""
    return datetime.now(TR).strftime("%Y-%m-%d")


def sade(metin: str) -> str:
    """Eşleştirme için: küçük harf, Türkçe harfleri ASCII'ye indir, noktalamayı boşluk yap."""
    metin = metin.replace("ı", "i").replace("İ", "i").lower()
    metin = unicodedata.normalize("NFKD", metin)
    metin = "".join(c for c in metin if not unicodedata.combining(c))
    return " ".join("".join(c if c.isalnum() else " " for c in metin).split())


class NazikIstemci:
    """Sunucu başına gecikme, robots.txt saygısı, günlük disk önbelleği."""

    def __init__(self, gecikme: float = GECIKME_SN, onbellek: bool = True):
        self.gecikme = gecikme
        self.onbellek = onbellek
        self._son: dict[str, float] = {}
        self._robots: dict[str, urllib.robotparser.RobotFileParser] = {}

    def _robots_izin(self, url: str) -> bool:
        p = urlsplit(url)
        kok = f"{p.scheme}://{p.netloc}"
        if kok not in self._robots:
            rp = urllib.robotparser.RobotFileParser()
            try:
                rp.parse(self._ham_get(kok + "/robots.txt").decode("utf-8", "replace").splitlines())
            except urllib.error.HTTPError as e:
                # 4xx: robots.txt yok → izinli kabul; 5xx: temkinli davran
                rp.parse([] if e.code < 500 else ["User-agent: *", "Disallow: /"])
            self._robots[kok] = rp
        return self._robots[kok].can_fetch(USER_AGENT, url)

    def _bekle(self, host: str) -> None:
        gecen = time.monotonic() - self._son.get(host, 0.0)
        if gecen < self.gecikme:
            time.sleep(self.gecikme - gecen)
        self._son[host] = time.monotonic()

    def _ham_get(self, url: str, deneme: int = 3) -> bytes:
        host = urlsplit(url).netloc
        for i in range(deneme):
            self._bekle(host)
            istek = urllib.request.Request(
                url, headers={"User-Agent": USER_AGENT, "Accept-Encoding": "gzip"}
            )
            try:
                with urllib.request.urlopen(istek, timeout=40) as yanit:
                    govde = yanit.read()
                    if yanit.headers.get("Content-Encoding") == "gzip":
                        govde = gzip.decompress(govde)
                    return govde
            except urllib.error.HTTPError as e:
                if e.code in (429, 500, 502, 503, 504) and i < deneme - 1:
                    time.sleep(10 * (i + 1))
                    continue
                raise
            except (urllib.error.URLError, TimeoutError):
                if i < deneme - 1:
                    time.sleep(10 * (i + 1))
                    continue
                raise
        raise RuntimeError("ulasilamaz")

    def get(self, url: str) -> bytes:
        if not self._robots_izin(url):
            raise PermissionError(f"robots.txt izin vermiyor: {url}")
        anahtar = ONBELLEK / bugun() / hashlib.sha1(url.encode()).hexdigest()
        if self.onbellek and anahtar.exists():
            return anahtar.read_bytes()
        govde = self._ham_get(url)
        if self.onbellek:
            anahtar.parent.mkdir(parents=True, exist_ok=True)
            anahtar.write_bytes(govde)
        return govde
