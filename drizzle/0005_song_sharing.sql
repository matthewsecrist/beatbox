CREATE TABLE `song_likes` (
	`inserted_at` integer NOT NULL,
	`song_id` text NOT NULL,
	`user_id` text NOT NULL,
	PRIMARY KEY(`song_id`, `user_id`),
	FOREIGN KEY (`song_id`) REFERENCES `songs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `song_views` (
	`day` text NOT NULL,
	`song_id` text NOT NULL,
	`viewer` text NOT NULL,
	PRIMARY KEY(`song_id`, `viewer`, `day`),
	FOREIGN KEY (`song_id`) REFERENCES `songs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `songs` ADD `share_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `songs_share_id_unique` ON `songs` (`share_id`);