---
name: nr-data
description: Interroger, diagnostiquer et vérifier les données BattleScribe / New Recruit (.gst/.cat/.json) de n'importe quel système de jeu (t9a, The Old World, 40k…) avec l'éditeur NR sans fenêtre (`nr`, le moteur réel de l'éditeur en ligne de commande). À utiliser dès qu'il faut localiser une entrée, lire ce qu'elle fait vraiment (liens résolus, modifiers qui la touchent), lister les erreurs de l'éditeur, comparer deux catalogues, ou vérifier qu'une édition de données n'a rien cassé. Une skill propre à un système (ex. t9a-bsdata-edit) s'appuie dessus et ajoute les sources et conventions du jeu.
---

# Données BattleScribe / NR avec l'éditeur sans fenêtre

`nr` charge un dossier de système **avec le code de l'éditeur NR lui-même** (store, liens résolus,
index de références, diagnostics) et expose **les mêmes outils que le MCP de l'éditeur ouvert dans
le navigateur** (`nr_find`, `nr_read`, `nr_diagnosis`…). Ce qu'il dit est ce que l'utilisateur
verrait dans l'éditeur. Il ne remplace pas la connaissance du jeu : une skill propre au système
fournit les sources de vérité, le modèle de données et les recettes.

```bash
NR=/home/vflam/projects/nr-editor/headless/nr
```

Code : `nr-editor/headless/` (`nr.ts` = CLI, `env.ts` = démarrage de l'éditeur dans Node). Les outils
viennent de `nr-editor/assets/editor/mcp_tools.ts` : y corriger un outil le corrige aussi dans le navigateur.

## 0. Choisir le système

`nr` prend le dossier `--system <dossier>`, sinon `$NR_SYSTEM`, sinon le dossier courant ou le premier
parent qui contient un `.gst` / `.gamesystem.json`. Tout le système est chargé à chaque appel
(t9a ≈ 1 s, TOW ≈ 3 s, 40k ≈ 5 s) : **grouper les questions avec `batch`**.

Un `catalogueLink` vers un fichier absent fait échouer le chargement (« Couldn't import catalogue… »),
comme dans l'éditeur : c'est une donnée cassée à signaler, pas un problème d'outil.

## 1. Avant la première question : la doc

```bash
$NR docs                       # note HEADLESS + briefing + index des pages
$NR conventions                # comment CE système écrit ses données, avec exemples réels
$NR docs editor/evaluation     # comment le builder évalue (scopes, instanceOf, repeats…)
$NR docs guide/concepts/modifiers   # wiki officiel, récupéré en direct
$NR help <outil>               # description complète + arguments d'un outil
```
Le briefing a été écrit pour l'éditeur ouvert (fenêtre, `nr_load_system`, `nr_save`). Ici, pas de
fenêtre, le système est déjà chargé, et **rien n'est jamais enregistré**.

## 2. Localiser, puis ouvrir

```bash
$NR find 'Sword Masters'  --catalogue 'Highborn Elves' --limit 20
$NR find 'is:entry name="Sword Masters"'               # exact ; ":" = sous-chaîne, "=" = exact
$NR find 'targetId:<id>'                               # tous les liens vers <id> (= "qui pointe ici")
$NR find 'is:constraint has*:...' / 'mentions:*[id:<id>]' # voir `nr help find`
$NR read <id>                       # ce que fait le nœud : modifiedBy, target, flags, refs, mentions
$NR read <id> --raw true            # forme exacte du fichier, à copier pour en écrire un pareil
$NR read <id> --catalogue <nom>     # un id peut exister dans plusieurs fichiers
```
**Une ligne de `find` localise, elle ne dit pas ce que fait le nœud** : un `max 0` est souvent relevé
par un modifier, un lien est surtout sa cible. Toujours `read` ce qu'on juge ou qu'on va modifier.

Vue d'ensemble d'une unité, ou toute question qu'aucun outil ne couvre : `eval` (corps de fonction
async, `return` obligatoire ; API dans `$NR docs editor/eval`).
```bash
$NR eval 'return tree(find("is:entry name=Minotaurs", "Beast Herds")[0], {depth: 3})'
$NR eval 'return json(find("is:entry name=Minotaurs")[0], {depth: 2})'
$NR eval 'return [1,2,3,4,5].map(() => $helpers.generateBattlescribeId())'   # nouveaux ids
$NR eval - < question.js            # code long : depuis stdin (ou --file question.js)
```

Plusieurs questions sur un seul chargement (une commande par ligne, même syntaxe, `#` = commentaire) :
```bash
$NR batch <<'EOF'
find 'name="Totem Bearer"' --limit 5
read 7adf-3ff0-8664-b551
diagnosis --catalogue 'Beast Herds'
EOF
```

## 3. Diagnostics : le test d'une édition

```bash
$NR diagnosis                              # tout ce que l'éditeur signale (liens morts, ids dupliqués, scopes invalides…)
$NR diagnosis --catalogue <nom> --limit 200
$NR diagnosis --only '["unused"]'          # règles optionnelles, à la demande (bruyantes)
$NR diff <catalogue> <autre>               # deux catalogues unité par unité
```
Ça marche **par paire** : relever le résultat **avant** l'édition, relancer **après**. Tout nouveau
diagnostic vient de l'édition. Les diagnostics ne voient pas une **valeur** fausse (45 pts au lieu de
54) : ça, c'est la source du jeu qui le dit.

## 4. Éditer (`nr` ne sauvegarde pas encore)

`nr` est en lecture seule : `eval` peut appeler les actions d'écriture de l'éditeur (`set_field`,
`add`, `merge`, `remove`…), mais le résultat vit en mémoire et disparaît à la fin du processus
(le CLI le rappelle). Usage utile : **essayer** une édition en mémoire et lire le delta de
diagnostics (`errors: {new, fixed}`) avant de l'écrire pour de bon.

L'écriture se fait sur les fichiers :
- une valeur, un texte : `Edit` direct du fichier, en respectant sa mise en forme ;
- plusieurs changements ou une structure : un script, selon les outils de la skill du système ;
- incrémenter `revision` du fichier modifié (une fois par session d'édition) ;
- nouvel id : `generateBattlescribeId()` (voir plus haut), jamais inventé à la main.

Puis vérifier :
```bash
$NR diagnosis                              # pas plus de diagnostics qu'avant
$NR reformat --catalogue <nom>             # "same" = le fichier est toujours au format de l'éditeur
git -C <dossier> diff --stat               # le diff ne contient que l'édition (+ revision)
```

### Format sur disque

Les fichiers sont au format de sauvegarde de l'éditeur (`rootToJson` → `compactStringify` pour le JSON,
XML pour .cat/.gst). `$NR reformat` (simulation) montre, fichier par fichier, ce qu'une sauvegarde de
l'éditeur changerait : `same`, `layout` (mise en page seule) ou `CONTENT` (données, regroupées par clé).
`--write` réécrit les fichiers `layout` ; `--force` aussi les `CONTENT`, après lecture du rapport.
Un fichier avec des modifications non commitées n'est jamais touché. À l'enregistrement, l'éditeur
renomme aussi chaque lien d'après sa cible (`updateLink`) : le nom affiché d'un lien vient d'un
modifier `set name`, pas du nom du lien.

## 5. Rendre compte

- Pour chaque changement : fichier, entrée (nom + id), ancienne valeur → nouvelle valeur.
- Diagnostics avant / après (nombre, et toute nouvelle entrée).
- Ce qui n'a pas été fait et pourquoi (source ambiguë, décision à prendre).
- Ne pas commiter ni pousser sans demande explicite.
- Si un outil `nr` a manqué ou gêné, le dire : les outils sont faits à partir de cette liste.
