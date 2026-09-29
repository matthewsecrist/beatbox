CREATE TABLE `kits` (
	`id` text PRIMARY KEY NOT NULL,
	`kit` text NOT NULL,
	`name` text NOT NULL,
	`user_id` text NOT NULL,
	`voices` text NOT NULL,
	`inserted_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `kits_user_id_name_unique` ON `kits` (`user_id`,`name`);