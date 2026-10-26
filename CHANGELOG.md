# Journal des versions

Les changements notables de Tabularium Maiorum, version par version.
Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et la numérotation [SemVer](https://semver.org/lang/fr/).

## [1.8.0] — 2026-10-26

### Ajouté

- **Page « Archives »** (menu) : l'annuaire des services d'archives.
  - Les 101 départements et le site de leurs archives (adresses vérifiées ; quelques-unes restent à compléter, avec un
    renvoi vers l'annuaire de FranceArchives).
  - Les départements de votre arbre en premier, avec des liens détaillés (état civil, registres matricules,
    recensements…) pour ceux de l'auteur (49, 37, 53, 44, 92 ; portail commun 79/86).
  - Ressources nationales : FranceArchives, Mémoire des hommes, Léonore, fichier des décès INSEE, Archives nationales
    et d'outre-mer, Gallica, Geneanet, FamilySearch, Filae.
  - Chacun peut ajouter ses liens, corriger ou masquer un lien fourni (et le rétablir) ; ses choix sont gardés en base.

### Amélioré

- **Relevé contextuel** : pour la personne que l'acte concerne, l'événement de l'acte passe en premier — le décès
  pour le défunt d'un acte de décès ou de sépulture, le mariage pour les époux ; les autres dates (naissance…) vont
  dans les mentions, qui s'ouvrent d'elles-mêmes quand elles sont remplies. Les autres personnes (parents, témoins)
  gardent la naissance en premier.
- **Recopier la date de l'acte** d'un clic dans les dates du relevé (comme pour la commune).

### Corrigé

- Lien vers Mémoire des hommes : le site a changé d'adresse (memoiredeshommes.defense.gouv.fr).

### Mise à jour

- La base de données évolue (table des liens de l'annuaire) : appliqué automatiquement au démarrage.

## [1.7.0] — 2026-10-26

### Ajouté

- **Registres matricules** (service militaire) : rôle « conscrit » et, sur les relevés d'un registre matricule, une
  section « Service militaire » :
  - identification : classe, n° matricule, bureau de recrutement, canton et n° de tirage ;
  - signalement (taille, cheveux, yeux, front, nez, visage, marques particulières) et degré d'instruction ;
  - décision du conseil de révision et motif ; services, campagnes, blessures, décorations ; « Mort pour la France » ;
  - localités successives habitées (date et lieu).
- **Table alphabétique du registre matricule** (nouveau type d'index) : classe, matricule, bureau, renvoi vers la
  fiche matricule et recherche à créer.
- **Fiche** : section « Service militaire » (signalement, décision, services, localités) ; pour les morts pour la
  France, accès à Mémoire des hommes et copie du nom à y rechercher.
- **Parcours de vie** : les localités successives deviennent des étapes « Domicile », placées sur la carte quand la
  commune est connue.
- **Titres automatiques** : « Fiche matricule Nom Prénoms classe 1897 matricule 1234 bureau Angers », « Recensement
  1906 @ Brissac 49 — ménage Nom Prénoms ». Citation : « … fiche matricule n° 1234, vue 212 ».
- **Rôles selon le document** : recensements (chef de ménage, épouse, fils, fille, domestique…) et actes notariés
  (vendeur, acquéreur, testateur, légataire…).
- **Export GEDCOM** : service militaire (événement) et localités successives (résidences).

### Corrigé

- Thème sombre : fond des lignes d'index.

### Mise à jour

- La base de données évolue (nouvelle colonne sur les relevés) : appliqué automatiquement au démarrage.

## [1.6.0] — 2026-10-25

### Ajouté

- **Échange GEDCOM** avec les autres logiciels de généalogie (Geneanet, Heredis, Ancestris, Gramps, MyHeritage…),
  page Sauvegarde :
  - **Export** GEDCOM 5.5.1 : personnes, familles, dates (« vers 1826 » → ABT 1826), lieux avec coordonnées,
    professions, notes, et les sources — chaque fait cite son acte (archives, registre, cote, acte, vue, lien).
  - **Import** d'un fichier .ged (UTF-8 ou Windows-1252) : les personnes deviennent des fiches, les familles des unions
    et filiations (adoptions comprises), les lieux existants sont réutilisés ; chaque source citée devient un document
    « à transcrire », sans image, dans son registre, relié au fait et à la personne. Rien n'est fusionné : les
    ressemblances apparaissent dans « Doublons possibles ». Tout est importé en une seule transaction.

## [1.5.0] — 2026-10-25

### Ajouté

- **Doublons possibles détectés automatiquement** : Tabularium compare les fiches portant le même nom (graphies
  anciennes tolérées : Gouadon ≈ Goüaddon) et propose les paires dont les prénoms, les dates de naissance et de décès,
  le lieu de naissance et les parents sont compatibles, avec les raisons (« mêmes prénoms, naissances compatibles… »)
  et une mention « probable » ou « possible ».
  - En tête de l'onglet « Doutes » : signaler le doute, comparer et fusionner, ou écarter (« personnes
    différentes », retenu pour ne plus être proposé).
  - Frères et sœurs du même prénom (dates de naissance exactes différentes, seconds prénoms différents) ne sont pas
    proposés.
  - Compteur sur l'accueil et sur l'onglet.

## [1.4.0] — 2026-10-25

### Ajouté

- **Citations de sources** : chaque document se cite en une phrase normalisée (service d'archives, registre et
  période, cote, type et numéro de l'acte, date, vue, lien en ligne), prête à coller dans un courriel, un forum ou un
  autre logiciel.
  - Bouton « Copier la citation » dans l'atelier et la visionneuse du téléphone.
  - Bloc « Sources » sur la fiche : la source de la naissance, de chaque mariage et du décès, puis les autres
    documents où la personne apparaît, avec son rôle ; copie d'une citation ou de toutes.
  - Astuce : renseigner le service d'archives et la cote du registre (page du registre) complète toutes les citations.

## [1.3.0] — 2026-10-25

### Ajouté

- **Recherche globale** : <kbd>Ctrl</kbd>+<kbd>K</kbd> (<kbd>⌘</kbd>+<kbd>K</kbd> sur Mac) ou <kbd>/</kbd>, depuis
  n'importe quelle page : personnes, documents, registres et albums, lieux, recherches et pages, groupés et triés
  par pertinence ; flèches pour choisir, Entrée pour ouvrir. Aussi par le champ « Rechercher… » en haut du menu, la
  loupe sur tablette et le menu du téléphone.

## [1.2.0] — 2026-10-25

### Ajouté

- **Thème sombre** : clair, sombre ou automatique (selon le système), au choix dans le menu du compte ; mémorisé sur
  l'appareil. L'arbre, la frise, l'atelier et toutes les pages suivent le thème.
- **Nouvelle version disponible** : Tabularium consulte la page des versions du dépôt GitHub (au plus deux fois par
  jour, sans rien transmettre) et prévient les administrateurs sur l'accueil et dans le menu, avec la marche à
  suivre selon l'installation (serveur Docker, ordinateur, sources). Désactivable.
- **À propos** (page Présentation) : auteur, développement avec Claude (Anthropic) sous la supervision de l'auteur,
  version utilisée, liens vers le code source, les versions et le signalement des problèmes.
- Lien vers le dépôt GitHub dans le menu du compte et en pied de la page de connexion.

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

[1.8.0]: https://github.com/nayosis/tabularium-maiorum/compare/v1.7.0...v1.8.0
[1.7.0]: https://github.com/nayosis/tabularium-maiorum/compare/v1.6.0...v1.7.0
[1.6.0]: https://github.com/nayosis/tabularium-maiorum/compare/v1.5.0...v1.6.0
[1.5.0]: https://github.com/nayosis/tabularium-maiorum/compare/v1.4.0...v1.5.0
[1.4.0]: https://github.com/nayosis/tabularium-maiorum/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/nayosis/tabularium-maiorum/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/nayosis/tabularium-maiorum/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/nayosis/tabularium-maiorum/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/nayosis/tabularium-maiorum/releases/tag/v1.0.0
