-- CreateTable
CREATE TABLE `agency` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,
    `business_number` VARCHAR(20) NULL,
    `phone` VARCHAR(20) NULL,
    `address` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `agent` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `agency_id` BIGINT NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `phone` VARCHAR(20) NULL,
    `role` ENUM('owner', 'member') NOT NULL,
    `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `agent_email_key`(`email`),
    INDEX `agent_agency_id_idx`(`agency_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `session` (
    `id` VARCHAR(64) NOT NULL,
    `agent_id` BIGINT NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `session_agent_id_idx`(`agent_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `listing` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `agency_id` BIGINT NOT NULL,
    `created_by` BIGINT NOT NULL,
    `source` ENUM('manual', 'naver', 'public_data') NOT NULL DEFAULT 'manual',
    `source_id` VARCHAR(100) NULL,
    `title` VARCHAR(255) NOT NULL,
    `deal_type` ENUM('sale', 'jeonse', 'wolse') NOT NULL,
    `property_type` ENUM('apartment', 'officetel', 'house', 'commercial', 'land') NOT NULL,
    `sale_price` BIGINT NULL,
    `deposit` BIGINT NULL,
    `monthly_rent` BIGINT NULL,
    `area_m2` DECIMAL(10, 2) NOT NULL,
    `address` VARCHAR(255) NOT NULL,
    `address_detail` VARCHAR(255) NULL,
    `latitude` DECIMAL(10, 7) NULL,
    `longitude` DECIMAL(10, 7) NULL,
    `floor` INTEGER NULL,
    `total_floors` INTEGER NULL,
    `rooms` INTEGER NULL,
    `bathrooms` INTEGER NULL,
    `built_year` INTEGER NULL,
    `status` ENUM('active', 'completed', 'hidden') NOT NULL DEFAULT 'active',
    `description` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `listing_agency_id_status_idx`(`agency_id`, `status`),
    UNIQUE INDEX `listing_agency_id_source_source_id_key`(`agency_id`, `source`, `source_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `listing_photo` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `listing_id` BIGINT NOT NULL,
    `url` VARCHAR(500) NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `listing_photo_listing_id_idx`(`listing_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customer` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `agency_id` BIGINT NOT NULL,
    `owner_agent_id` BIGINT NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `phone` VARCHAR(20) NULL,
    `customer_type` ENUM('buyer', 'seller', 'tenant', 'landlord') NOT NULL,
    `budget_min` BIGINT NULL,
    `budget_max` BIGINT NULL,
    `desired_area` VARCHAR(255) NULL,
    `memo` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `customer_agency_id_owner_agent_id_idx`(`agency_id`, `owner_agent_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customer_listing` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `customer_id` BIGINT NOT NULL,
    `listing_id` BIGINT NOT NULL,
    `status` ENUM('suggested', 'interested', 'visited', 'contracted', 'rejected') NOT NULL DEFAULT 'suggested',
    `memo` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `customer_listing_customer_id_listing_id_key`(`customer_id`, `listing_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `agent` ADD CONSTRAINT `agent_agency_id_fkey` FOREIGN KEY (`agency_id`) REFERENCES `agency`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `session` ADD CONSTRAINT `session_agent_id_fkey` FOREIGN KEY (`agent_id`) REFERENCES `agent`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `listing` ADD CONSTRAINT `listing_agency_id_fkey` FOREIGN KEY (`agency_id`) REFERENCES `agency`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `listing` ADD CONSTRAINT `listing_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `agent`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `listing_photo` ADD CONSTRAINT `listing_photo_listing_id_fkey` FOREIGN KEY (`listing_id`) REFERENCES `listing`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer` ADD CONSTRAINT `customer_agency_id_fkey` FOREIGN KEY (`agency_id`) REFERENCES `agency`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer` ADD CONSTRAINT `customer_owner_agent_id_fkey` FOREIGN KEY (`owner_agent_id`) REFERENCES `agent`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_listing` ADD CONSTRAINT `customer_listing_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_listing` ADD CONSTRAINT `customer_listing_listing_id_fkey` FOREIGN KEY (`listing_id`) REFERENCES `listing`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
