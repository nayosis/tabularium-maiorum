# Journal des versions

Les changements notables de Tabularium Maiorum, version par version.
Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et la numérotation [SemVer](https://semver.org/lang/fr/).

## [1.1.0] — 2026-10-25

### Ajouté

- **« Peut-être la même personne »** : marquer deux fiches entre lesquelles on hésite, sans les fusionner.
  - Sur la fiche : bouton « Peut-être la même personne… », puis un encart qui présente l'autre fiche (dates, lieux,
    nombre de relevés), la note expliquant le doute, qui l'a signalé et quand.
  - Actions : comparer côte à côte et fusionner (la fenêtre de fusion s'ouvre avec l'autre fiche déjà choisie),
    « personnes différentes » (la vérification est gardée avec sa note et peut être rouverte), créer une recherche
    pour lever le doute, retirer un doute signalé par erreur.
  - Page Individus : onglet « Doutes » avec les paires côte à côte, filtre par statut et par nom ; icône ⚠ sur les
    fiches concernées.
  - Accueil : nombre de doutes à lever. Fiche mobile et journal des modifications.
  - Une fusion lève le doute entre les deux fiches et reporte leurs autres doutes sur la fiche conservée.

### Corrigé

- Page Individus : le champ de recherche filtre aussi l'onglet « Relevés à rattacher » (nom, prénoms, document) ;
  l'onglet affiche « n / total » quand un filtre est actif.

### Mise à jour

- La base de données évolue (nouvelle table des doutes) : la mise à jour s'applique toute seule au démarrage.
  Télécharger une sauvegarde avant, par précaution.

## [1.0.0] — 2026-10-22

Première version publique.

- **Documents** : actes, tables décennales et photos de famille, rangés par registre ou album ; capture au téléphone
  aux archives.
- **Atelier d'annotation** : zones surlignées sur l'image, relevés tels qu'écrits, bulles numérotées.
  - Alt+clic (ou le bouton « retirer un rectangle ») retire un rectangle d'une zone ; sur le dernier rectangle, on
    propose de supprimer la zone.
  - Numéros posés sur les zones masquables quand ils cachent le texte (menu « Flèches et numéros »).
  - Titre automatique des documents ; pour un mariage : « Acte mariage Époux et Épouse date @ lieu ».
- **Individus** : fiches construites à partir des relevés, synthèse des sources, suggestions de rattachement, fusion
  de doublons.
- **Arbre** (ascendance seule possible), **cartographie** par génération avec animation dans le temps, **parcours de
  vie** sur carte.
- **Photos** : identification des personnes, portraits.
- **Recherches** : pistes à suivre et consultations aux archives.
- **Accueil** : tableau de bord de la recherche ; page de **présentation** de l'outil.
- **À plusieurs** : comptes lecture / écriture / admin, mises à jour en direct, journal, détection des conflits.
- **Téléphone et tablette** : écrans adaptés, installation sur l'écran d'accueil.
- **Installation** : version ordinateur (Windows, macOS, Linux) ou serveur Docker (amd64, arm64) ; compte
  administrateur créé au premier lancement.

[1.1.0]: https://github.com/nayosis/tabularium-maiorum/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/nayosis/tabularium-maiorum/releases/tag/v1.0.0
