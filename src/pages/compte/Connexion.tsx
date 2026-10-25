import { useState } from "react";
import { Alert, Anchor, Button, Center, Checkbox, Paper, PasswordInput, Stack, Text, TextInput, Title } from "@mantine/core";
import { connexionRoute } from "../../router";
import { connexion, installer } from "../../lib/session";
import { configuration } from "../../lib/configuration";
import { DEPOT_URL } from "../../lib/versions";

/** Pied de page : logiciel libre, lien vers le dépôt. */
function Signature() {
  return (
    <Text size="xs" c="dimmed" ta="center">
      Tabularium Maiorum {configuration().version && `${configuration().version} `}— logiciel libre ·{" "}
      <Anchor href={DEPOT_URL} target="_blank" rel="noopener noreferrer" size="xs">
        GitHub
      </Anchor>
    </Text>
  );
}

/** Seule page accessible sans compte ; au tout premier lancement, création du compte administrateur. */
export function Connexion() {
  return configuration().installe ? <FormConnexion /> : <Installation />;
}

/** Premier lancement : la personne qui installe Tabularium crée son compte (administrateur principal). */
function Installation() {
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const valider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (motDePasse !== confirmation) return setErreur("Les deux mots de passe sont différents.");
    setErreur(null);
    setEnvoi(true);
    try {
      await installer(email, motDePasse);
      location.assign("/");
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
      setEnvoi(false);
    }
  };

  return (
    <Center h="100%" bg="var(--t-fond-doux)">
      <Stack align="center" gap="sm">
      <Paper withBorder shadow="sm" p="xl" w={420} maw="calc(100% - 32px)">
        <form onSubmit={valider}>
          <Stack>
            <div>
              <Title order={2}>Bienvenue dans Tabularium Maiorum</Title>
              <Text size="sm" c="dimmed">
                Premier lancement : créez votre compte. Il sera l'administrateur principal ; vous pourrez ensuite inviter votre famille,
                en lecture ou en écriture.
              </Text>
            </div>
            {erreur && <Alert color="red">{erreur}</Alert>}
            <TextInput label="Adresse e-mail" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.currentTarget.value)} autoFocus />
            <PasswordInput
              label="Mot de passe"
              description="Au moins 10 caractères"
              autoComplete="new-password"
              required
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.currentTarget.value)}
            />
            <PasswordInput label="Confirmez le mot de passe" autoComplete="new-password" required value={confirmation} onChange={(e) => setConfirmation(e.currentTarget.value)} />
            <Button type="submit" loading={envoi}>
              Créer mon compte et commencer
            </Button>
            <Text size="xs" c="dimmed">
              L'adresse e-mail sert uniquement d'identifiant : Tabularium n'envoie aucun message.
            </Text>
          </Stack>
        </form>
      </Paper>
      <Signature />
      </Stack>
    </Center>
  );
}

function FormConnexion() {
  const { retour, email: emailInitial } = connexionRoute.useSearch();
  const [email, setEmail] = useState(emailInitial ?? "");
  const [motDePasse, setMotDePasse] = useState("");
  const [souvenir, setSouvenir] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const valider = async (e: React.FormEvent) => {
    e.preventDefault();
    setErreur(null);
    setEnvoi(true);
    try {
      await connexion(email, motDePasse, souvenir);
      // Rechargement complet : droits et données chargés pour ce compte.
      location.assign(retour && retour.startsWith("/") && !retour.startsWith("//") ? retour : "/");
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
      setEnvoi(false);
    }
  };

  return (
    <Center h="100%" bg="var(--t-fond-doux)">
      <Stack align="center" gap="sm">
      <Paper withBorder shadow="sm" p="xl" w={380}>
        <form onSubmit={valider}>
          <Stack>
            <div>
              <Title order={2}>Tabularium Maiorum</Title>
              <Text size="sm" c="dimmed">
                Les archives des ancêtres — accès réservé.
              </Text>
            </div>
            {erreur && <Alert color="red">{erreur}</Alert>}
            <TextInput label="Adresse e-mail" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.currentTarget.value)} autoFocus={!emailInitial} />
            <PasswordInput
              label="Mot de passe"
              autoComplete="current-password"
              required
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.currentTarget.value)}
              autoFocus={!!emailInitial}
            />
            <Checkbox label="Se souvenir de moi (30 jours sur cet appareil)" checked={souvenir} onChange={(e) => setSouvenir(e.currentTarget.checked)} />
            <Button type="submit" loading={envoi}>
              Se connecter
            </Button>
            <Text size="xs" c="dimmed">
              Mot de passe oublié ? Demandez un lien de réinitialisation à l'administrateur.
            </Text>
          </Stack>
        </form>
      </Paper>
      <Signature />
      </Stack>
    </Center>
  );
}
