# Threshold Ladder

**→ [Ouvrir le site](https://fortnitepredcomp.com/)** ·
*[English version](README.md)*

Combien de points vaudra un rang donné dans un tournoi Fortnite — avant que les
résultats n'existent, et plus précisément une fois la session lancée.

Les seuils sont publiés après coup. Un joueur qui se demande s'il continue, ou
avec quelle agressivité, devine. Cette page estime la réponse à partir du barème
du tournoi, de son effectif, et de ce qu'ont fait les éditions précédentes de
tournois comparables.

Aucune installation, aucun compte, aucune clé d'API. Deux façons de l'avoir :

- **le site** — [il s'ouvre ici](https://fortnitepredcomp.com/)
  et ça marche, sur téléphone comme sur ordinateur ;
- **[`standalone.html`](https://fortnitepredcomp.com/standalone.html)**
  — le tout en un seul fichier. Clic droit sur ce lien, *Enregistrer le lien
  sous…*, double-clic sur le fichier : ça tourne sans réseau du tout. Le
  calendrier qu'il contient est figé à la date de sa construction, et le dit.

---

## S'en servir

La page s'ouvre sur **ce qui se joue cette semaine** : tous les tournois du
calendrier encore à venir, filtrables par région, par mode et par taille
d'équipe, cherchables par nom, ceux en cours marqués comme tels. Les cups de la
journée déjà finies restent dans la liste, grisées, un cran plus haut ; les
plus anciennes disparaissent. Un clic et la prédiction s'ouvre sur son propre écran : nom,
région, taille d'équipe, mode, nombre de parties, durée de la session et
barème sont remplis, et la réponse est déjà là, puisque chacun de ces réglages
est celui d'Epic. **Tous les tournois**, en haut, ou le bouton retour du
navigateur, ramène à la liste.

Le rang qu'elle chiffre en premier, c'est **le palier qui compte**. Chaque cup
emporte les paliers qu'elle fait gagner, lus dans sa table de gains : le top
2 000 passe en Round 2, le top 25 va en finale, de l'argent à partir de la 8e
place, un cosmétique jusqu'à la 500e. Ils s'affichent au-dessus de la réponse
sous forme de pastilles — un clic pour en chiffrer un — et l'échelle les nomme :
« top 2 000 · qualifie pour Round 2 » se lit, au lieu d'être un rang à connaître
par cœur. Un palier donné en part de l'effectif (le top 25 %) devient un rang,
et le dit.

Une finale jouée par les équipes qualifiées dans un seul lobby est reconnue
comme telle : le format passe en scellé, l'effectif devient la taille du lobby,
et la page le dit sous le champ.

Un tournoi absent du calendrier se saisit à la main, par le bouton sous la
liste — nom, région, taille d'équipe, mode, fenêtre ouverte ou scellée, durée
de la session et durée d'une partie, l'effectif s'il est connu — et le barème
se colle directement depuis osirion.gg ou le règlement (`1 = 60`, `1er 60`,
`Top 1 : 60`, `Victory Royale - 60` et le reste se lisent tous). **Confirmer
les paramètres** les gèle, pour que rien ne bouge par accident.

Le champ du nom connaît les tournois du modèle et rapproche largement : « FNCS
Div 2 » trouve « FNCS Division 2 » — mais jamais « FNCS Division 3 », parce que
les nombres doivent coïncider. Quand un nom couvre plusieurs manches, une
seconde liste les propose avec le nombre d'éditions derrière chacune, et en
choisir une remplit le nombre de parties habituel de cette manche.

**Le nombre de parties est le champ qui compte le plus.** Le niveau y est
proportionnel, donc se tromper dessus déplace tous les seuils de la page. C'est
le plafond du règlement qui fait foi ; la durée de la session et celle d'une
partie servent de recoupement, et la page le signale quand l'horloge ne laisse
pas la place aux parties que le règlement autorise.

Un rang, **Prédire**, et le nombre arrive avec sa fourchette.
Sous la réponse, toute l'échelle depuis le top 1, le rang demandé marqué — et
l'échelle dans l'autre sens : les points qu'on pense finir avec, et la page dit
à quel rang ils mènent, avec la marge que la fourchette laisse.

### Pendant le tournoi

Une ligne sous la barre de progression dit quand la prédiction a bougé pour la
dernière fois et quand elle bougera la prochaine — classement lu à 18 h 40,
prochaine lecture vers 18 h 52 — ou que c'est encore la prédiction d'avant
tournoi.

**Prédire maintenant** déplie la saisie manuelle : après chaque partie, on saisit
ce qu'affiche le classement à deux ou trois rangs et on appuie sur
**Confirmer**. C'est à ce moment-là que la prédiction bouge — rien ne bouge tant
que les cases se remplissent. Le relevé s'enregistre dans une liste avec son
numéro de partie et l'heure, les points s'effacent, les rangs restent où ils
sont, et le compteur passe à la partie suivante. D'une partie à l'autre, il n'y
a donc que trois nombres à taper et un bouton à presser.

Chaque relevé dit comment cette cup tourne par rapport à son historique : un top
5 à 153 points après 3 parties sur 6, dans une cup dont l'édition précédente a
fini à 246, tourne 23 % au-dessus. Où en est un seuil à ce stade de la session
est mesuré, pas supposé — en rejouant partie par partie des classements passés,
on trouve qu'à la moitié des parties un seuil est à la moitié de sa valeur
finale, à quinze pour cent près d'une cup à l'autre. Relevés et historique sont
ensuite combinés selon leur précision, le plus précis pesant le plus, si bien
qu'à la dernière partie les relevés sont la réponse ; la page dit quelle part
ils en ont portée.

Jusqu'où un relevé se propage dans l'échelle a été mesuré de la même façon, et
les deux formats ne répondent pas pareil. Dans une file ouverte de milliers
d'équipes, tout le classement bouge ensemble : un relevé au rang 20 chiffre le
rang 500 presque exactement. Dans un lobby fermé, non : les mêmes vingt équipes
se partagent un pot fixe, donc une équipe qui s'échappe en tête prend les points
qui seraient tombés au rang 10. Là, un relevé ne chiffre que son propre rang, le
reste de l'échelle garde sa prédiction issue de l'historique, et la page dit
laquelle des deux situations elle traite. Un rang relevé des deux côtés est un
troisième cas, le plus simple : le top 160 est entre un top 100 et un top 250
lus dans le classement, donc il est estimé entre les deux, log-linéairement en
rang — une interpolation qui se trompe de 1 à 3 % en médiane sur les tournois
passés jusqu'au top 250, de 5 à 7 % plus bas, contre une fourchette d'allure de
dix et plus. L'échelle marque ces barreaux d'un point creux.

Quand la cup est en cours et que le flux en direct du site est actif, le
classement est lu pour toi toutes les quelques minutes — les points aux top 1,
3, 5, 10, 20, 25, 50 et 100, à chaque palier que la cup paie (le rang de
qualification d'abord) et aux barreaux plus profonds de l'échelle, aussi loin
que quelques pages le permettent — et enregistré comme relevés marqués *auto* :
la prédiction les suit sans que personne ne tape rien. Un relevé saisi à la
main marche toujours et prend le dessus tant qu'il est le plus récent.

À partir du deuxième relevé, un graphique sous l'échelle montre comment ça a
bougé : les points aux rangs relevés, relevé après relevé, et ce que la
prédiction disait à chaque fois avec sa fourchette — en parties pour un lobby
scellé, en minutes pour une file ouverte — face à la prédiction d'avant tournoi
tracée en filet. La courbe de prédiction est celle du rang demandé maintenant,
recalculée à chaque relevé : demander un autre rang redessine toute la courbe.

La dernière cup ouverte reste dans le navigateur telle qu'on l'a laissée :
recharger la page la ramène, réglage corrigé à la main compris, et la même
ligne de la liste la rouvre plutôt que la copie du calendrier — une autre
ligne, ou **Saisir un tournoi à la main**, repart de zéro. **Terminer** garde la soirée et
revient à la liste, où les tournois suivis attendent sous le calendrier, prêts
à être rouverts ; la flèche à côté de chacun le télécharge sous forme de petit
fichier.

Deux langues, EN/FR, bouton dans l'en-tête.

## Comment ça marche

Une cascade, du plus direct au plus indirect, chaque échelon ne répondant que si
celui du dessus ne peut pas :

1. **L'édition précédente de cette cup, à ce rang, lue telle quelle.** Avec une
   fourchette mesurée sur l'ampleur des déplacements de ce rang d'une édition à
   l'autre. En premier parce que rien ne l'a battu : une bonne soirée soulève
   tous les rangs ensemble, et un nombre lu entier garde ça là où un niveau
   multiplié par un rapport le perd.
2. **Le niveau de la cup multiplié par une forme mesurée** — ce que valait
   chaque rang par rapport au rang 20, sur les éditions de cette cup. Une table,
   pas une courbe.
3. **Le niveau multiplié par une courbe ajustée**, pour les rangs que personne
   n'a mesurés.
4. **Les finales du même format, par part du lobby**, pour une finale jouée dans
   un seul lobby dont aucune édition n'a été vue — le cas habituel d'un Round 2
   dont le modèle connaît le Round 1. Les deux échelons qui l'encadrent sont
   mesurés sur des files ouvertes de milliers d'équipes et chiffrent un lobby
   de vingt d'après sa dernière place.
5. **Le barème seul**, pour une cup que personne n'a vue — la fourchette la plus
   large, et la page dit quand elle en est là.

Le modèle est bâti sur plusieurs milliers de tournois lus depuis l'API publique
d'Osirion — la page affiche exactement sur combien il a été entraîné, et de quel
échelon vient sa réponse.

## Ce que ça vaut

Mesuré comme une prévision : les 600 tournois les plus récents prédits à partir
des 6 632 d'avant, sans que rien ne voie le futur.

| tranche de rangs | erreur médiane, cup déjà vue |
|---|---:|
| top 1 – 5 | 5,4 % |
| top 6 – 25 | 4,4 % |
| top 26 – 100 | 3,6 % |
| top 101 – 500 | 5,2 % |
| au-delà de 500 | 8,7 % |
| **ensemble** | **5,0 %** |

83 % des seuils réels tombent dans une fourchette qui en annonce 80 %.

Ces chiffres ne sont pas tapés dans la page : ils sont emportés par le fichier
du modèle depuis la mesure qui les a produits, affichés avec cette date, et
remplacés par un tiret quand il n'y a rien à afficher.

Deux réserves que la page répète là où elles s'appliquent :

- Une cup jamais vue — la moitié des tournois d'une nouvelle saison — est
  prédite depuis son seul barème, avec environ 20 % d'erreur médiane au lieu de
  5 % ; une finale à lobby unique jamais vue, depuis les finales de son format,
  avec environ 13 %. La page indique dans lequel de ces cas elle se trouve.
- La courbe de rythme du mode direct est mesurée, mais la règle qui combine
  relevés et historique n'a pas été validée sur des tournois tenus à l'écart. Le
  chiffre en direct est une indication avec une fourchette mesurée, pas un
  résultat.

## Vie privée

Tout ce que la page calcule se passe dans le navigateur. Aucune mesure
d'audience, aucun stockage au-delà d'une soirée en cours et des soirées
sauvegardées, gardées par le navigateur. La page s'ouvre sur le calendrier de
la semaine et un formulaire vide.

La page hébergée affiche une bannière publicitaire, servie par Google ; les
visiteurs européens se voient demander leur consentement d'abord, et la
bannière n'a d'effet sur rien d'autre dans la page. Quand un tournoi en cours
est ouvert, elle demande aussi au flux du site le classement actuel de cette
cup, une requête qui ne contient rien sur toi. La [note de
confidentialité](privacy.html) dit exactement ce que fait chacune. Le fichier
autonome ne porte aucune bannière et ne fait aucune requête, à la police
système près.

Les données de tournois viennent de l'API publique Fortnite
d'[Osirion](https://osirion.gg).

---

Licence MIT. Ce projet n'a aucun lien avec Epic Games et n'utilise aucune
ressource du jeu. Portions of the materials used are trademarks and/or
copyrighted works of Epic Games, Inc. All rights reserved by Epic. This material
is not official and is not endorsed by Epic.
