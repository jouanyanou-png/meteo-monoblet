"""Lit les 4 sites meteo pour Monoblet et ecrit donnees.js (lu par meteo.html).

Lance toutes les heures par la tache planifiee Windows "Meteo Monoblet".
Chaque site est lu comme un visiteur normal (quelques pages, une fois par heure).

Chaque site donne ses previsions a sa facon (toutes les heures, par moment de la
journee, ou par jour). Pour pouvoir comparer, tout est remis sur la meme grille :
une ligne toutes les 3 heures (01h, 04h, 07h ... 22h), aussi loin que le site prevoit.
Les lignes que le site ne donne pas telles quelles sont estimees et marquees "estime".
"""
import datetime as dt
import html
import json
import re
import sys
import traceback
import urllib.request
from pathlib import Path

DOSSIER = Path(__file__).resolve().parent
SORTIE = DOSSIER / "donnees.js"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"

URL_METEOCIEL = "https://www.meteociel.fr/previsions/10265/monoblet.htm"
URL_METEOCIEL_TEND = "https://www.meteociel.fr/tendances/10265/monoblet.htm"
URL_AGRICOLE_H = "https://www.lameteoagricole.net/meteo-heure-par-heure/monoblet-30170.html"
URL_AGRICOLE_J = "https://www.lameteoagricole.net/previsions-meteo-agricole/Monoblet-30170.html"
URL_MF = "https://meteofrance.com/previsions-meteo-france/monoblet/30170"
URL_LANGUEDOC = "https://www.meteolanguedoc.com/previsions-meteo/{date}/{periode}"
VILLE_LANGUEDOC = "LE VIGAN"  # ville la plus proche de Monoblet sur leur carte

ROSE = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSO", "SO", "OSO", "O", "ONO", "NO", "NNO"]
H = dt.timedelta(hours=1)


# ------------------------------------------------------------------ outils
def dir_en_degres(txt):
    if not txt:
        return None
    t = txt.strip().upper().replace("W", "O")
    return ROSE.index(t) * 22.5 if t in ROSE else None


def code_ciel(txt):
    """Texte du ciel (n'importe quel site) -> code meteo commun pour l'icone."""
    t = (txt or "").lower()
    if "orage" in t or "grêle" in t:
        return 95
    if "neige" in t or "flocon" in t:
        return 71
    if "bruine" in t:
        return 51
    if "averse" in t:
        return 82 if "fort" in t else 80
    if "pluie" in t or "pluvieux" in t:
        if "fort" in t:
            return 65
        if "faible" in t or "possible" in t:
            return 61
        return 63
    if "brouillard" in t or "brume" in t:
        return 45
    if "couvert" in t or "très nuageux" in t:
        return 3
    if "peu nuageux" in t or "voilé" in t:
        return 1
    if "nuage" in t or "éclaircie" in t or "mitigé" in t or "partiel" in t:
        return 2
    if "soleil" in t or "ensoleill" in t or "clair" in t or "beau" in t:
        return 0
    return 3


def lire(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "fr-FR,fr;q=0.9"})
    with urllib.request.urlopen(req, timeout=30) as r:
        brut = r.read()
        cs = r.headers.get_content_charset()
    if not cs:
        m = re.search(rb'charset=["\']?([\w-]+)', brut[:3000])
        cs = m.group(1).decode() if m else "utf-8"
    try:
        return brut.decode(cs)
    except (UnicodeDecodeError, LookupError):
        return brut.decode("cp1252", errors="replace")


def texte(fragment):
    t = re.sub(r"<[^>]+>", " ", fragment)
    return re.sub(r"\s+", " ", html.unescape(t)).strip()


def nombre(txt):
    m = re.search(r"-?\d+(?:[.,]\d+)?", txt or "")
    return float(m.group(0).replace(",", ".")) if m else None


def date_du_jour(num):
    """Numero du jour (ex. 28) -> la prochaine date qui porte ce numero."""
    d = dt.date.today()
    while d.day != num:
        d += dt.timedelta(days=1)
    return d


def a_heure(d, h):
    return dt.datetime.combine(d, dt.time()) + h * H


# Chaque site rend 3 sortes de donnees :
#   points   : valeurs a une heure precise  {t, temp, dir, moy, raf, pluie, hum, ciel, pas}
#              (pas = nombre d'heures couvertes par "pluie")
#   periodes : valeurs sur un moment        {debut, fin, temp, dir, moy, raf, ciel}
#   jours    : valeurs sur une journee      {date, tmin, tmax, dir, moy, raf, ciel}


# ---------------------------------------------------------------- Meteociel
def table_meteociel(url):
    s = lire(url)
    i = s.find("<td rowspan=2>Jour</td>")
    table = s[i:s.find("</table>", i)]
    pas = 6 if "sur 6h" in table else 3
    points, jour = [], None
    for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", table, re.S):
        cells = re.findall(r"<td([^>]*)>(.*?)</td>", tr, re.S)
        if not cells or not re.search(r"\d\d:\d\d", tr):
            continue
        if "rowspan" in cells[0][0]:
            jour = date_du_jour(int(re.search(r"<br>(\d+)", cells[0][1]).group(1)))
            cells = cells[1:]
        heure = int(texte(cells[0][1])[:2])
        cells = [c for c in cells if "wndchill" not in c[0]]
        _, temp, dirc, moy, raf, pluie, hum, _pres, ciel = cells[:9]
        deg = re.search(r":\s*(\d+)", dirc[1])
        alt = re.search(r'alt="([^"]+)"', ciel[1])
        points.append({
            "t": a_heure(jour, heure), "temp": nombre(texte(temp[1])),
            "dir": float(deg.group(1)) if deg else None,
            "moy": nombre(texte(moy[1])), "raf": nombre(texte(raf[1])),
            "pluie": nombre(texte(pluie[1])) or 0.0, "hum": nombre(texte(hum[1])),
            "ciel": alt.group(1).strip() if alt else "", "pas": pas,
        })
    return points


def meteociel():
    points = table_meteociel(URL_METEOCIEL)
    try:
        fin = max(p["t"] for p in points)
        points += [p for p in table_meteociel(URL_METEOCIEL_TEND) if p["t"] > fin]
    except Exception:
        traceback.print_exc()
    return {"points": points}


# ---------------------------------------------------------- Meteo Agricole
def agricole():
    # heure par heure (environ 2 jours)
    s = lire(URL_AGRICOLE_H)
    thead = s[s.find("<thead"):s.find("</thead>")]
    tetes = re.findall(r'<span class="fs-5 mb-2[^"]*">(\d+)</span>\s*<span class="fs-5\s+mt-1 mb-2">(\d+)h</span>', thead)
    tbody = s[s.find("<tbody"):s.find("</tbody>")]
    points = []
    for (jour, h), c in zip(tetes, re.split(r"<td[^>]*>", tbody)[1:]):
        t = texte(c)
        ciel = re.search(r'alt="([^"]+)"', c)
        vents = re.findall(r"(\d+)\s*km/h", t)
        dirm = re.search(r"Direction du vent : (\w+)", t)
        tm = re.search(r"Température (-?\d+)", t)
        pm = re.search(r"Précipitations : ([\d.,]+)", t)
        hm = re.search(r"(\d+) % Humidité", t)
        points.append({
            "t": a_heure(date_du_jour(int(jour)), int(h)),
            "temp": float(tm.group(1)) if tm else None,
            "dir": dir_en_degres(dirm.group(1)) if dirm else None,
            "moy": float(vents[0]) if vents else None, "raf": float(vents[1]) if len(vents) > 1 else None,
            "pluie": float(pm.group(1).replace(",", ".")) if pm else 0.0,
            "hum": float(hm.group(1)) if hm else None,
            "ciel": ciel.group(1) if ciel else "", "pas": 1,
        })
    # par jour (10 jours)
    s = lire(URL_AGRICOLE_J)
    thead = s[s.find("<thead"):s.find("</thead>")]
    nums = re.findall(r'<span class="fs-5\s+mt-1 mb-1">(\d+)</span>', thead)
    tbody = s[s.find("<tbody"):s.find("</tbody>")]
    jours = []
    for num, c in zip(nums, re.split(r"<td[^>]*>", tbody)[1:]):
        t = texte(c)
        ciel = re.search(r'alt="([^"]+)"', c)
        tmax = re.search(r"Température maxi (-?\d+)", t)
        tmin = re.search(r"min (-?\d+)", t)
        vents = re.findall(r"(\d+)\s*km/h", t)
        dirm = re.search(r"Direction du vent : (\w+)", t)
        if not tmax:
            continue
        pj = re.search(r"Précipitations : ([\d.,]+)(?: à ([\d.,]+))? ?mm", t)
        pluie_jour = None
        if pj:
            lo = float(pj.group(1).replace(",", "."))
            hi = float(pj.group(2).replace(",", ".")) if pj.group(2) else lo
            pluie_jour = (lo + hi) / 2
        jours.append({
            "pluie_jour": pluie_jour,
            "date": date_du_jour(int(num)), "tmin": float(tmin.group(1)) if tmin else None, "tmax": float(tmax.group(1)),
            "dir": dir_en_degres(dirm.group(1)) if dirm else None,
            "moy": float(vents[0]) if vents else None, "raf": float(vents[1]) if len(vents) > 1 else None,
            "ciel": ciel.group(1) if ciel else "",
        })
    return {"points": points, "jours": jours}


# ------------------------------------------------------------- Meteo-France
PERIODES_MF = {"matin": (6, 12), "après-midi": (12, 18), "soirée": (18, 24), "nuit": (24, 30)}


def periodes_mf(s):
    periodes = []
    for bloc in re.split(r'<li class="day">', s)[1:]:
        h4 = re.search(r"<h4[^>]*>(.*?)</h4>", bloc, re.S)
        if not h4:
            continue
        d = date_du_jour(int(re.search(r"(\d+)", texte(h4.group(1))).group(1)))
        for it in re.findall(r'<li class="period_item[^"]*"[^>]*>(.*?)</li>', bloc, re.S):
            per = re.search(r'<div class="period">(.*?)</div>', it, re.S)
            nom = texte(per.group(1)).lower() if per else ""
            if nom not in PERIODES_MF:
                continue
            h0, h1 = PERIODES_MF[nom]
            ciel = re.search(r'class="weather_temp".*?alt="([^"]+)"', it, re.S)
            temp = re.search(r'class="weather_temp".*?<p>\s*(-?\d+)', it, re.S)
            dirv = re.search(r'alt="Vent (\w+)"', it)
            moy = re.search(r"<strong>(\d+)</strong>", it)
            raf = re.search(r'rafales_speed[^>]*>(\d+)', it)
            periodes.append({
                "debut": a_heure(d, h0), "fin": a_heure(d, h1),
                "temp": float(temp.group(1)) if temp else None,
                "dir": dir_en_degres(dirv.group(1)) if dirv else None,
                "moy": float(moy.group(1)) if moy else None, "raf": float(raf.group(1)) if raf else None,
                "ciel": ciel.group(1) if ciel else "",
            })
    return periodes


def meteofrance():
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(locale="fr-FR", user_agent=UA)
        pg.goto(URL_MF, wait_until="networkidle", timeout=60000)
        pg.wait_for_selector("#atmogramme_time_picker li.day", timeout=30000)
        aujourdhui = pg.inner_html("#atmogramme_time_picker")
        # fenetre des cookies : on refuse, sinon on la retire de la page
        try:
            pg.click("#didomi-notice-disagree-button, .didomi-continue-without-agreeing", timeout=3000)
        except Exception:
            pass
        pg.evaluate("document.getElementById('didomi-host')?.remove(); document.body.style.overflow='auto'")
        pg.click("#msc_tomorrow")
        pg.wait_for_timeout(2500)
        demain = pg.inner_html("#atmogramme_time_picker")
        pg.click("#msc_15D")
        pg.wait_for_timeout(2500)
        quinze = pg.inner_html("#atmogramme_time_picker")
        b.close()
    periodes = {p["debut"]: p for p in periodes_mf(aujourdhui) + periodes_mf(demain)}
    jours = []
    for it in re.findall(r'<li class="period_item[^"]*"[^>]*>(.*?)</li>', quinze, re.S):
        per = re.search(r'<div class="period upper">(.*?)</div>', it, re.S)
        tmin = re.search(r'class="min">(-?\d+)', it)
        tmax = re.search(r'class="max">(-?\d+)', it)
        if not (per and tmin and tmax):
            continue
        ciel = re.search(r'alt="((?!Vent)[^"]+)"', it)
        dirv = re.search(r'alt="Vent (\w+)"', it)
        moy = re.search(r"<strong>(\d+)</strong>", it)
        raf = re.search(r'rafales_speed[^>]*>(\d+)', it)
        jours.append({
            "date": date_du_jour(int(re.search(r"(\d+)", texte(per.group(1))).group(1))),
            "tmin": float(tmin.group(1)), "tmax": float(tmax.group(1)),
            "dir": dir_en_degres(dirv.group(1)) if dirv else None,
            "moy": float(moy.group(1)) if moy else None, "raf": float(raf.group(1)) if raf else None,
            "ciel": ciel.group(1) if ciel else "",
        })
    return {"periodes": sorted(periodes.values(), key=lambda p: p["debut"]), "jours": jours}


# ---------------------------------------------------------- Meteo Languedoc
PERIODES_ML = {"matin": (6, 12), "apres-midi": (12, 21), "nuit": (21, 30)}


def languedoc():
    periodes = []
    for k in range(7):
        d = dt.date.today() + dt.timedelta(days=k)
        trouve = False
        for per, (h0, h1) in PERIODES_ML.items():
            try:
                s = lire(URL_LANGUEDOC.format(date=d.isoformat(), periode=per))
            except Exception:
                continue
            t = texte(re.sub(r"<script.*?</script>|<style.*?</style>", "", s, flags=re.S))
            if f"Bulletin du {d.day:02d}/{d.month:02d}" not in t:
                continue  # le site renvoie un autre jour quand celui-ci n'existe pas
            m = re.search(VILLE_LANGUEDOC + r" Ciel : (.*?) Température : (-?\d+)\s*°C Vent : (\d+)\s*km/h (\w+)", t)
            if not m:
                continue
            trouve = True
            periodes.append({
                "debut": a_heure(d, h0), "fin": a_heure(d, h1), "temp": float(m.group(2)),
                "dir": dir_en_degres(m.group(4)), "moy": float(m.group(3)), "raf": None, "ciel": m.group(1),
            })
        if not trouve and k > 0:
            break
    return {"periodes": periodes, "lieu": "Le Vigan"}


# ------------------------------------------------- mise sur la grille de 3h
def uniformiser(points=(), periodes=(), jours=(), rafales_cachees_si_faibles=False):
    points = sorted(points, key=lambda p: p["t"])
    exacts = {p["t"]: p for p in points}
    # reperes de temperature pour estimer entre deux valeurs connues
    reperes = [(p["t"], p["temp"]) for p in points if p["temp"] is not None]
    reperes += [((p["debut"] + (p["fin"] - p["debut"]) / 2), p["temp"]) for p in periodes if p["temp"] is not None]
    for j in jours:
        reperes += [(a_heure(j["date"], 6), j["tmin"]), (a_heure(j["date"], 15), j["tmax"])]
    reperes = sorted(dict(reperes).items())
    if not reperes:
        return []
    fin_donnees = max([reperes[-1][0]] + [p["fin"] for p in periodes] + [a_heure(j["date"], 24) for j in jours])

    t = dt.datetime.now().replace(minute=0, second=0, microsecond=0) - 2 * H
    while t.hour % 3 != 1:
        t += H
    lignes = []
    while t < fin_donnees:
        ligne = None
        if t in exacts and exacts[t]["pas"] == 3:
            p = exacts[t]
            ligne = {k: p[k] for k in ("temp", "dir", "moy", "raf", "pluie", "hum", "ciel")}
            ligne["estime"] = False
        elif t in exacts:  # pas de 1h (pluie a cumuler) ou de 6h (pluie a partager)
            p = exacts[t]
            ligne = {k: p[k] for k in ("temp", "dir", "moy", "raf", "hum", "ciel")}
            if p["pas"] == 1:
                ligne["pluie"] = round(sum(exacts[t - k * H]["pluie"] for k in range(3) if t - k * H in exacts), 1)
                ligne["estime"] = False
            else:
                ligne["pluie"] = round(p["pluie"] / 2, 1)
                ligne["estime"] = p["pluie"] > 0
        else:
            ligne = {"pluie": None, "hum": None, "estime": True}
            source = next((p for p in periodes if p["debut"] <= t < p["fin"]), None)
            if source is None:
                source = next((j for j in jours if j["date"] == t.date()), None)
            if source is None:  # point le plus proche dans les 6h (ex. tendances Meteociel toutes les 6h)
                proches = [p for p in points if abs((p["t"] - t).total_seconds()) <= 3 * 3600]
                if proches:
                    source = min(proches, key=lambda p: abs((p["t"] - t).total_seconds()))
                    suivant = next((p for p in points if p["t"] > t and p["pas"] == 6), None)
                    if suivant and suivant["t"] - t == 3 * H:
                        ligne["pluie"] = round(suivant["pluie"] / 2, 1)
                    ligne["hum"] = source.get("hum")
            if source is None:
                t += 3 * H
                continue
            for k in ("dir", "moy", "raf", "ciel"):
                ligne[k] = source.get(k)
            if ligne["pluie"] is None and source.get("pluie_jour") is not None:
                ligne["pluie"] = round(source["pluie_jour"] / 8, 1)  # total du jour partage sur 8 lignes de 3h
            # temperature : ligne droite entre les deux reperes autour
            avant = [r for r in reperes if r[0] <= t]
            apres = [r for r in reperes if r[0] > t]
            if avant and apres and (apres[0][0] - avant[-1][0]) <= 30 * H:
                (t0, v0), (t1, v1) = avant[-1], apres[0]
                ligne["temp"] = round(v0 + (v1 - v0) * (t - t0) / (t1 - t0), 1)
            else:
                ligne["temp"] = (avant[-1] if avant else apres[0])[1]
        ligne["t"] = t.isoformat(timespec="minutes")
        ligne["code"] = code_ciel(ligne.get("ciel"))
        if ligne.get("pluie") is None:
            # le site ne donne pas de mm : on ecrit le niveau de pluie lu dans son ciel
            c = ligne["code"]
            ligne["pluie_txt"] = ("orage" if c >= 95 else "forte" if c in (65, 82) else "modérée" if c in (63, 81)
                                  else "faible" if c in (51, 61, 80) else "neige" if c == 71 else "sec")
        if ligne.get("hum") is None:
            # pas d'humidite sur ce site : niveau deduit du ciel
            c = ligne["code"]
            niveaux = ["sec", "moyen", "humide", "très humide"]
            n = 3 if c >= 45 else 2 if c == 3 else 1 if c in (1, 2) else 0
            if t.hour < 9 or t.hour >= 19:
                n = min(3, n + 1)  # la nuit l'air est plus humide
            ligne["hum_txt"] = niveaux[n]
        if ligne.get("raf") is None:
            if rafales_cachees_si_faibles:
                ligne["raf_txt"] = "faibles"  # Meteo-France n'affiche les rafales que quand elles sont fortes
            elif ligne.get("moy") is not None:
                ligne["raf"] = round(ligne["moy"] * 1.5 / 5) * 5  # rafales estimees : 1,5 x le vent moyen
                ligne["estime"] = True
        lignes.append(ligne)
        t += 3 * H
    return lignes


def main():
    resultat = {"maj": dt.datetime.now().isoformat(timespec="minutes"), "sources": {}}
    for nom, f in [("meteociel", meteociel), ("meteofrance", meteofrance), ("agricole", agricole), ("languedoc", languedoc)]:
        try:
            brut = f()
            lignes = uniformiser(brut.get("points", ()), brut.get("periodes", ()), brut.get("jours", ()),
                                 rafales_cachees_si_faibles=(nom == "meteofrance"))
            resultat["sources"][nom] = {"lignes": lignes, "lieu": brut.get("lieu")}
            jours = len({l["t"][:10] for l in lignes})
            print(f"{nom}: {len(lignes)} lignes, {jours} jours")
        except Exception as e:
            traceback.print_exc()
            resultat["sources"][nom] = {"erreur": f"{type(e).__name__}: {e}"}
            print(f"{nom}: ERREUR {e}", file=sys.stderr)
    js = "window.DONNEES = " + json.dumps(resultat, ensure_ascii=False).replace("<", "\\u003c") + ";\n"
    SORTIE.write_text(js, encoding="utf-8")
    print("Ecrit :", SORTIE)


if __name__ == "__main__":
    main()
