# Contribuer à Tabularium

Merci de votre intérêt ! Tabularium est développé en français (interface, code, commentaires).

## Signaler un problème, proposer une idée

Ouvrir une *issue* sur GitHub, en décrivant ce que vous faisiez, ce qui s'est passé et ce que vous attendiez.
Ne joignez jamais de données personnelles de votre arbre (personnes vivantes, adresses…).

## Lancer Tabularium en développement

Prérequis : [Bun](https://bun.sh) 1.3 ou plus.

```bash
bun install
bun run dev               # interface : http://localhost:5173 (API sur le port 3210)
bun test                  # tests (données, comptes, droits, sauvegardes, collaboration…)
bun run type-check
bun run db:generate       # après modification de src/db/schema.ts → nouvelle migration dans drizzle/
```

Au premier lancement, l'interface propose de créer le compte administrateur (données dans `data/`).
On peut aussi le définir dans un fichier `.env` (voir `.env.exemple`).

## Architecture

```
Source (registre) → Page (image) ↔ Acte → Relevé (personne telle qu'écrite) → Individu (conclusion)
                                   └→ Annotation (zone surlignée + bulle)
```

- Un « document » a une **nature** : *acte*, *index* (page de table décennale…) ou *photo*.
- Dates floues : saisie d'origine (« vers 1826 ») + bornes ISO min/max calculées (`src/lib/dates.ts`).
- Le navigateur appelle les fonctions de `src/data/` **par leur nom** (`POST /api/rpc/:fonction`) ; elles
  s'exécutent sur le serveur. Le plugin Vite (`vite.config.ts`) remplace ces modules par des appels réseau
  dans l'interface. Droits par fonction : `serveur/rpc.ts` (lecture / écriture). `src/data/` ne contient que
  des fonctions serveur ; les constantes et outils purs vont dans `src/lib/`.
- `serveur/` : Bun + Elysia + SQLite — `auth.ts` / `comptes.ts` (sessions, rôles, liens, installation),
  `sauvegarde.ts`, `tracabilite.ts` (créé / modifié par), `journal.ts`, `evenements.ts` (mise à jour en direct).
- `src/data/version.ts` : détection des conflits (deux personnes sur la même fiche).
- Interface : React, Mantine, TanStack Router et Query, Leaflet. `useEcran()` (`src/lib/ecran.ts`) distingue
  téléphone, tablette et ordinateur.

## Proposer une modification

1. Une modification = un sujet. Ajouter ou adapter les tests (`tests/`).
2. Vérifier `bun run type-check` et `bun test`.
3. Ouvrir une *pull request* en expliquant le besoin.

En contribuant, vous acceptez que votre contribution soit publiée sous la licence du projet (AGPL-3.0).
