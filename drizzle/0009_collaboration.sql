CREATE TABLE `journal` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`quand` text NOT NULL,
	`utilisateur` text NOT NULL,
	`fonction` text NOT NULL,
	`cible` text,
	`resume` text
);
--> statement-breakpoint
CREATE INDEX `journal_quand_idx` ON `journal` (`quand`);--> statement-breakpoint
CREATE INDEX `journal_utilisateur_idx` ON `journal` (`utilisateur`);--> statement-breakpoint
ALTER TABLE `acte` ADD `cree_par` text;--> statement-breakpoint
ALTER TABLE `acte` ADD `modifie_par` text;--> statement-breakpoint
ALTER TABLE `acte` ADD `modifie_le` text;--> statement-breakpoint
ALTER TABLE `annotation` ADD `cree_par` text;--> statement-breakpoint
ALTER TABLE `annotation` ADD `modifie_par` text;--> statement-breakpoint
ALTER TABLE `annotation` ADD `modifie_le` text;--> statement-breakpoint
ALTER TABLE `consultation` ADD `cree_par` text;--> statement-breakpoint
ALTER TABLE `consultation` ADD `modifie_par` text;--> statement-breakpoint
ALTER TABLE `consultation` ADD `modifie_le` text;--> statement-breakpoint
ALTER TABLE `couple` ADD `cree_par` text;--> statement-breakpoint
ALTER TABLE `couple` ADD `modifie_par` text;--> statement-breakpoint
ALTER TABLE `couple` ADD `modifie_le` text;--> statement-breakpoint
ALTER TABLE `filiation` ADD `cree_par` text;--> statement-breakpoint
ALTER TABLE `filiation` ADD `modifie_par` text;--> statement-breakpoint
ALTER TABLE `filiation` ADD `modifie_le` text;--> statement-breakpoint
ALTER TABLE `individu` ADD `cree_par` text;--> statement-breakpoint
ALTER TABLE `individu` ADD `modifie_par` text;--> statement-breakpoint
ALTER TABLE `individu` ADD `modifie_le` text;--> statement-breakpoint
ALTER TABLE `lieu` ADD `cree_par` text;--> statement-breakpoint
ALTER TABLE `lieu` ADD `modifie_par` text;--> statement-breakpoint
ALTER TABLE `lieu` ADD `modifie_le` text;--> statement-breakpoint
ALTER TABLE `releve` ADD `cree_par` text;--> statement-breakpoint
ALTER TABLE `releve` ADD `modifie_par` text;--> statement-breakpoint
ALTER TABLE `releve` ADD `modifie_le` text;--> statement-breakpoint
ALTER TABLE `source` ADD `cree_par` text;--> statement-breakpoint
ALTER TABLE `source` ADD `modifie_par` text;--> statement-breakpoint
ALTER TABLE `source` ADD `modifie_le` text;--> statement-breakpoint
ALTER TABLE `tache` ADD `cree_par` text;--> statement-breakpoint
ALTER TABLE `tache` ADD `modifie_par` text;--> statement-breakpoint
ALTER TABLE `tache` ADD `modifie_le` text;