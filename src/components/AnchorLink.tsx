import { forwardRef } from "react";
import { Anchor, type AnchorProps } from "@mantine/core";
import { createLink } from "@tanstack/react-router";

/** Lien Mantine typé pour le router (params / search vérifiés). */
const AnchorBase = forwardRef<HTMLAnchorElement, AnchorProps & React.AnchorHTMLAttributes<HTMLAnchorElement>>((props, ref) => (
  <Anchor ref={ref} {...props} />
));

export const AnchorLink = createLink(AnchorBase);
