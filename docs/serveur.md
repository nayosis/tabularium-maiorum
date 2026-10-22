# Installer Tabularium sur un serveur (Docker)

Pour une famille ou une association qui veut accéder à Tabularium depuis partout : un NAS, un Raspberry Pi, un
petit serveur ou un VPS avec Docker. L'image fonctionne sur PC (amd64) et ARM (arm64).

## Démarrer

```bash
mkdir tabularium && cd tabularium
curl -O https://raw.githubusercontent.com/nayosis/tabularium-maiorum/main/docker-compose.yml
docker compose up -d
docker compose logs -f        # « Tabularium : http://localhost:3000 »
```

Ouvrir `http://<adresse-du-serveur>:3000` : au premier lancement, Tabularium demande de créer le compte
administrateur principal. Les données sont dans le dossier `./data`, à côté de `docker-compose.yml`.

Réglages facultatifs dans un fichier `.env` à côté de `docker-compose.yml` (modèle : `.env.exemple`) :

| Variable | Rôle |
|---|---|
| `TABULARIUM_PORT` | port de la machine (3000 par défaut) |
| `TABULARIUM_VERSION` | version de l'image (`latest` par défaut, ou `1.2` pour rester en 1.2.x) |
| `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_MOT_DE_PASSE` | administrateur principal défini ici plutôt qu'à l'écran ; mot de passe remis à jour au démarrage |
| `TABULARIUM_TUILES`, `TABULARIUM_TUILES_ATTRIBUTION` | autre fournisseur de tuiles pour les cartes (modèle d'URL Leaflet et mention à afficher) |
| `TZ` | fuseau horaire (`Europe/Paris` par défaut) |

## Accès depuis Internet : HTTPS obligatoire

Les mots de passe et le cookie de session doivent circuler chiffrés. Placer Tabularium derrière un reverse proxy
qui gère le certificat (Let's Encrypt) et renvoie vers `http://<serveur>:3000`. Trois points à respecter :

1. transmettre `X-Forwarded-Proto: https` et `X-Forwarded-For` (le cookie est alors marqué `Secure`) ;
2. ne pas mettre en mémoire tampon `/api/evenements` (mises à jour en direct, Server-Sent Events) ;
3. accepter de grosses requêtes pour la restauration d'une sauvegarde (2 Go par exemple).

### Nginx Proxy Manager

- *Proxy Host* : domaine → `http`, IP du serveur, port 3000 ; cocher *Websockets Support* et *Block Common Exploits*.
- Onglet *SSL* : demander un certificat Let's Encrypt, cocher *Force SSL* et *HTTP/2*.
- Onglet *Advanced* :

  ```nginx
  client_max_body_size 2g;
  proxy_read_timeout 300s;
  location /api/evenements {
      proxy_pass http://IP_DU_SERVEUR:3000;
      proxy_set_header Host $host;
      proxy_set_header X-Forwarded-Proto $scheme;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_buffering off;
      proxy_read_timeout 1h;
  }
  ```

### nginx

Exemple complet : [`docker/nginx-exemple.conf`](../docker/nginx-exemple.conf).

### Caddy

```caddy
genealogie.example.org {
    request_body {
        max_size 2GB
    }
    reverse_proxy 127.0.0.1:3000 {
        flush_interval -1
    }
}
```

## Mettre à jour

```bash
docker compose pull && docker compose up -d
```

Les données ne sont pas touchées ; les évolutions de la base s'appliquent au démarrage. Télécharger une
sauvegarde avant une mise à jour importante.

## Sauvegarder

Voir [donnees.md](donnees.md) : sauvegarde ZIP depuis l'application, et sauvegarde du dossier `./data` avec
celles de la machine.

## Construire l'image soi-même

Dans les sources : décommenter `build: .` dans `docker-compose.yml`, puis `docker compose up -d --build`.
