#!/usr/bin/env python3
# Assemble la section Shopify sections/mc-piece-3d.liquid à partir du dessin (scene.py).
import pathlib, re
import scene

ICI = pathlib.Path(__file__).parent
SORTIE = ICI.parent / 'mc-piece-3d.liquid'


def mix(a, b, t):
    """Mélange de deux couleurs hexadécimales (t = part de a)."""
    ca = [int(a[i:i + 2], 16) for i in (1, 3, 5)]
    cb = [int(b[i:i + 2], 16) for i in (1, 3, 5)]
    return '#' + ''.join(f'{round(x * t + y * (1 - t)):02x}' for x, y in zip(ca, cb))


EXPRESSO, CREME, BLANC = '#332817', '#eee4d3', '#ffffff'


def palette(fond, encre, laiton, clair):
    return {
        'fond': fond, 'encre': encre, 'laiton': laiton,
        'doux': mix(encre, fond, .74), 'filet': mix(encre, fond, .2),
        'sol': mix(encre, fond, .07), 'mur-a': mix(encre, fond, .035), 'mur-b': mix(encre, fond, .1),
        'cote': mix(encre, fond, .12) if not clair else mix(encre, fond, .09),
        'dessus': mix(encre, fond, .22) if not clair else mix(BLANC, fond, .55),
        'tapis': mix(laiton, fond, .22), 'vitre': mix(encre, fond, .16) if not clair else mix(BLANC, fond, .6),
        'survol': mix(BLANC, encre, .35) if not clair else mix('#000000', encre, .25),
    }


SOMBRE = palette(EXPRESSO, CREME, '#c9a46a', False)
CLAIR = palette(CREME, EXPRESSO, '#8a6534', True)


def variables(p):
    return ';'.join(f'--mcv-{k}:{v}' for k, v in p.items())


CSS = r'''
.mcv{@@SOMBRE@@;--mcv-ease:cubic-bezier(.65,0,.35,1)}
.mcv--creme{@@CLAIR@@}
.mcv__bande{background:var(--mcv-fond);color:var(--mcv-encre);border-radius:16px;padding:clamp(40px,6vw,84px) clamp(20px,5vw,76px);overflow:hidden}
.mcv__bande--plein{border-radius:0}
.mcv__grille{display:grid;row-gap:30px;align-items:center}
.mcv .mcv__titre{font-family:var(--heading-font,Georgia,serif);font-weight:400;font-size:clamp(30px,3vw,44px);line-height:1.14;letter-spacing:-.015em;color:var(--mcv-encre);text-transform:none;margin:0 0 18px;max-width:20ch}
.mcv__intro{font-family:var(--body-font,Georgia,serif);font-size:15px;line-height:1.75;color:var(--mcv-doux);max-width:44ch}
.mcv__intro p{margin:0}
.mcv .mcv__etapes{list-style:none;margin:0;padding:0;max-width:440px}
.mcv .mcv__etape{display:grid;grid-template-columns:28px 1fr;column-gap:16px;margin:0;padding:15px 0;border-top:1px solid var(--mcv-filet);transition:opacity .5s ease}
.mcv__etape:last-child{border-bottom:1px solid var(--mcv-filet)}
.mcv__num{width:26px;height:26px;border-radius:50%;border:1px solid var(--mcv-laiton);color:var(--mcv-laiton);display:grid;place-items:center;font:12px/1 var(--body-font,Georgia,serif);transition:background-color .4s ease,color .4s ease}
.mcv .mcv__etape-titre{margin:2px 0 0;font:400 16px/1.35 var(--heading-font,Georgia,serif);color:var(--mcv-encre)}
.mcv .mcv__etape-texte{margin:4px 0 0;font:13.5px/1.6 var(--body-font,Georgia,serif);color:var(--mcv-doux)}
.mcv__action{display:flex;flex-wrap:wrap;align-items:center;gap:14px 22px}
.mcv .mcv__bouton{display:inline-flex;align-items:center;justify-content:center;min-height:50px;padding:14px 30px;border-radius:999px;background:var(--mcv-encre);color:var(--mcv-fond);font:15px/1.2 var(--btn-font,var(--body-font,Georgia,serif));text-decoration:none;transition:transform .25s ease,background-color .25s ease}
.mcv .mcv__bouton:hover{transform:translateY(-2px);background:var(--mcv-survol);color:var(--mcv-fond)}
.mcv .mcv__bouton:focus-visible,.mcv .mcv__etiq:focus-visible,.mcv .mcv__rejouer:focus-visible{outline:2px solid var(--mcv-laiton);outline-offset:3px}
.mcv .mcv__note{margin:0;font:13px/1.55 var(--body-font,Georgia,serif);color:var(--mcv-doux);max-width:30ch}
.mcv .mcv__dessin{margin:0;min-width:0}
.mcv__scene{position:relative;aspect-ratio:@@RATIO@@;container-type:inline-size}
.mcv .mcv__svg{display:block;width:100%;height:100%;overflow:visible}
.mcv .mcv__svg{--mcv-k:1}
.mcv__svg path,.mcv__svg circle{stroke-linejoin:round;stroke-linecap:round}
.mcv__l{fill:none;stroke:var(--mcv-encre);stroke-width:calc(1.25px * var(--mcv-k))}
.mcv__lf{fill:none;stroke:var(--mcv-encre);stroke-width:calc(.8px * var(--mcv-k));stroke-opacity:.5}
.mcv__lame{stroke-opacity:.22}
.mcv__svg .mcv__cote{stroke:var(--mcv-laiton);stroke-opacity:1}
.mcv__sol{fill:var(--mcv-sol)}
.mcv__mur-a{fill:var(--mcv-mur-a)}
.mcv__mur-b{fill:var(--mcv-mur-b)}
.mcv__poche{fill:var(--mcv-encre)}
.mcv__baie{fill:var(--mcv-fond)}
.mcv__vitre{fill:var(--mcv-vitre)}
.mcv__c{fill:var(--mcv-cote);stroke:var(--mcv-encre);stroke-width:calc(1.05px * var(--mcv-k))}
.mcv__d{fill:var(--mcv-dessus);stroke:var(--mcv-encre);stroke-width:calc(1.05px * var(--mcv-k))}
.mcv__tapis{fill:var(--mcv-tapis);stroke:var(--mcv-encre);stroke-width:calc(.8px * var(--mcv-k));stroke-opacity:.55}
.mcv__fil{fill:none;stroke:var(--mcv-laiton);stroke-width:calc(.9px * var(--mcv-k))}
.mcv__point{fill:var(--mcv-laiton)}
.mcv__cotes-plan .mcv__cote-texte{opacity:0}
.mcv__cote-texte{fill:var(--mcv-laiton);font-family:var(--body-font,Georgia,serif);font-size:12px;letter-spacing:.05em;text-anchor:middle;dominant-baseline:middle}
.mcv__etiq{position:absolute;display:flex;flex-direction:column;gap:2px;padding:3px 6px;border-radius:4px;background:var(--mcv-fond);color:var(--mcv-encre);text-decoration:none;white-space:nowrap;line-height:1.2;font-size:clamp(11px,2.3cqi,14px);transform:translate(0,-50%)}
.mcv__etiq--g{transform:translate(-100%,-50%);text-align:right;align-items:flex-end}
.mcv__nom{font-family:var(--heading-font,Georgia,serif);font-style:italic}
.mcv__prix{font-family:var(--body-font,Georgia,serif);font-size:max(10px,.84em);color:var(--mcv-doux);font-variant-numeric:tabular-nums}
.mcv a.mcv__etiq{color:var(--mcv-encre)}
.mcv a.mcv__etiq:hover .mcv__nom{text-decoration:underline;text-underline-offset:3px}
.mcv__pied{display:flex;justify-content:flex-end;min-height:32px}
.mcv .mcv__rejouer{display:none;align-items:center;gap:7px;width:auto;min-height:0;margin:0;padding:6px 4px;border:0;border-radius:0;box-shadow:none;background:none;text-transform:none;letter-spacing:0;color:var(--mcv-doux);font:12.5px/1 var(--body-font,Georgia,serif);cursor:pointer}
.mcv .mcv__rejouer:hover{color:var(--mcv-encre)}
.mcv__rejouer svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.4}
.mcv__masque{position:absolute!important;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@container (max-width:600px){.mcv .mcv__svg{--mcv-k:1.25}.mcv__cote-texte{font-size:16px}}
@container (max-width:440px){.mcv .mcv__svg{--mcv-k:1.6}.mcv__cote-texte{font-size:19px}}
@media (min-width:990px){
.mcv__grille{grid-template-columns:minmax(0,5fr) minmax(0,7fr);grid-template-rows:1fr auto auto auto 1fr;column-gap:clamp(40px,5vw,88px);row-gap:30px;grid-template-areas:". dessin" "tete dessin" "etapes dessin" "action dessin" ". dessin"}
.mcv--gauche .mcv__grille{grid-template-columns:minmax(0,7fr) minmax(0,5fr);grid-template-areas:"dessin ." "dessin tete" "dessin etapes" "dessin action" "dessin ."}
.mcv__tete{grid-area:tete}.mcv .mcv__dessin{grid-area:dessin}.mcv .mcv__etapes{grid-area:etapes}.mcv__action{grid-area:action}
}
/* animation : jouée une fois quand le dessin arrive à l'écran (classes posées par le script) */
.mcv--anime .mcv__t{stroke-dasharray:1 1;stroke-dashoffset:1}
.mcv--anime .mcv__f,.mcv--anime .mcv__cote-texte,.mcv--anime .mcv__point{opacity:0}
.mcv--anime .mcv__plan{transform:translateY(@@PLAN_DY@@px) rotate(-45deg) scale(@@PLAN_S@@,@@PLAN_S2@@)}
.mcv--anime .mcv__meuble{opacity:0;transform:translateY(-22px)}
.mcv--anime .mcv__deco{opacity:0}
.mcv--anime .mcv__etiq{opacity:0;translate:0 6px}
.mcv--anime .mcv__etape{opacity:.38}
.mcv--anime.is-p1 .mcv__plan .mcv__t{stroke-dashoffset:0;transition:stroke-dashoffset .9s var(--mcv-ease) var(--d,0ms)}
.mcv--anime.is-p1 .mcv__plan .mcv__f{opacity:1;transition:opacity .6s ease var(--d,0ms)}
.mcv--anime.is-p1 .mcv__cotes-plan .mcv__cote-texte{opacity:1;transition:opacity .5s ease .95s}
.mcv--anime.is-p2 .mcv__plan{transform:none;transition:transform 1.15s var(--mcv-ease)}
.mcv--anime.is-p2 .mcv__cotes-plan .mcv__cote-texte{opacity:0;transition:opacity .2s ease}
.mcv--anime.is-p2 .mcv__cotes-iso .mcv__cote-texte{opacity:1;transition:opacity .5s ease 1.05s}
.mcv--anime .mcv__mur{opacity:0}
.mcv--anime .mcv__mur--g{transform:skewY(-26.565deg) scaleY(.002)}
.mcv--anime .mcv__mur--d{transform:skewY(26.565deg) scaleY(.002)}
.mcv--anime.is-p2 .mcv__mur{opacity:1;transform:none;transition:opacity .15s ease 1s,transform .95s cubic-bezier(.22,.8,.3,1) 1s}
.mcv--anime.is-p2 .mcv__mur--g{transition-delay:1.15s}
.mcv--anime.is-p3 .mcv__meuble{opacity:1;transform:none;transition:opacity .4s ease var(--d,0ms),transform .7s cubic-bezier(.3,1.35,.55,1) var(--d,0ms)}
.mcv--anime.is-p3 .mcv__deco{opacity:1;transition:opacity .7s ease var(--d,0ms)}
.mcv--anime.is-p3 .mcv__repere .mcv__t{stroke-dashoffset:0;transition:stroke-dashoffset .5s var(--mcv-ease) var(--d,0ms)}
.mcv--anime.is-p3 .mcv__point{opacity:1;transition:opacity .3s ease var(--d,0ms)}
.mcv--anime.is-p3 .mcv__etiq{opacity:1;translate:0 0;transition:opacity .4s ease calc(var(--d,0ms) + 350ms),translate .4s ease calc(var(--d,0ms) + 350ms)}
.mcv--anime[data-etape="1"] .mcv__etape:nth-child(1),.mcv--anime[data-etape="2"] .mcv__etape:nth-child(-n+2),.mcv--anime[data-etape="3"] .mcv__etape,.mcv--anime[data-etape="fin"] .mcv__etape{opacity:1}
.mcv--anime[data-etape="1"] .mcv__etape:nth-child(1) .mcv__num,.mcv--anime[data-etape="2"] .mcv__etape:nth-child(2) .mcv__num,.mcv--anime[data-etape="3"] .mcv__etape:nth-child(3) .mcv__num{background:var(--mcv-laiton);color:var(--mcv-fond)}
.mcv--anime.is-fin .mcv__rejouer{display:inline-flex;animation:mcv-apparait .5s ease both}
@keyframes mcv-apparait{from{opacity:0}to{opacity:1}}
'''

JS = r'''
(function () {
  if (window.mcvChezVous) { window.mcvChezVous(); return; }
  var PHASES = [['p1', 0, '1'], ['p2', 1800, '2'], ['p3', 3500, '3'], ['fin', 5800, 'fin']];
  function jouer(el) {
    (el.mcvMinuteurs || []).forEach(clearTimeout);
    el.classList.remove('is-p1', 'is-p2', 'is-p3', 'is-fin');
    el.removeAttribute('data-etape');
    void el.offsetWidth;
    el.mcvMinuteurs = PHASES.map(function (p) {
      return setTimeout(function () { el.classList.add('is-' + p[0]); el.setAttribute('data-etape', p[2]); }, p[1]);
    });
  }
  function preparer(el) {
    if (el.mcvPret) return;
    el.mcvPret = true;
    var reduit = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var scene = el.querySelector('.mcv__scene');
    if (reduit || !scene || !('IntersectionObserver' in window)) return;
    el.classList.add('mcv--anime');
    el.mcvJouer = function () { jouer(el); };
    var io = new IntersectionObserver(function (entrees) {
      if (entrees.some(function (e) { return e.isIntersecting; })) { io.disconnect(); jouer(el); }
    }, { threshold: 0.45 });
    io.observe(scene);
    var b = el.querySelector('.mcv__rejouer');
    if (b) b.addEventListener('click', el.mcvJouer);
  }
  window.mcvChezVous = function () { document.querySelectorAll('[data-mcv]').forEach(preparer); };
  window.mcvChezVous();
  document.addEventListener('shopify:section:load', window.mcvChezVous);
  document.addEventListener('shopify:section:select', function (e) {
    var el = e.target && e.target.querySelector && e.target.querySelector('[data-mcv]');
    if (el && el.mcvJouer) el.mcvJouer();
  });
})();
'''

ETIQ = r'''{%- liquid
  assign produit = st.produit_@@CLE@@
  assign nom = st.nom_@@CLE@@
  if nom == blank and produit != blank
    assign nom = produit.title
  endif
-%}
{%- if nom != blank -%}
  {%- if produit != blank -%}<a href="{{ produit.url }}"{%- else -%}<span{%- endif %} class="mcv__etiq mcv__etiq--@@COTE@@" style="left:@@X@@%;top:@@Y@@%;--d:@@D@@ms">
    <span class="mcv__nom">{{ nom | escape }}</span>
    {%- if produit != blank and st.prix -%}
      <span class="mcv__prix">{% if produit.price_varies %}{{ st.des | escape }} {% endif %}{{ produit.price | money }}</span>
    {%- endif -%}
  {%- if produit != blank -%}</a>{%- else -%}</span>{%- endif -%}
{%- endif -%}
'''

GABARIT = r'''{%- comment -%}
  Maison Corleone · « Chez vous » : la pièce en 3D, meublée avec les pièces de la boutique.
  Section légère : dessin SVG et transitions CSS, sans librairie ni image (environ 13 Ko compressés).
  Le plan se dessine, passe en 3D, puis les meubles se posent ; l'animation se joue une fois,
  quand le dessin arrive à l'écran. Dessin fixe si le visiteur a réduit les animations.
{%- endcomment -%}
{%- liquid
  assign st = section.settings
  assign lien = st.lien
  if lien == blank
    assign langue = request.locale.iso_code | slice: 0, 2
    if langue == 'en'
      assign lien = 'https://realroom-sepia.vercel.app/en/maison-corleone'
    else
      assign lien = 'https://realroom-sepia.vercel.app/fr/maison-corleone'
    endif
  endif
  assign espacement = ''
  if st.reset_spacing
    assign espacement = ' remove_spacing'
  endif
-%}
<style>@@CSS@@</style>
<div
  class="section{% if st.padding_top < 30 %} pt-min{% endif %}{% if st.padding_bottom < 30 %} pb-min{% endif %} mcv mcv--{{ st.ambiance }} mcv--{{ st.position }}{{ espacement }}"
  style="--section-pt: {{ st.padding_top }}; --section-pb: {{ st.padding_bottom }};"
  data-mcv
>
  <div class="{{ st.section_width }}">
    <div class="mcv__bande{% if st.section_width == 'full_width' %} mcv__bande--plein{% endif %}">
      <div class="mcv__grille">
        <div class="mcv__tete">
          {%- if st.titre != blank -%}<h2 class="mcv__titre">{{ st.titre | escape }}</h2>{%- endif -%}
          {%- if st.texte != blank -%}<div class="mcv__intro">{{ st.texte }}</div>{%- endif -%}
        </div>
        <figure class="mcv__dessin">
          <div class="mcv__scene">
            @@SVG@@
            @@ETIQUETTES@@
          </div>
          <figcaption class="mcv__masque">{{ st.description | escape }}</figcaption>
          <div class="mcv__pied">
            <button type="button" class="mcv__rejouer"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 8a5.5 5.5 0 1 0 1.7-4M2.5 2.5v3h3"/></svg>{{ st.rejouer | escape }}</button>
          </div>
        </figure>
        <ol class="mcv__etapes">
          {%- for i in (1..3) -%}
            {%- liquid
              assign cle_titre = 'etape_' | append: i
              assign cle_texte = 'etape_' | append: i | append: '_texte'
            -%}
            <li class="mcv__etape">
              <span class="mcv__num" aria-hidden="true">{{ i }}</span>
              <div>
                <p class="mcv__etape-titre">{{ st[cle_titre] | escape }}</p>
                {%- if st[cle_texte] != blank -%}<p class="mcv__etape-texte">{{ st[cle_texte] | escape }}</p>{%- endif -%}
              </div>
            </li>
          {%- endfor -%}
        </ol>
        <div class="mcv__action">
          {%- if st.bouton != blank -%}<a class="mcv__bouton" href="{{ lien }}">{{ st.bouton | escape }}</a>{%- endif -%}
          {%- if st.note != blank -%}<p class="mcv__note">{{ st.note | escape }}</p>{%- endif -%}
        </div>
      </div>
    </div>
  </div>
</div>
<script>@@JS@@</script>

{% schema %}
{
  "name": "Pièce en 3D (Chez vous)",
  "tag": "section",
  "class": "mcv-section",
  "disabled_on": { "groups": ["header", "footer", "custom.overlay"] },
  "settings": [
    { "type": "header", "content": "Textes" },
    { "type": "text", "id": "titre", "label": "Titre", "default": "Essayez nos meubles chez vous, en 3D" },
    { "type": "richtext", "id": "texte", "label": "Texte", "default": "<p>Photographiez une pièce de votre intérieur : nous la reconstruisons en 3D, à ses vraies dimensions, et la meublons avec les pièces Maison Corleone.</p>" },
    { "type": "text", "id": "etape_1", "label": "Étape 1", "default": "Le plan de votre pièce" },
    { "type": "text", "id": "etape_1_texte", "label": "Étape 1 : détail", "default": "Quelques photos suffisent : murs, fenêtres et dimensions sont relevés." },
    { "type": "text", "id": "etape_2", "label": "Étape 2", "default": "Votre pièce en 3D" },
    { "type": "text", "id": "etape_2_texte", "label": "Étape 2 : détail", "default": "Elle prend forme à ses vraies mesures. Tournez autour, de jour comme de nuit." },
    { "type": "text", "id": "etape_3", "label": "Étape 3", "default": "Meublée Maison Corleone" },
    { "type": "text", "id": "etape_3_texte", "label": "Étape 3 : détail", "default": "Nos pièces s’y installent : déplacez-les, échangez-les, puis voyez le rendu en photo réaliste." },
    { "type": "text", "id": "bouton", "label": "Bouton", "default": "Modéliser ma pièce" },
    { "type": "url", "id": "lien", "label": "Lien du bouton", "info": "Laissez vide pour ouvrir « Chez vous » (en français, ou en anglais si la boutique est affichée en anglais)." },
    { "type": "text", "id": "note", "label": "Note sous le bouton", "default": "Offert avec votre compte client, deux rendus photo réalistes compris." },
    { "type": "header", "content": "Pièces du dessin", "info": "Choisissez un produit pour afficher son prix et ouvrir sa fiche au clic." },
    { "type": "product", "id": "produit_canape", "label": "Canapé" },
    { "type": "text", "id": "nom_canape", "label": "Nom du canapé", "default": "Bouclé Noyer" },
    { "type": "product", "id": "produit_table", "label": "Table" },
    { "type": "text", "id": "nom_table", "label": "Nom de la table", "default": "Nordic" },
    { "type": "product", "id": "produit_fauteuil", "label": "Fauteuil" },
    { "type": "text", "id": "nom_fauteuil", "label": "Nom du fauteuil", "default": "Terracotta" },
    { "type": "product", "id": "produit_lampe", "label": "Lampadaire" },
    { "type": "text", "id": "nom_lampe", "label": "Nom du lampadaire", "default": "Feather Palm" },
    { "type": "checkbox", "id": "prix", "label": "Afficher les prix", "default": true },
    { "type": "text", "id": "des", "label": "Devant un prix « à partir de »", "default": "dès" },
    { "type": "text", "id": "longueur", "label": "Cote : longueur", "default": "4,20 m" },
    { "type": "text", "id": "largeur", "label": "Cote : largeur", "default": "3,60 m" },
    { "type": "text", "id": "description", "label": "Description du dessin (lecteurs d’écran)", "default": "Le plan d’une pièce se dessine, passe en 3D, puis se meuble : canapé d’angle, table d’appoint, fauteuil et lampadaire Maison Corleone." },
    { "type": "text", "id": "rejouer", "label": "Bouton pour rejouer l’animation", "default": "Rejouer" },
    { "type": "header", "content": "Mise en page" },
    {
      "type": "select", "id": "ambiance", "label": "Ambiance", "default": "expresso",
      "options": [
        { "value": "expresso", "label": "Expresso (fond sombre)" },
        { "value": "creme", "label": "Crème (fond clair)" }
      ]
    },
    {
      "type": "select", "id": "position", "label": "Dessin", "default": "droite",
      "options": [
        { "value": "droite", "label": "À droite du texte" },
        { "value": "gauche", "label": "À gauche du texte" }
      ]
    },
    {
      "type": "select", "id": "section_width", "label": "t:sections.all.section_width.label", "default": "container",
      "options": [
        { "value": "container", "label": "t:sections.all.section_width.container.label" },
        { "value": "fluid_container", "label": "t:sections.all.section_width.fluid_container.label" },
        { "value": "stretch_width", "label": "t:sections.all.section_width.stretch_width.label" },
        { "value": "full_width", "label": "t:sections.all.section_width.full_width.label" }
      ]
    },
    { "type": "header", "content": "t:sections.all.section_padding.label" },
    { "type": "range", "id": "padding_top", "label": "t:sections.all.section_padding.top.label", "default": 0, "min": 0, "max": 100, "step": 1, "unit": "px" },
    { "type": "range", "id": "padding_bottom", "label": "t:sections.all.section_padding.bottom.label", "default": 0, "min": 0, "max": 100, "step": 1, "unit": "px" },
    { "type": "checkbox", "id": "reset_spacing", "label": "t:sections.all.section_padding.reset_spacing.label", "default": false }
  ],
  "presets": [{ "name": "Pièce en 3D (Chez vous)" }]
}
{% endschema %}
'''


def compacter_css(css):
    css = re.sub(r'/\*.*?\*/', '', css, flags=re.S)
    return '\n'.join(l.strip() for l in css.strip().splitlines() if l.strip())


def compacter_js(js):
    return '\n'.join(l.rstrip() for l in js.strip().splitlines())


def construire():
    css = (CSS.replace('@@SOMBRE@@', variables(SOMBRE)).replace('@@CLAIR@@', variables(CLAIR))
           .replace('@@RATIO@@', f'{scene.n(scene.VB[2])}/{scene.n(scene.VB[3])}')
           .replace('@@PLAN_DY@@', scene.n(scene.PLAN_DY)).replace('@@PLAN_S@@', f'{scene.PLAN_S:g}')
           .replace('@@PLAN_S2@@', f'{scene.PLAN_S * 2:g}'))
    etiquettes = []
    for cle, e in scene.ETIQUETTES.items():
        x, y = scene.position_etiquette(cle)
        etiquettes.append(ETIQ.replace('@@CLE@@', cle).replace('@@COTE@@', e['cote'])
                          .replace('@@X@@', f'{x:g}').replace('@@Y@@', f'{y:g}').replace('@@D@@', str(e['delai'])))
    svg = (scene.svg().replace('@@LARGEUR@@', '{{ st.largeur | escape }}')
           .replace('@@LONGUEUR@@', '{{ st.longueur | escape }}'))
    sortie = (GABARIT.replace('@@CSS@@', compacter_css(css)).replace('@@JS@@', compacter_js(JS))
              .replace('@@SVG@@', svg).replace('@@ETIQUETTES@@', '\n'.join(etiquettes)))
    SORTIE.write_text(sortie)
    return sortie


if __name__ == '__main__':
    s = construire()
    import gzip
    print(SORTIE.name, len(s.encode()), 'octets,', len(gzip.compress(s.encode())), 'compressés')
