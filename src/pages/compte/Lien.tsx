import { useState } from "react";
import { Alert, Button, Center, Loader, Paper, PasswordInput, Stack, Text, Title } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { lienRoute } from "../../router";
import { appelApi } from "../../lib/rpc";

const LONGUEUR_MIN = 10;

/** Lien transmis par un administrateur : choisir (création) ou changer (réinitialisation) son mot de passe. */
export function Lien() {
  const { jeton } = lienRoute.useParams();
  const { data, error, isLoading } = useQuery({
    queryKey: ["lien", jeton],
    queryFn: () => appelApi<{ type: "creation" | "reinitialisation"; email: string }>(`/api/liens/${encodeURIComponent(jeton)}`),
    retry: false,
  });
  const [mdp, setMdp] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const valider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mdp !== confirmation) return setErreur("Les deux mots de passe ne sont pas identiques.");
    setEnvoi(true);
    setErreur(null);
    try {
      const { email } = await appelApi<{ email: string }>(`/api/liens/${encodeURIComponent(jeton)}`, { corps: { motDePasse: mdp } });
      location.assign(`/connexion?email=${encodeURIComponent(email)}`);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
      setEnvoi(false);
    }
  };

  return (
    <Center h="100%" bg="var(--t-fond-doux)">
      <Paper withBorder shadow="sm" p="xl" w={420}>
        {isLoading ? (
          <Center>
            <Loader />
          </Center>
        ) : error || !data ? (
          <Stack>
            <Title order={3}>Lien non valable</Title>
            <Alert color="orange">{error instanceof Error ? error.message : "Ce lien n'est plus valable."}</Alert>
            <Text size="sm">Les liens servent une seule fois et expirent après 48 heures. Demandez-en un nouveau à l'administrateur.</Text>
          </Stack>
        ) : (
          <form onSubmit={valider}>
            <Stack>
              <div>
                <Title order={3}>{data.type === "creation" ? "Bienvenue sur Tabularium" : "Nouveau mot de passe"}</Title>
                <Text size="sm" c="dimmed">
                  {data.type === "creation" ? "Choisissez le mot de passe de votre compte" : "Choisissez un nouveau mot de passe pour"} <b>{data.email}</b>.
                </Text>
              </div>
              {erreur && <Alert color="red">{erreur}</Alert>}
              <PasswordInput
                label="Mot de passe"
                description={`${LONGUEUR_MIN} caractères au moins ; une phrase facile à retenir fait très bien l'affaire.`}
                autoComplete="new-password"
                required
                minLength={LONGUEUR_MIN}
                value={mdp}
                onChange={(e) => setMdp(e.currentTarget.value)}
                autoFocus
              />
              <PasswordInput
                label="Confirmation"
                autoComplete="new-password"
                required
                value={confirmation}
                onChange={(e) => setConfirmation(e.currentTarget.value)}
              />
              <Button type="submit" loading={envoi} disabled={mdp.length < LONGUEUR_MIN}>
                Enregistrer le mot de passe
              </Button>
            </Stack>
          </form>
        )}
      </Paper>
    </Center>
  );
}
