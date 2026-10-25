# Les données de Tabularium

## Où sont-elles ?

| Installation | Dossier |
|---|---|
| Ordinateur (Windows, macOS) | `Documents/Tabularium` |
| Ordinateur (Linux) | `~/Tabularium` |
| Docker | le volume monté sur `/data` (par défaut `./data` à côté de `docker-compose.yml`) |
| Développement | `data/` dans le dépôt |

Contenu du dossier :

- `donnees.db` : la généalogie (documents, relevés, individus, lieux, recherches…) ;
- `images/` : les images des documents et des photos ;
- `comptes.db` : comptes, sessions et liens.

## Sauvegarder

- **Depuis l'application** (admins) : page Sauvegarde → télécharger un ZIP. Il contient `donnees.db` et les
  images, **pas** les comptes : on peut le confier sans exposer les mots de passe.
- **En plus**, sauvegarder le dossier de données entier avec les sauvegardes habituelles de la machine
  (Tabularium arrêté, ou depuis un ZIP récent).

## Restaurer, ou changer d'installation

Pour passer de la version ordinateur à un serveur (ou l'inverse) :

1. sur l'ancienne installation, page Sauvegarde → télécharger le ZIP ;
2. sur la nouvelle, connecté avec le compte administrateur principal : Sauvegarde → « Restaurer une sauvegarde ».

Les comptes ne sont pas transférés : les recréer sur la nouvelle installation. La base remplacée est conservée
dans `donnees.db.avant-restauration`.

## Échanger avec d'autres logiciels (GEDCOM)

Page Sauvegarde → « Échanger avec d'autres logiciels » :

- **Exporter en GEDCOM** produit un fichier `.ged` (GEDCOM 5.5.1, UTF-8) lisible par Geneanet, Heredis, Ancestris,
  Gramps, MyHeritage… Chaque fait (naissance, mariage, décès) cite son acte : archives, registre, cote, vue, lien.
- **Importer un fichier GEDCOM** ajoute les personnes comme nouvelles fiches, avec leurs familles. Chaque source citée
  devient un document « à transcrire » (sans image) dans son registre : il suffit ensuite d'y ajouter l'image de l'acte.
  Rien n'est fusionné : vérifier ensuite Individus → Doutes → « Doublons possibles ».

Le GEDCOM ne remplace pas la sauvegarde : il ne contient ni les images, ni les zones annotées, ni les relevés.

## Mises à jour

Les données ne sont jamais touchées par une mise à jour du programme. Au démarrage, Tabularium applique
automatiquement les évolutions de la base (migrations). Avant une mise à jour importante, télécharger une
sauvegarde par précaution.
