// Petit assistant météo : répond aux questions avec les données des 4 sites.
// La clé API Claude est dans la variable d'environnement ANTHROPIC_API_KEY (réglée sur Vercel, jamais dans le code).
import Anthropic from "@anthropic-ai/sdk";

const DONNEES = "https://raw.githubusercontent.com/jouanyanou-png/meteo-monoblet/main/donnees.js";
const NOMS = { meteociel: "Meteociel", meteofrance: "Météo-France", agricole: "Météo Agricole", languedoc: "Météo Languedoc (Le Vigan)" };
const JOURS = ["dim", "lun", "mar", "mer", "jeu", "ven", "sam"];
const client = new Anthropic();

// Les données en lignes courtes, pour que Claude les lise vite (et que ça coûte peu)
export function resume(D) {
  let s = `Données lues à ${D.maj.replace("T", " ")}.\n`;
  for (const [id, nom] of Object.entries(NOMS)) {
    const src = D.sources[id] || {};
    if (!src.lignes) { s += `\n## ${nom} : non lu\n`; continue; }
    s += `\n## ${nom}${src.ancien ? ` (lecture de ${src.ancien})` : ""}\njour heure | temp °C | pluie sur 3h | vent moyen/rafales km/h | ciel\n`;
    for (const l of src.lignes.slice(0, 64)) {
      const d = new Date(l.t + ":00");
      const pluie = l.pluie != null ? `${l.pluie} mm` : (l.pluie_txt || "?");
      s += `${JOURS[d.getDay()]} ${d.getDate()} ${String(d.getHours()).padStart(2, "0")}h | ${l.temp != null ? Math.round(l.temp) : "?"} | ${pluie} | ${l.moy ?? "?"}/${l.raf ?? l.raf_txt ?? "?"} | ${l.ciel || ""}${l.estime ? " (estimé)" : ""}\n`;
    }
  }
  return s;
}

const CONSIGNES = `Tu es le petit assistant météo d'une maison à Monoblet (Gard, 30170), dans les Cévennes.
La personne qui te parle s'occupe de la maison, du linge, du jardin, des courses. Elle n'est pas spécialiste de la météo.
Tu as les prévisions de 4 sites (Meteociel, Météo-France, Météo Agricole, Météo Languedoc), uniformisées par tranches de 3 heures.
Météo Languedoc parle du Vigan, un peu plus loin : son vent est souvent plus fort qu'à Monoblet.

Comment répondre :
- En français simple, phrases courtes, 2 à 4 phrases maximum. Commence par la réponse directe (oui / non / plutôt…).
- Donne le jour et l'heure concrets ("demain après-midi", "jeudi matin").
- Si les sites ne sont pas d'accord, dis-le en une phrase et dis lequel penche de quel côté.
- Base-toi uniquement sur les données ci-dessous. Si la réponse n'y est pas (au-delà des jours prévus, autre lieu…), dis-le simplement.
- Pas de titres, pas de listes, pas de tableaux, pas d'émojis sauf un au début si utile.`;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ erreur: "POST seulement" });
  const { question, historique } = req.body || {};
  if (typeof question !== "string" || !question.trim() || question.length > 400)
    return res.status(400).json({ erreur: "Question vide ou trop longue." });

  try {
    const r = await fetch(DONNEES + "?t=" + Date.now());
    const t = await r.text();
    const D = JSON.parse(t.slice(t.indexOf("=") + 1).trim().replace(/;$/, ""));
    const maintenant = new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

    // les derniers échanges seulement (6 messages), pour garder le fil sans coûter cher
    const avant = (Array.isArray(historique) ? historique : []).slice(-6)
      .filter(m => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.length < 2000);

    const reponse = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      system: [
        { type: "text", text: CONSIGNES },
        { type: "text", text: resume(D), cache_control: { type: "ephemeral" } },
      ],
      messages: [...avant, { role: "user", content: `(Nous sommes ${maintenant}.)\n${question.trim()}` }],
    });

    if (reponse.stop_reason === "refusal")
      return res.status(200).json({ reponse: "Je ne peux pas répondre à cette question. Essaie de la poser autrement." });
    const texte = reponse.content.filter(b => b.type === "text").map(b => b.text).join("").trim();
    return res.status(200).json({ reponse: texte || "Je n'ai pas de réponse, essaie de reformuler." });
  } catch (e) {
    console.error(e);
    const pasDeCle = e instanceof Anthropic.AuthenticationError || /api.?key/i.test(String(e.message));
    return res.status(500).json({ erreur: pasDeCle ? "L'assistant n'est pas encore branché (clé manquante)." : "L'assistant n'a pas pu répondre. Réessaie dans un moment." });
  }
}
