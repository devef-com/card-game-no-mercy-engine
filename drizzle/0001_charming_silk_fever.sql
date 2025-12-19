CREATE TABLE `game` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`current_turn_user_id` text,
	`direction` integer DEFAULT 1 NOT NULL,
	`winner_id` text,
	`draw_pile` text NOT NULL,
	`discard_pile` text NOT NULL,
	`current_color` text,
	`stacked_penalty` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`ended_at` integer,
	FOREIGN KEY (`room_id`) REFERENCES `room`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`current_turn_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`winner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `game_move` (
	`id` text PRIMARY KEY NOT NULL,
	`game_id` text NOT NULL,
	`user_id` text NOT NULL,
	`action` text NOT NULL,
	`card` text,
	`metadata` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`game_id`) REFERENCES `game`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `game_player` (
	`game_id` text NOT NULL,
	`user_id` text NOT NULL,
	`hand` text NOT NULL,
	`card_count` integer NOT NULL,
	`is_eliminated` integer DEFAULT false NOT NULL,
	`score` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`game_id`) REFERENCES `game`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `game_player_pk` ON `game_player` (`game_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `room` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`host_id` text NOT NULL,
	`status` text DEFAULT 'waiting' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`host_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `room_code_unique` ON `room` (`code`);--> statement-breakpoint
CREATE TABLE `room_player` (
	`room_id` text NOT NULL,
	`user_id` text NOT NULL,
	`joined_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `room`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `room_player_pk` ON `room_player` (`room_id`,`user_id`);--> statement-breakpoint
ALTER TABLE `user` ADD `role` text DEFAULT 'base' NOT NULL;