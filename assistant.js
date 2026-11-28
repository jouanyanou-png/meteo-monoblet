// ---------- Petit assistant gratuit (sans IA) : comprend des mots-clés et répond avec la Moyenne des 4 météos ----------
const Assistant=(function(){
  const JOURS_LONG=["dimanche","lundi","mardi","mercredi","jeudi","vendredi","samedi"];
  const sansAccent=s=>s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/['’]/g," ");
  const jourDe=l=>l.t.slice(0,10);
  const heure=l=>+l.t.slice(11,13);
  const r=Math.round;
  const pleut=l=>l.pluie!=null&&l.pluie>=0.3;

  function nomJour(j){
    const auj=new Date(); auj.setHours(12,0,0,0);
    const d=new Date(j+"T12:00"), ecart=r((d-auj)/864e5);
    if(ecart===0) return "aujourd'hui";
    if(ecart===1) return "demain";
    if(ecart===2) return "après-demain";
    return JOURS_LONG[d.getDay()]+" "+d.getDate();
  }
  const Maj=s=>s.charAt(0).toUpperCase()+s.slice(1);
  const moment=h=>h<7?"dans la nuit":h<13?"le matin":h<19?"l'après-midi":"le soir";

  // Quelle période la question vise-t-elle ?
  function periode(q,L){
    const jours=[...new Set(L.map(jourDe))];
    const auj=new Date(); const iso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
    const plus=n=>{const d=new Date(auj); d.setDate(d.getDate()+n); return iso(d);};
    let choix=null, mot="";
    q=q.replace(/aujourdhui|ojourdhui|aujourdui/g,"aujourd hui");
    q=q.replace(/\b(demin|demai|deman)\b/g,"demain");
    if(/apres[ -]demain/.test(q)){choix=[plus(2)]; mot="après-demain";}
    else if(/demain/.test(q)){choix=[plus(1)]; mot="demain";}
    else if(/aujourd|ce matin|cet apres|ce soir|cette nuit|maintenant|tout a l heure/.test(q)){choix=[plus(0)]; mot="aujourd'hui";}
    else if(/week|samedi et dimanche/.test(q)){choix=jours.filter(j=>[0,6].includes(new Date(j+"T12:00").getDay())).slice(0,2); mot="ce week-end";}
    else{
      for(let i=0;i<7;i++){ if(new RegExp("\\b"+JOURS_LONG[i]).test(q)){ choix=jours.filter(j=>new Date(j+"T12:00").getDay()===i&&j>=plus(0)).slice(0,1); mot=JOURS_LONG[i]; break; } }
    }
    if(!choix){ if(/semaine|prochains jours|jours qui viennent|bientot/.test(q)){choix=jours.slice(0,7); mot="cette semaine";} }
    let lignes=choix?L.filter(l=>choix.includes(jourDe(l))):null;
    // moment de la journée
    if(lignes){
      if(/matin/.test(q)) lignes=lignes.filter(l=>heure(l)>=7&&heure(l)<13);
      else if(/apres[ -]?midi|aprem/.test(q)) lignes=lignes.filter(l=>heure(l)>=13&&heure(l)<19);
      else if(/soir/.test(q)) lignes=lignes.filter(l=>heure(l)>=19);
      else if(/nuit/.test(q)) lignes=lignes.filter(l=>heure(l)<7||heure(l)>=22);
    }
    const maintenant=new Date(Date.now()-3*36e5).toISOString().slice(0,13);
    if(lignes) lignes=lignes.filter(l=>l.t.slice(0,13)>=maintenant||jourDe(l)>plus(0));
    return {lignes, mot, vide: choix&&(!choix.length||!lignes.length)};
  }

  function accordPhrase(L){
    const non=L.filter(l=>l.accord==="non").length;
    return non>L.length/3?" Attention, les sites ne sont pas bien d'accord : regarde les 4 tableaux.":"";
  }

  // ----- les réponses -----
  function linge(L,mot){
    const jour=L.filter(l=>heure(l)>=7&&heure(l)<=16);
    const parJour=groupe(jour.length?jour:L);
    const out=[];
    for(const [j,ls] of parJour){
      const pl=ls.filter(pleut), apm=ls.filter(l=>heure(l)>=13), t=apm.length?Math.max(...apm.map(l=>l.temp)):Math.max(...ls.map(l=>l.temp));
      const vent=Math.max(...ls.map(l=>l.raf||0));
      if(!pl.length) out.push(`${Maj(nomJour(j))} : oui, temps sec, jusqu'à ${r(t)} °C${vent>=45?`, mais rafales à ${r(vent)} km/h, pense aux pinces`:""}.`);
      else if(pl.length===ls.length) out.push(`${Maj(nomJour(j))} : non, pluie prévue toute la journée.`);
      else{ const h=heure(pl[0]); out.push(`${Maj(nomJour(j))} : plutôt ${h>=13?"le matin, il pleut à partir de "+h+"h":"l'après-midi, la pluie est surtout "+moment(h)}.`); }
    }
    return out.join("\n")+accordPhrase(L);
  }
  function pluie(L,mot){
    const pl=L.filter(pleut);
    if(!pl.length) return `Non, pas de pluie prévue ${mot}.`+accordPhrase(L);
    const out=[];
    for(const [j,ls] of groupe(L)){
      const p=ls.filter(pleut); if(!p.length){ out.push(`${Maj(nomJour(j))} : sec.`); continue; }
      const tot=p.reduce((s,l)=>s+l.pluie,0), max=p.reduce((a,b)=>b.pluie>a.pluie?b:a);
      out.push(`${Maj(nomJour(j))} : pluie, environ ${tot.toFixed(tot<10?1:0).replace(".",",")} mm, surtout ${moment(heure(max))}${max.pluie>=4?" (forte)":""}.`);
    }
    return "Oui.\n"+out.join("\n")+accordPhrase(L);
  }
  function gel(L,mot){
    const min=L.reduce((a,b)=>b.temp<a.temp?b:a);
    if(min.temp<=0.5) return `Oui, risque de gel : jusqu'à ${r(min.temp)} °C ${nomJour(jourDe(min))} vers ${heure(min)}h. Pense à protéger les plantes.`;
    if(min.temp<=3) return `Pas de gel prévu, mais c'est juste : ${r(min.temp)} °C au plus froid, ${nomJour(jourDe(min))} vers ${heure(min)}h.`;
    return `Non, pas de gel ${mot} : au plus froid ${r(min.temp)} °C (${nomJour(jourDe(min))} vers ${heure(min)}h).`;
  }
  function vent(L,mot){
    const max=L.reduce((a,b)=>(b.raf||0)>(a.raf||0)?b:a);
    const f=max.raf||0;
    const quand=`${nomJour(jourDe(max))} ${moment(heure(max))}`;
    if(f>=60) return `Oui, vent fort : rafales jusqu'à ${r(f)} km/h ${quand}. Range ce qui peut s'envoler.`;
    if(f>=40) return `Un peu de vent : rafales jusqu'à ${r(f)} km/h ${quand}.`;
    return `Non, peu de vent ${mot} : rafales au plus ${r(f)} km/h.`;
  }
  function temperature(L,mot){
    return [...groupe(L)].map(([j,ls])=>`${Maj(nomJour(j))} : de ${r(Math.min(...ls.map(l=>l.temp)))} à ${r(Math.max(...ls.map(l=>l.temp)))} °C.`).join("\n");
  }
  function general(L,mot){
    return [...groupe(L)].map(([j,ls])=>{
      const p=ls.filter(pleut).length, tMin=r(Math.min(...ls.map(l=>l.temp))), tMax=r(Math.max(...ls.map(l=>l.temp)));
      const ciel=p===0?"sec":p>=ls.length/2?"pluvieux":"quelques pluies";
      const v=Math.max(...ls.map(l=>l.raf||0));
      return `${Maj(nomJour(j))} : ${ciel}, ${tMin} à ${tMax} °C${v>=45?", venteux":""}.`;
    }).join("\n")+accordPhrase(L);
  }
  // promenade, balade, courses... : le meilleur moment sec de la journée
  function sortie(L,mot){
    const out=[];
    for(const [j,ls] of groupe(L)){
      const jour=ls.filter(l=>heure(l)>=7&&heure(l)<=19); if(!jour.length) continue;
      const sec=jour.filter(l=>!pleut(l)), t=Math.max(...jour.map(l=>l.temp)), v=Math.max(...jour.map(l=>l.raf||0));
      const habit=t<8?" Couvre-toi bien.":t<14?" Prends une veste.":"";
      if(sec.length===jour.length) out.push(`${Maj(nomJour(j))} : oui, temps sec toute la journée, jusqu'à ${r(t)} °C${v>=45?", mais du vent ("+r(v)+" km/h)":""}.${habit}`);
      else if(!sec.length) out.push(`${Maj(nomJour(j))} : pas idéal, il pleut toute la journée. Prends le parapluie.`);
      else{
        // plus longue suite de créneaux secs
        let best=[],cur=[]; jour.forEach(l=>{ if(!pleut(l)){cur.push(l); if(cur.length>best.length) best=[...cur];} else cur=[]; });
        const h1=heure(best[0]), h2=Math.min(heure(best[best.length-1])+3,20);
        out.push(`${Maj(nomJour(j))} : oui, plutôt entre ${h1}h et ${h2}h, c'est sec. Il pleut ${moment(heure(jour.find(pleut)))}.${habit}`);
      }
    }
    return (out.join("\n")||"Je n'ai pas de prévisions pour ce moment.")+accordPhrase(L);
  }
  function meilleurJour(L,quoi){
    const notes=[...groupe(L)].map(([j,ls])=>{
      const jour=ls.filter(l=>heure(l)>=7&&heure(l)<=16); if(jour.length<2) return null;
      const p=jour.filter(pleut).length, t=Math.max(...jour.map(l=>l.temp)), v=Math.max(...jour.map(l=>l.raf||0));
      return {j, note: -p*3 - Math.max(0,30-v<0?(v-30)/10:0) + Math.min(t,22)/4 - jour.filter(l=>l.accord==="non").length*0.5, p, t, v};
    }).filter(Boolean).sort((a,b)=>b.note-a.note);
    if(!notes.length) return "Je n'ai pas assez de prévisions pour choisir un jour.";
    const b=notes[0], b2=notes[1];
    let s=`Le meilleur jour pour ${quoi} : ${nomJour(b.j)} (${b.p?"un peu de pluie possible":"sec"}, jusqu'à ${r(b.t)} °C${b.v>=40?", du vent":""}).`;
    if(b2&&b2.note>b.note-2) s+=`\n${Maj(nomJour(b2.j))} est bien aussi.`;
    return s;
  }
  function desaccord(L){
    const non=L.filter(l=>l.accord==="non");
    if(!non.length) return "Les 4 sites sont plutôt d'accord sur cette période.";
    const ex=non[0];
    return `Les sites hésitent ${non.length} fois sur cette période, par exemple ${nomJour(jourDe(ex))} à ${heure(ex)}h — ${ex.detail}.\nC'est normal : chaque site utilise son propre modèle, et la montagne rend la pluie difficile à prévoir. Dans le doute, regarde les 4 tableaux.`;
  }
  function groupe(L){ const m=new Map(); L.forEach(l=>{const j=jourDe(l); if(!m.has(j)) m.set(j,[]); m.get(j).push(l);}); return m; }

  const AIDE="Je comprends les questions sur : le linge, la pluie, le gel, le vent, la température, le jardin, quel temps il fera, et quand les sites ne sont pas d'accord.\nTu peux préciser : aujourd'hui, demain, un jour (jeudi…), le week-end ou la semaine.\nExemple : « Il va pleuvoir samedi ? »";

  function repondre(question){
    const D=window.DONNEES; if(!D) return "Les données ne sont pas encore chargées, réessaie dans un instant.";
    const L=moyenneLignes(D); if(!L.length) return "Je n'ai pas de prévisions pour le moment.";
    const q=sansAccent(question);
    const P=periode(q,L);
    if(P.vide) return "Les prévisions ne vont pas jusque-là, ou ce moment est déjà passé.";
    const parDefaut=n=>L.filter(l=>l.t>=new Date(Date.now()-3*36e5).toISOString().slice(0,13)).slice(0,n);
    const mot=P.mot||"ces prochains jours";
    if(/merci/.test(q)) return "Avec plaisir !";
    if(/dans \d+ (semaines|mois)|dans (deux|trois|quinze) (semaines|jours)|mois prochain|l an prochain|noel|nouvel an/.test(q)) return "C'est trop loin : les prévisions vont au plus à "+[...new Set(L.map(jourDe))].length+" jours.";
    if(/^(bonjour|salut|coucou|hello)\b/.test(q)&&q.length<15) return "Bonjour ! "+AIDE;
    if(/d accord|desaccord|pourquoi|differ|se trompe|fiable|croire/.test(q)) return desaccord(P.lignes||parDefaut(16));
    if(/(promen|promn|prome|balad|marche|randon|rando|sortir|sortie|velo|courses|marche|chien|footing|courir|pique[ -]?nique)/.test(q)&&!/quel jour|meilleur|quand/.test(q)) return sortie(P.lignes||parDefaut(16),mot);
    if(/linge|lin?ge|etend|etan|secher|lessive|sechage/.test(q)) return linge(P.lignes||parDefaut(16),mot);
    if(/quel jour|meilleur|quand .*(jardin|planter|tondre|sortir|promen|travaux|bricol)|jardin|planter|tondre|potager|tailler|semer|(promen|promn|prome|balad|marche|randon|rando|sortir|sortie|velo|courses|marche|chien|footing|courir|pique[ -]?nique)/.test(q)&&!/arros/.test(q))
      return P.lignes&&P.lignes.length&&!/quel jour|meilleur|quand/.test(q) ? general(P.lignes,mot)+"\n"+(P.lignes.some(pleut)?"Pas idéal pour le jardin à cause de la pluie.":"Bon pour le jardin.") : meilleurJour(P.lignes||L,/(promen|promn|prome|balad|marche|randon|rando|sortir|sortie|velo|courses|marche|chien|footing|courir|pique[ -]?nique)/.test(q)?"sortir":"le jardin");
    if(/arros/.test(q)){ const pl=(P.lignes||parDefaut(16)).filter(pleut); return pl.length?`Pas besoin d'arroser : la pluie s'en charge (${pl.reduce((s,l)=>s+l.pluie,0).toFixed(1).replace(".",",")} mm prévus).`:"Oui, pas de pluie prévue : il faudra arroser."; }
    if(/gel|geler|givre|gelee|jel/.test(q)) return gel(P.lignes||L.slice(0,56),P.mot||"cette semaine");
    if(/pleu|plui|plu |parapluie|averse|orage|mouill/.test(q)) return pluie(P.lignes||parDefaut(16),mot);
    if(/vent|van |rafale|mistral|tramontane|souffl/.test(q)) return vent(P.lignes||parDefaut(16),mot);
    if(/temperature|degre|chaud|froid|chaleur|couvrir|manteau|habill/.test(q)) return temperature(P.lignes||parDefaut(16),mot);
    if(/temps|meteo|prevision|beau|soleil|fera/.test(q)||P.lignes) return general(P.lignes||parDefaut(24),mot);
    return "Je n'ai pas compris, désolé.\n"+AIDE;
  }
  return {repondre};
})();
