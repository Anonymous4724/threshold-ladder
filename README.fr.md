# Threshold Ladder

**→ [Ouvrir le site](https://fortnitepredcomp.com/)** ·
*[English version](README.md)*

Combien de points vaudra un rang donné dans un tournoi Fortnite — avant que les
résultats n'existent, et plus précisément une fois la session lancée.

Les seuils sont publiés après coup. Un joueur qui se demande s'il continue, ou
avec quelle agressivité, devine. Cette page estime la réponse à partir du barème
du tournoi, de son effectif, et de ce qu'ont fait les éditions précédentes de
tournois comparables.

Autour, le site propose [les cups de la semaine](https://fortnitepredcomp.com/fr/cette-semaine/)
avec la prévision au rang qualificatif de chacune, et des
[guides](https://fortnitepredcomp.com/fr/guides/) sur ce qui fait un seuil —
barème, rythme d'une session, régions, rangs profonds, nouvelles saisons, cups
inédites — chacun appuyé sur les mêmes données que le modèle, en français et en
anglais.

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
plus anciennes disparaissent. Un clic et la prédiction s'ouvre sur son propre
écran, en trois onglets pour que rien ne s'empile : **Prédiction** — le rang
demandé, la réponse, l'échelle ; **En direct** — la soirée telle qu'elle se
joue, son graphique et ses relevés ; **Réglages** — nom, région, taille
d'équipe, mode, nombre de parties, durée de la session, condition d'accès et
barème, tous remplis, si bien que la réponse est déjà là, puisque chacun de ces
réglages est celui d'Epic. **Tous les tournois**, en haut, ou le bouton retour
du navigateur, ramène à la liste ; **Classement complet sur osirion.gg** ouvre
tout le classement là-bas, dans un nouvel onglet.

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

Cette courbe est celle du genre de cette cup, pas de toutes les files ouvertes
confondues. Rejouée par famille — mode de jeu, taille d'équipe, durée de la
fenêtre, plafond de parties — la part atteinte à mi-session va de 0,42 à 0,53
et la part à l'heure de 0,87 à 0,94 : une cup Battle Royale de deux heures a
une partie de trente minutes encore en l'air au buzzer, une cup plafonnée à dix
parties Reload courtes n'a plus rien à jouer dans sa dernière demi-heure. Au
sein d'une famille, le genre de cup compte aussi : à mi-session les cups
d'entraînement FNCS avaient atteint 45 % de leur valeur finale là où les cups
skin du même format en étaient à 56 %, donc les lignes de famille sont tenues
par genre de cup et plateforme en plus de la ligne confondue. La page lit
d'abord les éditions récentes de la cup elle-même — telles que le flux les a
lues dès qu'il en a suivi quatre, car le rejeu par la moisson d'une cup Solo
grand public court 4 à 9 % trop bas à mi-session, ses premières pages ne
contenant pas les joueurs en tête au début qui se sont arrêtés ensuite, et
seulement tant que ces éditions ont moins de 45 jours et le même format — puis
la famille par genre, puis la famille confondue, puis la courbe commune, et
dit laquelle. Le fond d'une file a aussi
son propre rythme, fixé par la profondeur du rang dans le peloton et non par le
rang : le millième d'un peloton de deux mille, c'est la moitié grand public,
finie au dernier cinquième de la session ; le millième de dix mille garde le
rythme du haut. Ce rapport est mesuré sur les soirées du flux, et le peloton
contre lequel il se mesure, c'est le nombre de joueurs déjà au classement — le
chiffre sous la barre de progression — que le flux lit avec chaque relevé.
À chaque passage complet le flux lit aussi la dernière page du classement,
donc le compte est exact — 6 743 joueurs, pas « environ 6 750 » — et la ligne
le dit en laissant tomber le « ≈ ». L'API pagine un classement sur cent pages
au plus, donc au-delà de dix mille la ligne dit « 10 000 ou plus » : le
classement s'arrête là, quand le site d'Osirion, qui compte les joueurs à
partir des parties qu'il analyse, peut en afficher quinze mille.
Rejouée sur 110 soirées avec seulement ce qui était connu chaque matin,
l'erreur médiane passe de 5,0 à 4,2 % entre trois et cinq dixièmes de la
session, de 4,7 à 3,6 % entre cinq et sept, de 2,1 à 1,4 % dans les dix minutes
après la clôture ; les fourchettes d'une réponse en direct sont mesurées sur
ces mêmes soirées, là où elles empruntaient celles de la prédiction d'avant
tournoi.

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
classement est lu pour toi toutes les dix minutes — les points aux top 1,
3, 5, 10, 20, 25, 50 et 100, à chaque palier que la cup paie (le rang de
qualification d'abord) et aux barreaux plus profonds de l'échelle, aussi loin
que quelques pages le permettent — et enregistré comme relevés marqués *auto* :
la prédiction les suit sans que personne ne tape rien. Sur les vingt dernières
minutes d'une cup et pendant que son tableau se stabilise, là où le classement
bouge d'environ un point par minute aux rangs qui qualifient, le top cent est
relu toutes les cinq minutes et la page le demande toutes les deux. Un relevé saisi à la
main marche toujours et prend le dessus tant qu'il est le plus récent. Le flux
garde chaque lecture qu'il a faite : une cup ouverte tard, sur un autre
appareil ou après sa fin montre toute la soirée, pas ce que ce navigateur a vu.

Le flux suit les cups du calendrier publié, et ce calendrier n'était écrit que
par la machine qui moissonne, quand elle tournait : une cup annoncée par Epic
entre deux passages tournait sans être suivie, et une soirée que le flux n'a
pas vécue ne se récupère pas après coup. Le workflow du dépôt rafraîchit
désormais le calendrier toutes les trois heures, donc la liste — et le flux
derrière elle — n'a jamais plus de retard que ça sur Epic. Une cup terminée
sans rien du flux le dit sur son onglet En direct, et renvoie au classement
complet sur osirion.gg.

Un passage du flux n'est pas un instantané. Chaque page d'un classement est
une requête à part et les copies que l'API renvoie n'ont pas toutes le même
âge : la page qui porte le top 160 peut avoir plusieurs minutes de retard sur
la première, ou manquer complètement au passage. Chaque relevé est donc daté
de la minute de sa propre page, et la réponse s'appuie sur l'état de la soirée
— le relevé de chaque rang qui tient maintenant, quel que soit le passage d'où
il vient, un rang que le flux n'a plus lu depuis une demi-heure étant lâché.
Entre deux relevés du flux au même rang, le plus riche est le plus frais, car
un seuil ne redescend pas ; un relevé saisi à la main prime sur le flux
jusqu'à la minute où il a été tapé. C'est de là que venaient les à-coups de la
courbe de prédiction : sur six soirées rejouées depuis l'historique du flux,
la prédiction bouge maintenant environ deux fois moins d'un relevé au suivant,
et le plus gros saut de tous tombe de 34 % du seuil final à 15 %.

Dans un lobby scellé, le classement est à moitié mis à jour tant qu'une partie
se joue — les équipes déjà éliminées ont leur partie comptée, celles encore en
vie, celles qui vont ramasser le plus de points, pas encore — donc le flux lit
le classement tel qu'il était à la fin de la dernière partie terminée, rebâti
depuis les parties de chaque équipe (le même match est la même session pour
tout le lobby, et une partie est finie dès qu'un vainqueur y est inscrit ; une
équipe qui a raté une partie est simplement une équipe avec une partie de
moins). La ligne d'état dit alors quelle partie est en cours et sur quel
classement la prédiction repose. Un lobby qui démarre en retard joue au-delà
de la fin de la fenêtre : son classement n'est déclaré final qu'une fois ses
parties rentrées.

La fermeture de la fenêtre n'est pas la fin de la cup : les parties en cours
quand l'horloge s'arrête continuent de tomber pendant un quart d'heure, et le
classement monte avec elles. Combien, c'est mesuré aussi, en minutes après la
fermeture plutôt qu'en dixièmes de session — environ 93 % du classement final
à la fermeture, 97 % dix minutes plus tard, stabilisé à vingt — donc un relevé
pris après l'heure est daté de la minute où il a été pris. Avant, la page
ajoutait la même hausse à chaque relevé tardif et la prédiction montait avec
le classement au lieu de converger : sur une cash cup dont le top 20 a fini à
607, elle disait 600 à la fermeture et 651 vingt minutes plus tard. Elle dit
maintenant 600 puis 607, et la fourchette se resserre à mesure que le
classement se fige.

Un seuil ne redescend jamais, et la page en fait une règle et non une
tendance : les points d'une équipe ne peuvent que monter, donc le k-ième
score d'une soirée ne peut que monter, donc le seuil final d'un rang ne peut
pas être sous ce que le classement affiche déjà. La prédiction et le bas des
deux fourchettes sont tenus au relevé du tableau — et pour un rang non relevé,
au rang plus profond le plus proche qui l'a été, puisque le rang 50 vaut au
moins ce que vaut le rang 100. La pondération des relevés contre l'historique
pouvait passer sous le tableau dont elle partait : 82 prédictions sur 10 182
rejouées le faisaient.

Le haut du tableau se stabilise-t-il plus tard que son bas ? C'est mesuré et
non supposé, par tranche de rangs — et la réponse est non, sur 25 642 relevés :
il reste les mêmes 8 % à prendre à la fermeture, que le rang demandé soit le
top 25 ou le top 500. Ce qui change, c'est la certitude. Le fond du tableau est
une fois et demie à deux fois moins prévisible à la même minute (±10 % contre
±7 % à la fermeture, ±6 % contre ±3 % quinze minutes plus tard) : la fourchette
d'un rang profond après la fermeture est donc plus large, et la page lit la
tranche du rang demandé.

Après la fermeture, la page regarde un tableau encore en cours de publication.
Le tassement ci-dessus est mesuré sur les heures de partie de chaque équipe, où
vingt minutes après le buzzer toutes les parties sont finies et il ne reste
rien à venir ; mais la page lit la copie d'Osirion, et Osirion arrive quelques
minutes après les parties. La *largeur* de la fourchette après la fermeture est
donc mesurée sur les soirées du flux lui-même, et séparée selon le seul signal
qui distingue un tableau encore en publication d'un tableau terminé : le même
classement a-t-il été relu à l'identique. Inchangé depuis dix minutes, c'est
le classement final dans chacun des relevés mesurés ; plus frais que ça, il
est 3 % trop bas une fois sur dix et 5 % une fois sur vingt, là où la page
annonçait environ 1 %. Le centre, lui, ne change pas — le rythme de montée du
tableau, et une courbe de tassement décalée ou plafonnée tant que le tableau
bougeait, ont tous été essayés pour anticiper le reste de la montée, et tous
étaient moins bons que la courbe mesurée. La page dit donc jusqu'où le tableau
peut encore aller au lieu de prétendre savoir où il s'arrêtera, et dit avec des
mots que les dernières parties tombent encore.

La fin de la fenêtre n'est pas la fin du classement : les parties lancées à
l'heure pile tombent pendant encore vingt minutes, et un relevé pris à 21 h 59
n'est pas le classement final, si ronde que soit l'heure. La page attend que
le flux lise deux fois le même classement — c'est le classement lui-même qui
dit qu'il a cessé de bouger, pour cette cup et pas en moyenne — et dit
entre-temps lequel des trois états on regarde : encore en cours, dernières
parties en train de tomber (avec l'heure à laquelle ce sera figé), ou final et
inchangé depuis telle minute.

Quand la cup est finie et que le classement a cessé de bouger, la page arrête
de prédire : un rang que le flux a lu sur le classement final est affiché pour
ce qu'il est — le résultat, la minute où il a été récolté, et ce que le modèle
annonçait avant la cup — sans fourchette autour, puisqu'il n'y a plus rien
d'incertain. Les rangs que le flux n'a jamais lus gardent une prédiction et le
disent.

Le graphique se lit au doigt autant qu'à la souris : faire glisser dessus
déplace le repère, et les chiffres s'affichent à côté du graphique plutôt que
dans une bulle posée dessus — sur téléphone la bulle cachait ce qu'elle
décrivait, et un doigt ne pouvait même pas la faire apparaître. Chaque ligne
de la légende est un interrupteur : une courbe éteinte quitte le graphique,
les chiffres et l'échelle. Les relevés de la soirée sont un registre plus
qu'une lecture : ils sont repliés sous un titre qui dit combien il y en a.

À partir du deuxième relevé, un graphique sous l'échelle montre comment ça a
bougé : les points aux rangs relevés, relevé après relevé, et ce que la
prédiction disait à chaque fois avec sa fourchette — en parties pour un lobby
scellé, en minutes pour une file ouverte — face à la prédiction d'avant tournoi
tracée en filet. La courbe de prédiction est celle du rang demandé maintenant,
recalculée à chaque relevé sur tout ce que la soirée avait lu à cette
minute-là : demander un autre rang redessine toute la courbe.

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

1. **L'édition précédente de cette cup, dans ce format, à ce rang, lue telle
   quelle.** Avec une fourchette mesurée sur l'ampleur des déplacements de ce
   rang d'une édition à l'autre. En premier parce que rien ne l'a battu : une
   bonne soirée soulève tous les rangs ensemble, et un nombre lu entier garde ça
   là où un niveau multiplié par un rapport le perd. Quatre corrections, toutes
   dites sur la page. Qui était admis : la même cup réservée aux Unreal une
   semaine et ouverte dès Diamant la suivante, ce sont deux effectifs de tailles
   différentes, donc l'édition lue est la dernière avec la même condition
   d'accès quand elle a été jouée dans la même saison que la dernière en date,
   et sinon la dernière en date, la fourchette élargie de moitié. Le format :
   une cup jamais jouée en Duo lit sa dernière édition en Trio avec la
   fourchette élargie de moitié, et un lobby qui a changé de taille est chiffré
   par l'échelon 4 à la place. L'effectif : quand le nombre d'équipes est
   connu — saisi, ou le palier du tour d'avant — et n'est pas celui de
   l'édition, la valeur se déplace le long de la courbe, de la part de
   l'effectif qu'était ce rang à l'édition à celle qu'il est dans cette cup,
   plafonnée à un cinquième environ. Et la saison : une nouvelle saison monte
   toutes les cups d'un coup — +5 % en tête et +11 % au-delà du rang 500 au
   passage à la saison 42, rien au passage à la saison 41 —, donc une édition
   lue dans une saison antérieure est déplacée de ce que les premières cups de
   la saison ont montré à cette tranche de rangs, sa fourchette élargie de ce
   que ce déplacement laisse ; avant qu'aucune cup de la saison n'ait été jouée,
   elle est reprise telle quelle, la fourchette élargie. La dernière édition est
   lue aussi profond qu'elle a été moissonnée, et un rang au-delà vient d'une
   plus ancienne : la page dit quelle édition elle a lue, et de quelle saison.
   La lecture elle-même est la suite des éditions récentes jouées comme la
   dernière — même condition d'accès, même saison, mêmes parties, même barème —
   moyennée en logarithme, la dernière pesant 0,7 et chacune des précédentes 0,7
   de ce qui reste : la grosse soirée d'une équipe ne fixe plus le chiffre de la
   semaine suivante, ce qui resserre la queue de l'erreur sans bouger sa
   médiane.
2. **Le niveau de la cup multiplié par une forme mesurée** — ce que valait
   chaque rang par rapport au rang 20, sur les éditions de cette cup. Une table,
   pas une courbe.
3. **Le niveau multiplié par l'échelle**, pour les rangs que personne n'a
   mesurés — ce que vaut chaque rang par rapport au rang 20 sur toutes les files
   ouvertes de la même tranche de taille de plateau et du même mode de jeu, une
   médiane par rang sur au moins vingt classements. Une courbe ajustée répondait
   là et tombait 9 % trop bas au rang 500, 13 % trop bas au rang 1 000 (deux
   paramètres ne plient pas les deux bouts d'une échelle) ; elle répond encore
   pour les files de moins de trois cents équipes et là où l'échelle a trop peu
   de classements.
4. **Des classements récents rejoués avec le barème de cette cup**, pour une cup
   sans édition terminée dans sa région. Chaque classement porte, pour chaque
   équipe, son placement et ses éliminations à chaque partie ; repayées avec le
   nouveau barème, les mêmes parties donnent le classement que ce barème aurait
   produit, et son rang 20 est la prévision du rang 20 ici — les six classements
   les plus récents de la même région, taille d'équipe, mode et plateforme, la
   médiane entre eux, fiable jusqu'au tiers des équipes chargées et prolongée le
   long de l'échelle au-delà. Quand la cup a déjà tourné dans d'autres régions,
   moitié de cette lecture et moitié de celle-ci. Le rejeu est écrit à côté du
   calendrier de la semaine par la machine qui détient les classements ; la
   page lit une douzaine de nombres par cup et dit sur combien de classements
   ils reposent et jusqu'à quelle profondeur. Une cup ouverte depuis le
   calendrier est la cup que le calendrier nomme — son propre libellé, celui du
   modèle — et jamais une voisine dont le nom partage ses mots : rapprocher les
   noms a un jour chiffré une cup solo en Zéro construction d'après une cup en
   trio, 463 points au rang 100 là où le rejeu de son propre format disait 294.
5. **Les finales du même format, par part du lobby**, pour une finale jouée dans
   un seul lobby dont aucune édition n'a été vue — le cas habituel d'un Round 2
   dont le modèle connaît le Round 1. Les deux échelons qui l'encadrent sont
   mesurés sur des files ouvertes de milliers d'équipes et chiffrent un lobby
   de vingt d'après sa dernière place. Les dernières places elles-mêmes — au-delà
   de 90 % du lobby — n'ont pas de chiffre sauf si l'édition précédente les a
   publiées : ce sont des équipes parties après une ou deux parties.
6. **Le barème seul**, pour une cup que personne n'a vue et sans classement à
   rejouer — la fourchette la plus large, et la page dit quand elle en est là. Le round suivant d'une cup y est
   un genre de cup à part : quelques centaines d'équipes qualifiées sur une
   session courte marquent une autre part du maximum que le round ouvert.

Le modèle est bâti sur plusieurs milliers de tournois lus depuis l'API publique
d'Osirion — la page affiche exactement sur combien il a été entraîné, et de quel
échelon vient sa réponse.

## Ce que ça vaut

Mesuré comme une prévision : chacun des 600 tournois les plus récents prédit à
partir de tout ce qui s'était terminé avant son jour, sans que rien ne voie le
futur (7 632 tournois au 22 septembre 2026 ; les chiffres sont remesurés tous
les trois jours et voyagent avec le modèle).

| tranche de rangs | erreur médiane, cup déjà vue |
|---|---:|
| top 1 – 5 | 4,3 % |
| top 6 – 25 | 2,1 % |
| top 26 – 100 | 2,2 % |
| top 101 – 500 | 2,6 % |
| au-delà de 500 | 5,6 % |
| **ensemble** | **2,8 %** |

La prédiction est donnée avec deux fourchettes plutôt qu'une, et les deux sont
mesurées sur ces mêmes tournois tenus à l'écart plutôt que supposées : les
quantiles de l'erreur, en unités de la fourchette annoncée par le modèle, sur
tous les seuils tenus à l'écart. La moitié des cups tombe dans la fourchette serrée, neuf sur dix
dans la large. « Entre 500 et 1 000 points » n'est pas une prédiction ;
« entre 700 et 750, une fois sur deux » dit quelque chose d'exploitable, et la
fourchette large dit de combien on peut se tromper. Les deux sont
asymétriques, comme les erreurs : un seuil peut doubler, il ne peut pas
descendre sous zéro.

94 % des seuils réels tombent dans une fourchette qui en annonce 80 %. Lire tel
quel le résultat de la semaine dernière donne 3,1 % sur les mêmes lignes, et
9,2 % au-delà du rang 500 là où le modèle lit 5,6 % ; les cinq premiers rangs
sont la seule tranche où il fait aussi bien que le modèle.

Ces chiffres ne sont pas tapés dans la page : ils sont emportés par le fichier
du modèle depuis la mesure qui les a produits, affichés avec cette date, et
remplacés par un tiret quand il n'y a rien à afficher.

Deux réserves que la page répète là où elles s'appliquent :

- Une cup jamais vue dans sa région est prédite en rejouant des classements
  récents avec son barème, avec 4 à 5 % d'erreur médiane aux rangs 1 à 250 et
  environ 6 % jusqu'au rang 1 000 (102 cups depuis la mi-août, chacune lue sur des classements
  joués avant elle), là où le barème seul lisait 8 à 11 % ; une cup sans aucun
  classement à rejouer lit encore le barème, avec environ 14 % ; une finale à
  lobby unique jamais vue, depuis les finales de son format, avec environ 7 %.
  La page indique dans lequel de ces cas elle se trouve.
- Le raffinement en direct est mesuré sur des soirées tenues à l'écart : entre le
  tiers et les deux tiers de la session, la réponse était à environ 3 % du final
  en médiane, et ses fourchettes ont contenu 46 % et 88 % des finaux là où elles
  en annoncent 50 et 90 %. Le poids des relevés face à l'historique est remesuré
  tous les trois jours sur les soirées suivies par le flux. Cela reste une
  prévision avec une fourchette, pas un résultat, tant que le classement n'est
  pas définitif.

## Vie privée

Tout ce que la page calcule se passe dans le navigateur. Aucune mesure
d'audience, aucun stockage au-delà d'une soirée en cours et des soirées
sauvegardées, gardées par le navigateur. La page s'ouvre sur le calendrier de
la semaine et un formulaire vide.

Les pages hébergées peuvent afficher de la publicité servie par Google ; les
visiteurs européens se voient demander leur choix d'abord, et la publicité n'a
d'effet sur rien d'autre dans la page. Les pages chargent leur police depuis
Google Fonts, et quand un tournoi en cours est ouvert, la prévision demande au
flux du site le classement actuel de cette cup, une requête qui ne contient rien
sur toi. La [note de confidentialité](https://fortnitepredcomp.com/fr/confidentialite/)
dit exactement ce que fait chacune. Le fichier autonome ne porte ni publicité ni
police web, et ne fait aucune requête.

Les données de tournois viennent de l'API publique Fortnite
d'[Osirion](https://osirion.gg).

## Le construire

`python build.py` écrit tout ce que l'hébergeur sert à partir de ce dossier,
bibliothèque standard seulement :

| depuis | vers |
|---|---|
| `src/app.html` + `model.json` + `calendar.js` | `index.html` + `model.js`, et `standalone.html` |
| `src/site/pages/en/*.html`, `src/site/pages/fr/*.html` | les guides, la semaine, la méthode, à propos, contact, confidentialité — un dossier par page, `fr/` pour le français |
| `src/site/site.css`, `src/site/site.js` | les deux mêmes fichiers, partagés par ces pages |
| tout ce qui précède | `sitemap.xml`, `robots.txt`, `404.html`, `privacy.html` (qui renvoie désormais à `privacy/`) |

Une page de `src/site/pages/` est un fragment HTML derrière un court en-tête
JSON (son adresse, son titre, sa description, et la page dont elle est la
traduction). Les chiffres de sa prose ne sont pas tapés : `{{model_ape}}`,
`{{pace_open 0.5}}` ou `<!--data:region_chart {"rank": "100"}-->` sont lus dans le
modèle et le calendrier à chaque construction, pour qu'un guide ne cite jamais un
chiffre que le modèle a révisé depuis. `sitegen.py` dit lesquels existent.
`python build.py --check` échoue dès qu'un fichier construit est en retard sur
ses sources.

`site.json` porte les réglages du site, tous facultatifs sauf le flux :

```json
{"live": "https://…workers.dev", "name": "Threshold Ladder",
 "url": "https://fortnitepredcomp.com", "contact": "hello@example.com"}
```

`name` est le nom du site dans chaque titre et chaque en-tête ; `url` son
adresse pour les liens canoniques et le plan du site (sans elle, le domaine de
`CNAME`) ; `contact` une adresse à laquelle écrire (sans elle, la page contact
ne propose que les tickets). Changer de nom ou de domaine, c'est ces deux lignes,
`CNAME`, le `SITE` du worker dans `worker/wrangler.toml`, et le DNS du domaine ;
les pages suivent à la construction suivante.

La liste de la semaine lit la prévision de chaque cup dans `calendar.js`, où le
`calendar_snapshot.py` du tracker l'écrit à partir du même modèle
(`export_model.calendar_forecast`, vérifié contre cette page ligne à ligne) :
la liste dit ce que dirait la page sans la faire tourner. Le workflow du dépôt
reconstruit tout toutes les trois heures avec le calendrier et publie ce qui a
changé.

---

Licence MIT. Ce projet n'a aucun lien avec Epic Games et n'utilise aucune
ressource du jeu. Portions of the materials used are trademarks and/or
copyrighted works of Epic Games, Inc. All rights reserved by Epic. This material
is not official and is not endorsed by Epic.
