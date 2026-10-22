CREATE TABLE `consultation` (
	`id` text PRIMARY KEY NOT NULL,
	`tache_id` text NOT NULL,
	`source_id` text,
	`date` text NOT NULL,
	`resultat` text DEFAULT 'rien' NOT NULL,
	`notes` text,
	`cree_le` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`tache_id`) REFERENCES `tache`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_id`) REFERENCES `source`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `consultation_tache_idx` ON `consultation` (`tache_id`);--> statement-breakpoint
CREATE INDEX `consultation_source_idx` ON `consultation` (`source_id`);--> statement-breakpoint
ALTER TABLE `source` ADD `url` text;--> statement-breakpoint
ALTER TABLE `tache` ADD `type` text;