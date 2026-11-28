"""Brique 2 : investissements.
Lit l'action DJT, l'or, l'argent (Yahoo Finance) et les actualités Trump (Bing Actualités, flux RSS),
puis écrit bourse.js (window.BOURSE = {...}). Les cryptos sont lues en direct par la page (CoinGecko).
"""
import datetime as dt
import html
import json
import re
import sys
import traceback
import urllib.parse
import urllib.request
from pathlib import Path

SORTIE = Path(__file__).with_name("bourse.js")
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36"


def lire(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "fr-FR,fr;q=0.9"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", "replace")


def yahoo(symbole):
    """Cours actuel + 1 an de clôtures journalières + 5 jours heure par heure."""
    sortie = {}
    for nom, plage, pas in [("an", "1y", "1d"), ("semaine", "5d", "60m")]:
        d = json.loads(lire(f"https://query1.finance.yahoo.com/v8/finance/chart/{urllib.parse.quote(symbole)}?range={plage}&interval={pas}"))
        res = d["chart"]["result"][0]
        meta = res["meta"]
        fermetures = res["indicators"]["quote"][0]["close"]
        points = [[t, round(c, 4)] for t, c in zip(res.get("timestamp", []), fermetures) if c is not None]
        sortie[nom] = points
        if nom == "an":
            sortie["prix"] = meta.get("regularMarketPrice")
            sortie["devise"] = meta.get("currency")
            sortie["heure"] = meta.get("regularMarketTime")
            # clôture de la veille = avant-dernier point journalier
            sortie["veille"] = points[-2][1] if len(points) >= 2 else None
    return sortie


CRYPTOS = {"bitcoin": "BTC-EUR", "ripple": "XRP-EUR", "solana": "SOL-EUR", "dogecoin": "DOGE-EUR",
           "ethereum": "ETH-EUR", "usd-coin": "USDC-EUR"}


def historique(symbole):
    """1 an jour par jour + 5 ans semaine par semaine (deja en euros)."""
    sortie = {}
    for nom, plage, pas in [("an", "1y", "1d"), ("cinq", "5y", "1wk")]:
        d = json.loads(lire(f"https://query1.finance.yahoo.com/v8/finance/chart/{urllib.parse.quote(symbole)}?range={plage}&interval={pas}"))
        res = d["chart"]["result"][0]
        fermetures = res["indicators"]["quote"][0]["close"]
        sortie[nom] = [[t, float(f"{c:.6g}")] for t, c in zip(res.get("timestamp", []), fermetures) if c is not None]
    return sortie


def cryptos():
    return {nom: historique(sym) for nom, sym in CRYPTOS.items()}


def actualites(nombre=12):
    """Plusieurs recherches (Bing renvoie parfois tres peu de resultats au robot), sans doublons,
    completees par les actus encore recentes de la lecture d'avant."""
    infos, vus = [], set()
    for recherche in ["Trump", "Donald Trump", "Trump Maison Blanche"]:
        try:
            for a in actualites_bing(recherche):
                if a["lien"] not in vus and a["titre"]:
                    vus.add(a["lien"]); infos.append(a)
        except Exception as e:
            print("actus", recherche, ":", e, file=sys.stderr)
        if len(infos) >= nombre:
            break
    try:
        t = SORTIE.read_text(encoding="utf-8")
        avant = json.loads(t[t.index("=") + 1:].strip().rstrip(";")).get("actus", [])
    except Exception:
        avant = []
    limite = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=3)).isoformat()
    for a in avant:
        if a.get("lien") not in vus and (a.get("date") or "") >= limite:
            vus.add(a.get("lien")); infos.append(a)
    if not infos:
        raise RuntimeError("aucune actualite")
    infos.sort(key=lambda a: a.get("date") or "", reverse=True)
    return infos[:nombre]


def actualites_bing(recherche):
    rss = lire(f"https://www.bing.com/news/search?q={urllib.parse.quote(recherche)}&format=rss&setlang=fr&cc=FR&mkt=fr-FR")
    infos = []
    for item in re.findall(r"<item>(.*?)</item>", rss, re.S):
        def champ(nom):
            m = re.search(rf"<{nom}>(.*?)</{nom}>", item, re.S)
            return html.unescape(html.unescape(m.group(1).strip())) if m else ""
        lien = champ("link")
        vrai = urllib.parse.parse_qs(urllib.parse.urlparse(lien).query).get("url", [lien])[0]
        image = champ("News:Image")
        if image.startswith("http://"):
            image = "https://" + image[len("http://"):]
        try:
            date = dt.datetime.strptime(champ("pubDate"), "%a, %d %b %Y %H:%M:%S %Z").replace(tzinfo=dt.timezone.utc).isoformat()
        except ValueError:
            date = None
        infos.append({"titre": champ("title"), "resume": champ("description"), "source": champ("News:Source"),
                      "image": image + ("&w=400&h=225&c=14" if image else ""), "lien": vrai, "date": date})
    return infos


def main():
    resultat = {"maj": dt.datetime.now().isoformat(timespec="minutes")}
    try:
        t = SORTIE.read_text(encoding="utf-8")
        avant = json.loads(t[t.index("=") + 1:].strip().rstrip(";"))
    except Exception:
        avant = {}
    taches = [("djt", lambda: yahoo("DJT")), ("or", lambda: yahoo("GC=F")), ("argent", lambda: yahoo("SI=F")),
              ("eurusd", lambda: yahoo("EURUSD=X")), ("actus", actualites),
              ("cryptos", cryptos)]
    for nom, f in taches:
        try:
            try:
                resultat[nom] = f()
            except Exception as e1:
                print(f"{nom}: 1er essai rate ({e1}), on reessaie", file=sys.stderr)
                resultat[nom] = f()
            print(f"{nom}: ok")
        except Exception as e:
            traceback.print_exc()
            if nom in avant:  # on garde la derniere bonne lecture
                resultat[nom] = avant[nom]
                print(f"{nom}: ERREUR {e}, on garde l'ancienne lecture", file=sys.stderr)
            else:
                print(f"{nom}: ERREUR {e}", file=sys.stderr)
    js = "window.BOURSE = " + json.dumps(resultat, ensure_ascii=False).replace("<", "\\u003c") + ";\n"
    SORTIE.write_text(js, encoding="utf-8")
    print("Ecrit :", SORTIE)


if __name__ == "__main__":
    main()
