import { Text, TextInput, type TextInputProps } from "@mantine/core";
import { analyserDate, decrireBornes } from "../lib/dates";

export type DateFloue = { saisie: string | null; min: string | null; max: string | null };

type Props = Omit<TextInputProps, "value" | "onChange"> & {
  value: string | null | undefined;
  onChange: (d: DateFloue) => void;
};

/** Saisie libre (« vers 1826 », « 28/11/1897 »…) avec l'interprétation affichée dessous. */
export function DateFloueInput({ value, onChange, ...props }: Props) {
  const bornes = analyserDate(value);
  const incomprise = !!value?.trim() && !bornes;
  return (
    <TextInput
      placeholder="28/11/1897, vers 1826, avant 1790…"
      {...props}
      value={value ?? ""}
      onChange={(e) => {
        const saisie = e.currentTarget.value;
        const b = analyserDate(saisie);
        onChange({ saisie: saisie || null, min: b?.min ?? null, max: b?.max ?? null });
      }}
      description={
        incomprise ? (
          <Text span size="xs" c="orange">
            Format non reconnu (conservé tel quel)
          </Text>
        ) : (
          decrireBornes(bornes)
        )
      }
    />
  );
}

/** Colonnes d'une date floue en base → patch Drizzle. */
export const patchDate = <N extends string>(nom: N, d: DateFloue) =>
  ({ [nom]: d.saisie, [`${nom}Min`]: d.min, [`${nom}Max`]: d.max }) as Record<N | `${N}Min` | `${N}Max`, string | null>;
