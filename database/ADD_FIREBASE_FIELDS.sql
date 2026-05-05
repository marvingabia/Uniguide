-- Add Firebase Authentication Fields to Users Table
-- Run this in phpMyAdmin or MySQL Workbench
-- This script is safe to run multiple times

USE tellngrow;

-- Add googleId column (if not exists)
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists 
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = 'tellngrow' 
AND TABLE_NAME = 'users' 
AND COLUMN_NAME = 'googleId';

SET @query = IF(@col_exists = 0, 
    'ALTER TABLE `users` ADD COLUMN `googleId` VARCHAR(255) NULL UNIQUE AFTER `password`',
    'SELECT "googleId column already exists" AS Info');
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add profilePicture column (if not exists)
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists 
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = 'tellngrow' 
AND TABLE_NAME = 'users' 
AND COLUMN_NAME = 'profilePicture';

SET @query = IF(@col_exists = 0, 
    'ALTER TABLE `users` ADD COLUMN `profilePicture` VARCHAR(500) NULL AFTER `googleId`',
    'SELECT "profilePicture column already exists" AS Info');
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add authProvider column (if not exists)
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists 
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = 'tellngrow' 
AND TABLE_NAME = 'users' 
AND COLUMN_NAME = 'authProvider';

SET @query = IF(@col_exists = 0, 
    'ALTER TABLE `users` ADD COLUMN `authProvider` ENUM("local", "google", "firebase-google") DEFAULT "local" AFTER `profilePicture`',
    'SELECT "authProvider column already exists" AS Info');
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Make password nullable (for Google users who don't have passwords)
ALTER TABLE `users` 
MODIFY COLUMN `password` VARCHAR(255) NULL;

-- Update role enum to include 'counselor'
ALTER TABLE `users` 
MODIFY COLUMN `role` ENUM('user', 'admin', 'faculty', 'counselor') DEFAULT 'user' NOT NULL;

-- Verify changes
DESCRIBE `users`;

SELECT 'Firebase fields migration completed!' AS Status;
