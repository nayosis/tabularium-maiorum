CREATE TABLE `doute` (
	`id` text PRIMARY KEY NOT NULL,
	`individu1_id` text NOT NULL,
	`individu2_id` text NOT NULL,
	`statut` text DEFAULT 'a_verifier' NOT NULL,
	`note` text,
	`tache_id` text,
	`cree_le` text DEFAULT (datetime('now')) NOT NULL,
	`cree_par` text,
	`modifie_par` text,
	`modifie_le` text,
	FOREIGN KEY (`individu1_id`) REFERENCES `individu`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`individu2_id`) REFERENCES `individu`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tache_id`) REFERENCES `tache`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `doute_paire` ON `doute` (`individu1_id`,`individu2_id`);--> statement-breakpoint
CREATE INDEX `doute_individu2_idx` ON `doute` (`individu2_id`);