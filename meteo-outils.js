// Outils météo partagés par la page Météo et le tableau de bord
const JOURS=["Dim.","Lun.","Mar.","Mer.","Jeu.","Ven.","Sam."];
function meteo(c){
  if(c==0) return ["☀️","Grand soleil"];
  if(c<=2) return ["🌤️","Plutôt beau"];
  if(c==3) return ["☁️","Gris"];
  if(c==45||c==48) return ["🌫️","Brouillard"];
  if(c>=51&&c<=57) return ["🌦️","Bruine"];
  if(c==80) return ["🌦️","Averses"];
  if(c==61) return ["🌦️","Petite pluie"];
  if(c==81) return ["🌧️","Averses"];
  if(c==63) return ["🌧️","Pluie"];
  if(c==82) return ["🌧️","Fortes averses"];
  if(c==65||c==66||c==67) return ["🌧️","Forte pluie"];
  if(c>=71&&c<=77||c==85||c==86) return ["❄️","Neige"];
  if(c>=95) return ["⛈️","Orage"];
  return ["❓","Inconnu"];
}
const r1=x=>Math.round(x);

// Icônes météo dessinées (dégradés définis une seule fois dans DEFS_ICONES)
const DEFS_ICONES=`<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
<radialGradient id="gSoleil" cx="40%" cy="35%" r="65%"><stop offset="0" stop-color="#fff6b0"/><stop offset=".55" stop-color="#ffd21f"/><stop offset="1" stop-color="#f29d00"/></radialGradient>
<linearGradient id="gNuageClair" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#c9d3dc"/></linearGradient>
<linearGradient id="gNuageGris" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a3aab1"/><stop offset="1" stop-color="#5a6269"/></linearGradient>
<linearGradient id="gNuageSombre" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9aa2aa"/><stop offset="1" stop-color="#4f5860"/></linearGradient>
<radialGradient id="gLune" cx="35%" cy="35%" r="70%"><stop offset="0" stop-color="#fffbe6"/><stop offset="1" stop-color="#d9cf9e"/></radialGradient>
</defs></svg>`;
function icone(code,heure){
  const nuit=heure<7||heure>=19;
  const soleil=(x,y,r)=>`<g stroke="#c96a00" stroke-width="2.2" stroke-linecap="round">${[0,45,90,135,180,225,270,315].map(a=>{const c=Math.cos(a*Math.PI/180),s=Math.sin(a*Math.PI/180);return `<line x1="${x+c*(r+2)}" y1="${y+s*(r+2)}" x2="${x+c*(r+5)}" y2="${y+s*(r+5)}"/>`}).join("")}</g><circle cx="${x}" cy="${y}" r="${r}" fill="url(#gSoleil)" stroke="#8a4b00" stroke-width="1.2"/>`;
  const lune=(x,y,r)=>`<path d="M${x+r*.3} ${y-r} a${r} ${r} 0 1 0 ${r*.75} ${r*1.55} a${r*.8} ${r*.8} 0 1 1 ${-r*.75} ${-r*1.55}z" fill="url(#gLune)" stroke="#5c5427" stroke-width="1.2"/>`;
  const astre=(x,y,r)=>nuit?lune(x,y,r*1.15):soleil(x,y,r);
  // nuage : 3 bosses + base plate, ombre douce dessous
  const nuage=(dx,dy,sc,g)=>`<g transform="translate(${dx} ${dy}) scale(${sc})"><path d="M7 21 h19 a5 5 0 0 0 .6-9.96 A7.5 7.5 0 0 0 12.4 9.3 A5.2 5.2 0 0 0 7 21z" fill="#000" opacity=".12" transform="translate(.8 1.2)"/><path d="M7 21 h19 a5 5 0 0 0 .6-9.96 A7.5 7.5 0 0 0 12.4 9.3 A5.2 5.2 0 0 0 7 21z" fill="url(#${g})" stroke="#1f262c" stroke-width="1.4"/></g>`;
  const gouttes=(n,y0)=>Array.from({length:n},(_,k)=>{const x=11+k*(16/Math.max(1,n-1||1));return `<line x1="${x+1.5}" y1="${y0}" x2="${x-1}" y2="${y0+5}" stroke="#003c9e" stroke-width="2.4" stroke-linecap="round"/>`}).join("");
  const flocons=y0=>[11,18,25].map(x=>`<g stroke="#1d5fb0" stroke-width="1.5" stroke-linecap="round"><line x1="${x-2}" y1="${y0}" x2="${x+2}" y2="${y0}"/><line x1="${x}" y1="${y0-2}" x2="${x}" y2="${y0+2}"/><line x1="${x-1.5}" y1="${y0-1.5}" x2="${x+1.5}" y2="${y0+1.5}"/><line x1="${x-1.5}" y1="${y0+1.5}" x2="${x+1.5}" y2="${y0-1.5}"/></g>`).join("");
  const eclair=`<path d="M19 19 l-4 6 h3.2 l-2.2 5 6.5-7.2 h-3.4 l2.4-3.8z" fill="#ffd21f" stroke="#5c3a00" stroke-width="1"/>`;
  let d;
  if(code==0) d=astre(18,15,7);
  else if(code==1) d=astre(16,13,8)+nuage(15,11,.55,"gNuageClair");
  else if(code==2) d=astre(14,12,7.5)+nuage(10,7,.72,"gNuageClair");
  else if(code==3) d=nuage(-1,-4,.8,"gNuageClair")+nuage(4,1,.95,"gNuageGris");
  else if(code==45||code==48) d=nuage(1,-3,.95,"gNuageGris")+`<g stroke="#4a535b" stroke-width="2.2" stroke-linecap="round"><line x1="5" y1="22" x2="31" y2="22"/><line x1="8" y1="26" x2="28" y2="26"/></g>`;
  else if(code>=51&&code<=57) d=nuage(1,-3,1,"gNuageGris")+gouttes(2,21);
  else if(code==61) d=nuage(1,-3,1,"gNuageGris")+gouttes(2,21);
  else if(code==63) d=nuage(1,-3,1,"gNuageGris")+gouttes(3,21);
  else if(code==65||code==66||code==67) d=nuage(1,-3,1,"gNuageSombre")+gouttes(4,21);
  else if(code==80) d=astre(11,9,6)+nuage(3,-1,.95,"gNuageClair")+gouttes(2,22);
  else if(code==81) d=astre(11,9,6)+nuage(3,-1,.95,"gNuageGris")+gouttes(3,22);
  else if(code==82) d=astre(11,9,6)+nuage(3,-1,.95,"gNuageSombre")+gouttes(4,22);
  else if((code>=71&&code<=77)||code==85||code==86) d=nuage(1,-3,1,"gNuageGris")+flocons(24);
  else if(code>=95) d=nuage(1,-4,1,"gNuageSombre")+gouttes(2,21).replace(/x1="(\d)/,'x1="$1')+eclair;
  else d=nuage(1,0,1,"gNuageGris");
  const nom=meteo(code)[1];
  return `<svg width="34" height="28" viewBox="0 0 36 30" role="img" aria-label="${nom}"><title>${nom}</title>${d}</svg>`;
}

const SOURCES=[["meteociel","Meteociel"],["meteofrance","Météo-France"],["agricole","Météo Agricole"],["languedoc","Météo Languedoc"]];

// ---------- Moyenne des 4 météos ----------
// pluie sans mm (Météo-France, Météo Languedoc) : quantité approchée sur 3h
const MM_NIVEAU={"sec":0,"faible":0.5,"modérée":2,"forte":5,"orage":5,"neige":1};
// familles de ciel, de la plus calme à la plus forte ; on garde la plus votée (à égalité : la plus forte, par prudence)
function familleCiel(c){
  if(c==0) return 0; if(c<=2) return 1; if(c==3) return 2; if(c==45||c==48) return 3;
  if(c==51||c==61||c==80) return 4; if(c==63||c==81) return 5; if(c==65||c==82||c==66||c==67) return 6;
  if(c>=71&&c<=86) return 7; if(c>=95) return 8; return 2;
}
const CODE_FAMILLE=[0,2,3,45,61,63,65,71,95];
function moyenneLignes(D,liste){
  const parHeure={};
  for(const [id] of (liste||SOURCES)){
    for(const l of ((D.sources[id]||{}).lignes||[])){
      (parHeure[l.t]=parHeure[l.t]||[]).push({id,...l});
    }
  }
  const lignes=[];
  for(const t of Object.keys(parHeure).sort()){
    const L=parHeure[t].filter(x=>x.temp!=null);
    if(L.length<2) continue;                       // au moins 2 sites
    const moy=a=>{const v=a.filter(x=>x!=null&&!isNaN(x)); return v.length?v.reduce((s,x)=>s+x,0)/v.length:null;};
    const temps=L.map(x=>x.temp);
    const pluies=L.map(x=>x.pluie!=null?x.pluie:(MM_NIVEAU[x.pluie_txt]??null));
    const rafs=L.map(x=>x.raf!=null?x.raf:(x.moy!=null?x.moy*1.5:null));
    // direction : moyenne sur le cercle
    const dirs=L.map(x=>x.dir).filter(x=>x!=null);
    let dir=null;
    if(dirs.length){const sx=dirs.reduce((s,d)=>s+Math.sin(d*Math.PI/180),0), cx=dirs.reduce((s,d)=>s+Math.cos(d*Math.PI/180),0); dir=(Math.atan2(sx,cx)*180/Math.PI+360)%360;}
    // ciel le plus voté
    const votes={}; L.forEach(x=>{const f=familleCiel(x.code); votes[f]=(votes[f]||0)+1;});
    const fam=Object.keys(votes).map(Number).sort((a,b)=>votes[b]-votes[a]||b-a)[0];
    // accord entre les sites
    const ecartT=Math.max(...temps)-Math.min(...temps);
    const pv=pluies.filter(x=>x!=null), pleut=pv.filter(x=>x>=0.3).length, sec=pv.length-pleut;
    const desaccordPluie=Math.min(pleut,sec);     // nombre de sites qui disent le contraire de la majorité
    const accord= ecartT<=3&&desaccordPluie==0 ? "oui" : ecartT<=5&&desaccordPluie<=1 ? "plutôt" : "non";
    lignes.push({t,temp:moy(temps),moy:moy(L.map(x=>x.moy)),raf:moy(rafs),pluie:moy(pluies),dir,code:CODE_FAMILLE[fam],
      n:L.length,accord,detail:`Températures : ${temps.map(Math.round).join(" / ")} °C · ${pleut} météo(s) annoncent de la pluie, ${sec} du sec`});
  }
  return lignes;
}

// Couleurs reprises du code de Meteociel (valeurs brutes, pas arrondies)
function couleurTemp(t){
  const pal=[[-99,"#CC99FF"],[-3,"#9999FF"],[-1,"#99CCFF"],[1,"#66FFFF"],[3,"#66FF99"],[5,"#66FF66"],[7,"#66FF00"],[9,"#BFFA0E"],[11,"#FFFF09"],[13,"#FFD700"],[15,"#FFB000"],[17,"#FF9900"],[20,"#FF6600"],[25,"#FF3300"],[30,"#CC0000"]];
  let c=pal[0][1]; for(const [s,col] of pal) if(t>=s) c=col; return c;
}
function couleurMoy(v){v=v??0;
  if(v<2.5) return "#FFFFFF"; if(v<7.5) return "#97E6FF"; if(v<12.5) return "#33CCFF"; if(v<20) return "#0099FF"; if(v<30) return "#00FF99"; if(v<40) return "#FFFF09"; return "#FF9900";}
function couleurRaf(v){v=v??0;
  if(v<2.5) return "#FFFFFF"; if(v<10) return "#97E6FF"; if(v<22.5) return "#33CCFF"; if(v<32.5) return "#0099FF"; if(v<45) return "#00FF99"; if(v<60) return "#FFFF09"; return "#FF9900";}
function couleurPluie(mm){
  if(mm<0.2) return null; if(mm<1) return "#aaffff"; if(mm<2) return "#88d8d8"; if(mm<3.5) return "#55cccc"; return "#0050aa";}
function couleurHum(h){
  if(h<50) return "#aaaab0"; if(h<65) return "#a0a0a0"; if(h<75) return "#959595"; if(h<85) return "#909090"; if(h<95) return "#858585"; return "#808080";}
const texteSur=c=>["#0050aa","#CC0000"].includes(c)?"#ffffff":"#000066";
function fleche(dir){ // flèche noire, 16 directions comme Meteociel, pointe là où va le vent
  const a=Math.round((dir??0)/22.5)*22.5;
  return `<svg width="18" height="18" viewBox="0 0 18 18" style="transform:rotate(${a}deg)"><path d="M9 17 L3.5 10.5 H7 V1 H11 V10.5 H14.5 Z" fill="#000"/></svg>`;
}
const COULEUR_ACCORD={"oui":"#66FF66","plutôt":"#FFFF09","non":"#FF9900"};
function tableMoyenne(L,total){
  const parJour={}; L.forEach(l=>{const j=l.t.slice(0,10); parJour[j]=(parJour[j]||0)+1;});
  const v5r=x=>x==null?"--":Math.round(x/5)*5;
  let c=`<table class="mc"><thead><tr class="tete"><td rowspan="2">Jour</td><td rowspan="2">Heure</td><td rowspan="2">Temp.</td><td colspan="3">Vent km/h</td><td rowspan="2">Pluie<br>sur 3h</td><td rowspan="2">Temps</td><td rowspan="2">D'accord ?</td><td rowspan="2" title="Nombre de sites qui prévoient cette heure">Sites</td></tr>
    <tr class="tete"><td>dir.</td><td>moy.</td><td>raf.</td></tr></thead><tbody>`;
  let prec="", n=-1;
  L.forEach(x=>{
    const t=new Date(x.t), j=x.t.slice(0,10), nouveau=j!==prec; prec=j; if(nouveau) n++;
    const ct=couleurTemp(x.temp), cm=couleurMoy(x.moy), cr=couleurRaf(x.raf), cp=x.pluie==null?null:couleurPluie(x.pluie);
    c+=`<tr style="background:${n%2?"#DDEEFF":"#CCFFFF"}">`;
    if(nouveau) c+=`<td class="jour" rowspan="${parJour[j]}"><span>${JOURS[t.getDay()].replace(".","")}<br>${t.getDate()}</span></td>`;
    c+=`<td>${String(t.getHours()).padStart(2,"0")}:00</td>`+
      `<td class="c" style="background:${ct};color:${texteSur(ct)}">${Math.round(x.temp)} °C</td>`+
      (x.dir==null?`<td class="c">--</td>`:`<td class="c dir" style="background:${cm}">${fleche(x.dir)}</td>`)+
      `<td class="c" style="background:${x.moy==null?"transparent":cm}">${v5r(x.moy)}</td>`+
      `<td class="c" style="background:${x.raf==null?"transparent":cr}">${v5r(x.raf)}</td>`+
      (cp?`<td class="c" style="background:${cp};color:${texteSur(cp)}">${x.pluie.toFixed(1)} mm</td>`:`<td class="c">--</td>`)+
      `<td class="ico">${icone(x.code,t.getHours())}</td>`+
      `<td class="c" style="background:${COULEUR_ACCORD[x.accord]};font-weight:bold" title="${x.detail}">${x.accord}</td>`+
      `<td class="c">${x.n}/${total}</td></tr>`;
  });
  return c+`</tbody></table>`;
}
