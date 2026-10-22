import { Button, Center, Stack, Text, Title } from "@mantine/core";
import { IconDeviceDesktop } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";

/** Page trop complexe pour un téléphone : invitation à passer sur ordinateur ou tablette. */
export function SurOrdinateur({ titre }: { titre: string }) {
  return (
    <Center h="100%" p="lg">
      <Stack align="center" gap="sm" maw={320}>
        <IconDeviceDesktop size={48} color="var(--mantine-color-gray-5)" />
        <Title order={3} ta="center">
          {titre}
        </Title>
        <Text ta="center" c="dimmed" size="sm">
          Cette page s'utilise sur un ordinateur ou une tablette.
        </Text>
        <Button component={Link} to="/" variant="light">
          Retour à l'accueil
        </Button>
      </Stack>
    </Center>
  );
}
