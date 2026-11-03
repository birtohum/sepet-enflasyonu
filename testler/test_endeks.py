import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "betikler"))

import pytest  # noqa: E402

from cek_sok import eslesiyor_mu, sayfayi_coz  # noqa: E402
from cek_tufe import tabloyu_coz  # noqa: E402
from hesapla import aylik_ortalama, karsilastirma, tufe_endeksi, zincir_endeks  # noqa: E402


def test_sabit_fiyat_endeksi_100_kalir():
    g = {f"2026-11-0{i}": {"a": (10.0, "u"), "b": (20.0, "u")} for i in range(1, 5)}
    assert zincir_endeks(g)["genel"] == [100.0] * 4


def test_jevons_geometrik_ortalama():
    g = {"2026-11-01": {"a": (10.0, "u"), "b": (10.0, "u")},
         "2026-11-02": {"a": (14.4, "u"), "b": (10.0, "u")}}
    # sqrt(1.44 * 1) = 1.2
    assert zincir_endeks(g)["genel"][-1] == pytest.approx(120.0)


def test_eksik_gun_degisimi_kaybolmaz():
    g = {"2026-11-01": {"a": (10.0, "u"), "b": (10.0, "u")},
         "2026-11-02": {"b": (10.0, "u")},  # a yok
         "2026-11-03": {"a": (12.1, "u"), "b": (10.0, "u")}}
    e = zincir_endeks(g)["genel"]
    assert e[1] == 100.0
    assert e[2] == pytest.approx(100 * (1.21 ** 0.5))


def test_ikame_gecisi_sicrama_uretmez():
    g = {"2026-11-01": {"a": (10.0, "asil")},
         "2026-11-02": {"a": (15.0, "ikame")},
         "2026-11-03": {"a": (16.5, "ikame")}}
    e = zincir_endeks(g)["genel"]
    assert e[1] == 100.0
    assert e[2] == pytest.approx(110.0)


def test_uzun_bosluktan_sonra_seri_yeniden_baslar():
    g = {"2026-11-01": {"a": (10.0, "u")}, "2026-11-30": {"a": (20.0, "u")}}
    assert zincir_endeks(g, bosluk=14)["genel"] == [100.0, 100.0]


def test_asiri_sicrama_atilir():
    g = {"2026-11-01": {"a": (10.0, "u")}, "2026-11-02": {"a": (100.0, "u")},
         "2026-11-03": {"a": (110.0, "u")}}
    s = zincir_endeks(g)
    assert s["atilan"] == [("2026-11-02", "a", 10.0)]
    assert s["genel"][-1] == pytest.approx(110.0)


def test_kategori_endeksi():
    g = {"2026-11-01": {"a": (10.0, "u"), "b": (10.0, "u")},
         "2026-11-02": {"a": (11.0, "u"), "b": (10.0, "u")}}
    s = zincir_endeks(g, {"a": "et", "b": "sut"})
    assert s["kategori"]["et"][-1] == pytest.approx(110.0)
    assert s["kategori"]["sut"][-1] == 100.0


def test_karsilastirma_yalniz_tam_aylar():
    gunler = [f"2026-11-{d:02d}" for d in range(3, 31)] + [f"2026-12-{d:02d}" for d in range(1, 5)]
    aylik = aylik_ortalama(gunler, [100.0] * len(gunler))
    assert karsilastirma(aylik, []) == []  # Aralık'ta 4 gün var, tam ay değil


def test_tufe_endeksi_taban():
    t = [{"ay": "2026-01", "aylik": 5.0}, {"ay": "2026-02", "aylik": 10.0}]
    assert tufe_endeksi(t, "2026-01") == {"2026-01": 100.0, "2026-02": 110.0}


def test_eslesme_kurali():
    assert eslesiyor_mu("Sütaş Yarım Yağlı Süt 4*1 Lt", "sutas yarim yagli sut 4")
    assert not eslesiyor_mu("Sütaş Tam Yağlı Süt 1 Lt", "sutas yarim yagli sut 4")


def test_sok_sayfa_cozumu():
    html = ('<script>self.__next_f.push([1,"x:{\\"initialVariant\\":{\\"hasStock\\":true,'
            '\\"prices\\":{\\"discounted\\":{\\"value\\":89.5},\\"original\\":{\\"value\\":99}}},'
            '\\"productData\\":{\\"product\\":{\\"name\\":\\"Deneme 1 Kg\\"},\\"store\\":{\\"id\\":\\"7\\"}}}"])</script>')
    b = sayfayi_coz(html)
    assert b == {"sitedeki_ad": "Deneme 1 Kg", "fiyat": 89.5, "liste_fiyati": 99.0, "stok": 1, "magaza": "7"}


def test_tufe_tablosu():
    sayfa = "<tr><th>Ay-Yıl</th></tr><tr><td>09-2026</td><td>29.73</td><td>1.84</td></tr>" \
            "<tr><td>08-2026</td><td>31,51</td><td>1.84</td></tr>"
    assert tabloyu_coz(sayfa) == [
        {"ay": "2026-08", "yillik_yuzde": 31.51, "aylik_yuzde": 1.84},
        {"ay": "2026-09", "yillik_yuzde": 29.73, "aylik_yuzde": 1.84},
    ]


def test_hal_yillik_dogrudan_karsilastirma():
    from hesapla import hal_yillik
    mallar = {f"m{i}": 10.0 for i in range(10)}
    ay_ort = {"2025-03": mallar, "2026-03": {k: v * 1.5 for k, v in mallar.items()},
              "2026-04": mallar}  # 2025-04 yok: karşılaştırılmaz
    assert hal_yillik(ay_ort) == [{"ay": "2026-03", "yillik": 50.0, "mal": 10}]
