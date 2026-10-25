import { Elysia, t } from "elysia";
import { existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { DOSSIER_CLIENT, VERSION } from "./config";
import { exiger, routesAuth } from "./auth";
import { ErreurMetier } from "./erreurs";
import { cheminImage } from "./fichiers";
import { executerRpc, FONCTIONS } from "./rpc";
import { fluxSauvegarde, manifeste, nomSauvegarde, restaurer, tailleDonnees } from "./sauvegarde";
import { baseCourante } from "./base";
import { diffuser, fluxEvenements } from "./evenements";
import { journaliser, lireJournal } from "./journal";
import { etatMiseAJour } from "./miseAJour";
import { contexteRequete } from "./tracabilite";
import { Conflit } from "../src/lib/conflit";

export { ErreurMetier };

const EXTENSIONS_IMAGE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/bmp": "bmp",
};
const TAILLE_MAX_IMAGE = 50 * 1024 * 1024;

export function creerApp() {
  return (
    // Restauration : une sauvegarde complète (base + images) peut peser lourd.
    new Elysia({ serve: { maxRequestBodySize: 4 * 1024 ** 3 } })
      .onError(({ code, error, set }) => {
        if (error instanceof ErreurMetier) {
          set.status = error.statut;
          return { erreur: error.message, details: error.details };
        }
        if (error instanceof Conflit) {
          set.status = 409;
          return { erreur: error.message, details: { par: error.par, le: error.le } };
        }
        if (code === "VALIDATION") {
          set.status = 422;
          return { erreur: "Requête invalide" };
        }
        if (code === "NOT_FOUND") {
          set.status = 404;
          return { erreur: "Introuvable" };
        }
        const message = error instanceof Error ? error.message : String(error);
        console.error(error);
        set.status = 500;
        return { erreur: message };
      })

      // --- Santé (contrôle Docker) : ne révèle rien
      .get("/api/sante", () => ({ ok: true, version: VERSION }))

      // --- Connexion, liens, comptes ; utilisateur de la session pour toutes les routes suivantes
      .use(routesAuth)

      // --- Nouvelle version disponible ? (compte connecté)
      .get("/api/mise-a-jour", ({ utilisateur }) => {
        exiger(utilisateur, "lecture");
        return etatMiseAJour();
      })

      // --- Fonctions métier : lecture pour tout compte connecté, écriture selon le rôle
      .post(
        "/api/rpc/:nom",
        async ({ params, body, utilisateur, request }) => {
          const f = FONCTIONS.get(params.nom);
          const u = exiger(utilisateur, f?.droit === "lecture" ? "lecture" : "ecriture");
          if (!f) throw new ErreurMetier(`Fonction inconnue : ${params.nom}`, 404);
          // Identifiant de l'onglet appelant : il ne se recharge pas pour ses propres écritures.
          const client = request.headers.get("x-client") ?? undefined;
          const resultat = await contexteRequete.run({ utilisateur: u.email, client }, () => executerRpc(params.nom, body.args));
          if (f.droit === "ecriture") {
            journaliser(u.email, params.nom, body.args, resultat);
            diffuser({ type: "modification", par: u.email, fonction: params.nom, client });
          }
          return { resultat };
        },
        { body: t.Object({ args: t.Array(t.Unknown()) }) },
      )

      // --- Images
      .post(
        "/api/images",
        async ({ body, utilisateur }) => {
          exiger(utilisateur, "ecriture");
          const fichier = body.fichier;
          const ext = EXTENSIONS_IMAGE[fichier.type];
          if (!ext) throw new ErreurMetier("Seules les images (jpg, png, webp, gif, bmp) sont acceptées.");
          if (fichier.size > TAILLE_MAX_IMAGE) throw new ErreurMetier("Image trop lourde (50 Mo au plus).");
          const nom = `${crypto.randomUUID()}.${ext}`;
          await Bun.write(cheminImage(nom), fichier);
          return { fichier: nom };
        },
        { body: t.Object({ fichier: t.File() }) },
      )
      .get("/api/images/:nom", ({ params, set, utilisateur }) => {
        exiger(utilisateur, "lecture");
        const chemin = cheminImage(params.nom);
        if (!existsSync(chemin)) throw new ErreurMetier("Image introuvable", 404);
        // Les images ne changent jamais (nom unique) : cache long, mais privé.
        set.headers["cache-control"] = "private, max-age=31536000, immutable";
        return Bun.file(chemin);
      })

      // --- Mise à jour en direct et journal des modifications
      .get("/api/evenements", ({ utilisateur, request }) => {
        exiger(utilisateur, "lecture");
        return new Response(fluxEvenements(request.signal), {
          headers: { "content-type": "text/event-stream", "cache-control": "no-cache", "x-accel-buffering": "no" },
        });
      })
      .get(
        "/api/journal",
        ({ utilisateur, query }) => {
          exiger(utilisateur, "admin");
          return { lignes: lireJournal({ utilisateur: query.utilisateur, depuis: query.depuis, avant: query.avant ? Number(query.avant) : undefined }) };
        },
        { query: t.Object({ utilisateur: t.Optional(t.String()), depuis: t.Optional(t.String()), avant: t.Optional(t.String()) }) },
      )

      // --- Sauvegardes : téléchargement (admins), restauration (super admin)
      .get("/api/sauvegarde/infos", ({ utilisateur }) => {
        exiger(utilisateur, "admin");
        return { compteurs: manifeste(baseCourante(), "infos").compteurs, taille: tailleDonnees() };
      })
      .get("/api/sauvegarde", ({ utilisateur }) => {
        exiger(utilisateur, "admin");
        return new Response(fluxSauvegarde(), {
          headers: {
            "content-type": "application/zip",
            "content-disposition": `attachment; filename="${nomSauvegarde()}"`,
            "cache-control": "no-store",
          },
        });
      })
      .post(
        "/api/sauvegarde/restaurer",
        async ({ utilisateur, body }) => {
          const u = exiger(utilisateur, "admin");
          if (!u.super) throw new ErreurMetier("Seul le super admin peut restaurer une sauvegarde.", 403);
          try {
            const r = await restaurer(body.fichier);
            diffuser({ type: "restauration", par: u.email });
            return r;
          } catch (e) {
            throw new ErreurMetier((e as Error).message);
          }
        },
        { body: t.Object({ fichier: t.File() }) },
      )

      // --- Front compilé (production) : fichiers, sinon index.html pour le routeur
      .get("/*", ({ path, set }) => {
        if (path.startsWith("/api/")) throw new ErreurMetier("Introuvable", 404);
        const fichier = normalize(join(DOSSIER_CLIENT, decodeURIComponent(path)));
        if (fichier.startsWith(DOSSIER_CLIENT) && extname(fichier) && existsSync(fichier)) {
          if (path.startsWith("/assets/")) set.headers["cache-control"] = "public, max-age=31536000, immutable";
          return Bun.file(fichier);
        }
        const index = join(DOSSIER_CLIENT, "index.html");
        if (!existsSync(index)) throw new ErreurMetier("Front non compilé (bun run build)", 404);
        set.headers["cache-control"] = "no-cache";
        return Bun.file(index);
      })
  );
}
