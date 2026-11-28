// Menu de gauche : un bouton pour le fermer sur le côté ou l'ouvrir. Le choix est gardé.
(function(){
  const nav=document.querySelector(".cote"), html=document.documentElement;
  if(!nav) return;
  localStorage.removeItem("menuLargeur"); localStorage.removeItem("menuReduit");   // anciens réglages
  if(localStorage.getItem("menuFerme")==="1") html.classList.add("menu-ferme");
  const bouton=document.createElement("button");
  bouton.type="button"; bouton.className="plier";
  const maj=()=>{const f=html.classList.contains("menu-ferme"); bouton.textContent=f?"»":"«"; bouton.title=f?"Ouvrir le menu":"Fermer le menu"; bouton.setAttribute("aria-label",bouton.title);};
  bouton.onclick=()=>{html.classList.toggle("menu-ferme"); localStorage.setItem("menuFerme",html.classList.contains("menu-ferme")?"1":"0"); maj(); window.dispatchEvent(new Event("resize"));};
  maj(); nav.prepend(bouton);
})();
