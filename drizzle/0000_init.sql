CREATE TABLE `presets` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`params` text NOT NULL,
	`inserted_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `presets_name_unique` ON `presets` (`name`);--> statement-breakpoint
CREATE TABLE `songs` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`synth` text,
	`drums` text,
	`loops` text DEFAULT '[]' NOT NULL,
	`arrangement` text DEFAULT '[]' NOT NULL,
	`inserted_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `songs_name_unique` ON `songs` (`name`);