# Threshold Ladder

*[English version](README.md)*

Une page qui te dit combien de points il faudra pour finir à un rang donné dans
un tournoi Fortnite — avant que les résultats n'existent, puis plus précisément
une fois la session lancée.

Aucune installation, aucun compte, aucune clé API. Tu ouvres le site, tu choisis
le tournoi de la semaine dans la liste, tu tapes le rang qui t'intéresse.

Deux constructions de la même source :

- **`index.html` + `model.js` + `calendar.js`** — le site. Le modèle est un
  fichier à part pour pouvoir grossir ; le calendrier est ce qui se joue cette
  semaine.
- **`standalone.html`** — tout en un fichier, sans réseau. Clic droit,
  enregistrer, double-clic. Le calendrier qu'il contient est figé à la date de
  construction, et le dit.

---

## Ce qu'il fait

La page s'ouvre sur **ce qui se joue cette semaine** : tous les tournois du
calendrier, filtrables par région et par mode, cherchables par nom, ceux en cours
marqués comme tels. Un clic et le formulaire se remplit — nom, région, taille
d'équipe, mode, nombre de parties, durée de la session, et le barème — et la
réponse vient avec le clic : les paramètres sont confirmés d'office, puisque
chacun est celui d'Epic, et le rang demandé est **le palier qui compte**. Chaque
cup emporte les paliers qu'elle fait gagner, lus dans sa table de gains : le top
2 000 passe en Round 2, le top 25 va en finale, de l'argent à partir de la 8e
place, un cosmétique jusqu'à la 500e. Ils s'affichent au-dessus de la réponse
sous forme de pastilles — un clic pour chiffrer l'un d'eux —, le palier de
qualification le plus large est celui que la page demande en premier, et
l'échelle les nomme : « top 2 000 · qualifie pour Round 2 » se lit, au lieu d'un
rang à connaître par cœur. Un palier donné en part de l'effectif (le top 25 %)
est converti en rang avec l'effectif que la prévision utilise, et le dit.

Une finale jouée par les équipes qualifiées dans un seul lobby est reconnue
comme un lobby fermé : le format passe en scellé, l'effectif à la taille du
lobby, et la page le dit sous le champ. La reconnaissance passe par le même
rapprochement de nom que la prévision, donc une cup que le modèle connaît sous
une orthographe un peu différente est quand même lue correctement.

Ou tu renseignes tout à la main — nom, région, taille d'équipe, mode, fenêtre
ouverte ou scellé, durée de la session, durée d'une partie, effectif si tu le
connais — et tu colles le barème depuis les règles (le lecteur accepte `1 = 60`,
`1st 60`, `Top 1 : 60` et le reste). Puis tu appuies sur **Confirmer les
paramètres**, ce qui les gèle : plus rien ne bouge par inadvertance.

Tu tapes le rang qui t'intéresse, tu appuies sur **Prédire**, et tu obtiens le
nombre avec sa fourchette. Tu changes de rang, tu réappuies — les paramètres
restent en place. Sous la réponse, l'échelle entière depuis le top 1, avec le
rang demandé mis en évidence.

Le champ Nom connaît les tournois du modèle et rapproche largement : « FNCS Div
2 » retrouve « FNCS Division 2 » — mais jamais « FNCS Division 3 », les nombres
devant concorder. Quand le nom recouvre plusieurs manches, une deuxième liste
les propose — Round 1, Qualification — avec le nombre d'éditions derrière
chacune, et en choisir une remplit le nombre de parties habituel de cette
manche.

**Le nombre de parties est le champ le plus important.** Le niveau lui est
proportionnel : se tromper dessus multiplie ou divise tous les seuils de la
page. C'est le plafond des règles qui fait foi ; la durée de la session et
celle d'une partie servent de contrôle, et la page le dit franchement quand
l'horloge ne laisse pas la place aux parties que les règles autorisent.

Ensuite, pendant que tu joues, tu suis la cup partie par partie. Après chaque
partie, tu saisis ce qu'affiche le classement à deux ou trois rangs et tu
appuies sur **Confirmer** : c'est à ce moment-là que la prédiction bouge — rien
ne bouge pendant que tu tapes. Le relevé s'enregistre dans une liste avec son
numéro de partie et l'heure, les points s'effacent, les rangs restent où tu les
as mis, et le compteur passe à la partie suivante. D'une partie à l'autre, il
n'y a donc que trois nombres à taper et un bouton à presser. À la fin,
**Terminer et sauvegarder** garde la soirée dans le navigateur et écrit un
fichier que `import_session.py`, dans le dépôt de recherche, relit vers la base
— c'est comme ça qu'une soirée suivie devient la seule chose qui manque au mode
direct : un tournoi observé jusqu'au bout, dont on connaît la réponse.

Chaque relevé dit comment cette cup tourne par rapport à son historique — un top 5 à 153 points après 3 parties sur 6, dans une cup dont
l'édition précédente a fini à 246, tourne 23 % au-dessus. Où en est un seuil à ce
stade de la session est mesuré, pas supposé : `analysis/live.py` rejoue les
classements moissonnés partie par partie et trouve qu'à la moitié des parties un
seuil est à la moitié de sa valeur finale, à quinze pour cent près d'une cup à
l'autre. Relevés et historique sont ensuite combinés selon leur précision — le
plus précis pèse le plus — donc à la dernière partie les relevés sont la réponse,
et la page dit quelle part ils en ont portée.

Jusqu'où un relevé se propage dans l'échelle est mesuré aussi, et les deux
formats ne répondent pas pareil. Dans une file ouverte de milliers d'équipes,
tout le classement bouge ensemble : un relevé au rang 20 chiffre le rang 500
presque exactement (pente 0,86 entre rangs, mesurée). Dans un lobby fermé, non :
les mêmes vingt équipes se partagent un pot fixe, donc une équipe qui s'échappe
en tête prend les points qui seraient tombés au rang 10, et la pente mesurée est
nulle. Là, un relevé ne chiffre que son propre rang et le reste de l'échelle
garde sa prédiction issue de l'historique — c'est ce que fait la page, et elle
le dit.

Deux langues, EN/FR, bouton dans l'en-tête.

## Comment ça marche

Une cascade, la lecture la plus directe d'abord, chaque échelon ne répondant
que si celui du dessus ne le peut pas :

1. **L'édition précédente de cette cup, à ce rang, lue telle quelle.** Avec une
   fourchette mesurée sur ce que ce rang a bougé entre les éditions. En premier
   parce que rien ne l'a battue : une soirée forte monte tous les rangs
   ensemble, et un nombre lu entier garde ça là où un niveau fois un ratio le
   perd.
2. **Le niveau de la cup fois une forme mesurée** — ce que chaque rang valait
   par rapport au rang 20 sur les éditions de la cup. Une table, pas une courbe.
3. **Le niveau fois une courbe ajustée**, pour les rangs que personne n'a
   mesurés.
4. **Le seul barème**, pour une cup que personne n'a vue — la fourchette la
   plus large, et la page dit quand elle est dans ce cas.

Le modèle embarque 7 232 tournois et 1 765 catégories lus sur l'API publique
d'Osirion, et sait de quel échelon il a répondu : la page l'affiche.

## Ce que ça vaut

Mesuré comme une prévision : les 600 tournois les plus récents prédits à partir
des 6 632 qui les précèdent, sans que rien ne voie le futur.

| tranche de rangs | erreur médiane, cup déjà vue |
|---|---:|
| top 1 – 5 | 5,5 % |
| top 6 – 25 | 5,0 % |
| top 26 – 100 | 5,6 % |
| top 101 – 500 | 6,2 % |
| au-delà de 500 | 9,7 % |
| **ensemble** | **5,7 %** |

82 % des seuils réels tombent dans une fourchette qui en annonce 80 %.

Ces chiffres ne sont pas tapés dans la page. `analysis/validate.py` les écrit
dans `validation.json`, l'export les emporte dans `model.json`, et le panneau
« sur quoi ça repose » affiche ce qui s'y trouve — avec la date de la mesure, et
un tiret tant qu'elle n'a pas été faite.

Deux réserves, que la page rappelle là où elles s'appliquent :

- Une cup que le modèle n'a jamais vue — la moitié des tournois d'une nouvelle
  saison — est prédite depuis son seul barème, avec environ 19 % d'erreur
  médiane au lieu de 6 %. La page indique quand elle est dans ce cas.
- La courbe de rythme du raffinement en direct est mesurée sur des classements
  rejoués (44 au moment d'écrire ; toute la moisson est à une commande), mais la
  règle qui combine relevés et historique n'a pas encore été validée sur des
  tournois tenus à l'écart. Le chiffre en direct est une indication avec une
  fourchette mesurée, pas un résultat.

Tout cela vient du dépôt de recherche dont ce fichier est issu, qui contient les
données, la validation croisée et la note de méthodologie.

## Le construire, et le mettre en ligne

Les fichiers construits sont générés et versionnés : le site, c'est le dépôt.

```
python build.py          # src/app.html + model.json (+ calendar.js)
                         #   ->  index.html, model.js, standalone.html
python build.py --check  # échoue si l'un d'eux est en retard sur ses sources
python publish.py        # une seule fois : dépôt, push, GitHub Pages activé
```

L'hébergement ne demande aucun serveur : trois fichiers statiques et un CDN.
`publish.py` fait l'installation unique — transforme le dossier en dépôt,
committe sous le nom du compte, le crée sur GitHub (avec `gh` s'il est installé,
sinon il dit quels deux clics faire), pousse, et active Pages. Le site vit alors
à `https://<compte>.github.io/threshold-ladder/`, en ligne que quoi que ce soit
tourne chez toi ou non. Ensuite `refresh.py --publish` dans le dépôt de
recherche reconstruit et pousse en une commande ; le calendrier couvre sept
jours, donc autant le lancer au moins une fois par semaine. Qui préfère un
fichier à un lien prend `standalone.html` : le tout en une page, sans réseau.

`model.json` est écrit par `export_model.py` dans le dépôt de recherche, qui
refuse de l'écrire tant qu'il n'a pas reproduit le modèle Python à la décimale
sur un échantillon de l'entraînement. `calendar.js` est écrit par
`calendar_snapshot.py` au même endroit, depuis la semaine à venir. Le JavaScript
de `src/app.html` est un portage ligne à ligne de `predict_from_model()` — si tu
changes l'un, change l'autre ; l'export refusera d'écrire tant qu'ils ne sont pas
d'accord.

## Vie privée

Rien ne sort de la page. Aucune mesure d'audience, aucune requête à qui que ce
soit d'autre que l'hébergeur de la page elle-même, aucun stockage au-delà du
dernier tournoi saisi, gardé par ton propre navigateur. Le fichier autonome se
comporte à l'identique réseau coupé, à la police système près.

---

Licence MIT. Fortnite est une marque d'Epic Games ; ce projet n'a aucun lien avec
eux et n'utilise aucune ressource du jeu.
