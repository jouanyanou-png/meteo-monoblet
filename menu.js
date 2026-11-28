// Menu de gauche : bouton « réduire / agrandir » + poignée pour choisir la largeur. Le choix est gardé.
(function(){
  const nav=document.querySelector(".cote"), html=document.documentElement;
  if(!nav) return;
  const MIN=180, MAX=420;
  const larg=+localStorage.getItem("menuLargeur");
  if(larg>=MIN&&larg<=MAX) html.style.setProperty("--larg-menu",larg+"px");
  if(localStorage.getItem("menuReduit")==="1") html.classList.add("menu-reduit");

  const bouton=document.createElement("button");
  bouton.type="button"; bouton.className="plier";
  const maj=()=>{const r=html.classList.contains("menu-reduit"); bouton.textContent=r?"»":"«"; bouton.title=r?"Agrandir le menu":"Réduire le menu"; bouton.setAttribute("aria-label",bouton.title);};
  bouton.onclick=()=>{html.classList.toggle("menu-reduit"); localStorage.setItem("menuReduit",html.classList.contains("menu-reduit")?"1":"0"); maj(); window.dispatchEvent(new Event("resize"));};
  maj(); nav.prepend(bouton);

  const poignee=document.createElement("div");
  poignee.className="poignee"; poignee.title="Glisser pour élargir ou rétrécir le menu";
  nav.appendChild(poignee);
  poignee.addEventListener("pointerdown",e=>{
    e.preventDefault(); poignee.setPointerCapture(e.pointerId); poignee.classList.add("tire");
    const bouge=ev=>{const l=Math.max(MIN,Math.min(MAX,ev.clientX)); html.style.setProperty("--larg-menu",l+"px");};
    const fin=ev=>{poignee.classList.remove("tire"); poignee.removeEventListener("pointermove",bouge); poignee.removeEventListener("pointerup",fin);
      localStorage.setItem("menuLargeur",parseInt(getComputedStyle(html).getPropertyValue("--larg-menu"))||250); window.dispatchEvent(new Event("resize"));};
    poignee.addEventListener("pointermove",bouge); poignee.addEventListener("pointerup",fin);
  });
  poignee.addEventListener("dblclick",()=>{html.style.removeProperty("--larg-menu"); localStorage.removeItem("menuLargeur");});
})();
