-- Adminer 4.8.4 MySQL 9.1.0 dump
-- antes de crear tablas (o después con ALTER)
SET default_storage_engine=INNODB;

-- o al final, convertir:
ALTER TABLE car_models ENGINE=InnoDB;
ALTER TABLE conversations ENGINE=InnoDB;
-- ...etc


SET NAMES utf8mb4;

DROP TABLE IF EXISTS `alembic_version`;
CREATE TABLE `alembic_version` (
  `version_num` varchar(32) NOT NULL,
  PRIMARY KEY (`version_num`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `alembic_version` (`version_num`) VALUES
('76facc30973f');

DROP TABLE IF EXISTS `car_brands`;
CREATE TABLE `car_brands` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) DEFAULT NULL,
  `logo_url` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ix_car_brands_name` (`name`),
  KEY `ix_car_brands_id` (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


DROP TABLE IF EXISTS `car_models`;
CREATE TABLE `car_models` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) DEFAULT NULL,
  `brand_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `brand_id` (`brand_id`),
  KEY `ix_car_models_id` (`id`),
  KEY `ix_car_models_name` (`name`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


DROP TABLE IF EXISTS `companies`;
CREATE TABLE `companies` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) DEFAULT NULL,
  `logo_url` varchar(500) DEFAULT NULL,
  `primary_color` varchar(50) DEFAULT NULL,
  `secondary_color` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ix_companies_name` (`name`),
  KEY `ix_companies_id` (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `companies` (`id`, `name`, `logo_url`, `primary_color`, `secondary_color`) VALUES
(1,	'AutosQP Admin',	'https://autosqp.com/wp-content/uploads/2025/12/Horizontal-Base_-v3-1.03.18-p.m.png',	'#0f172a',	'#3cf6c7');

DROP TABLE IF EXISTS `conversations`;
CREATE TABLE `conversations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `lead_id` int DEFAULT NULL,
  `company_id` int DEFAULT NULL,
  `last_message_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `lead_id` (`lead_id`),
  KEY `company_id` (`company_id`),
  KEY `ix_conversations_id` (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `conversations` (`id`, `lead_id`, `company_id`, `last_message_at`) VALUES
(1,	13,	1,	'2026-02-05 16:02:51');

DROP TABLE IF EXISTS `credit_applications`;
CREATE TABLE `credit_applications` (
  `id` int NOT NULL AUTO_INCREMENT,
  `client_name` varchar(100) DEFAULT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `desired_vehicle` varchar(100) DEFAULT NULL,
  `monthly_income` int DEFAULT NULL,
  `other_income` int DEFAULT NULL,
  `occupation` varchar(50) DEFAULT NULL,
  `application_mode` varchar(50) DEFAULT NULL,
  `down_payment` int DEFAULT NULL,
  `status` varchar(50) DEFAULT NULL,
  `notes` varchar(2000) DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  `company_id` int DEFAULT NULL,
  `assigned_to_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `company_id` (`company_id`),
  KEY `assigned_to_id` (`assigned_to_id`),
  KEY `ix_credit_applications_id` (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


DROP TABLE IF EXISTS `integration_settings`;
CREATE TABLE `integration_settings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `company_id` int DEFAULT NULL,
  `facebook_access_token` varchar(255) DEFAULT NULL,
  `facebook_pixel_id` varchar(100) DEFAULT NULL,
  `instagram_access_token` varchar(255) DEFAULT NULL,
  `tiktok_access_token` varchar(255) DEFAULT NULL,
  `tiktok_pixel_id` varchar(100) DEFAULT NULL,
  `whatsapp_api_key` varchar(255) DEFAULT NULL,
  `whatsapp_phone_number_id` varchar(100) DEFAULT NULL,
  `openai_api_key` varchar(255) DEFAULT NULL,
  `gw_model` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `company_id` (`company_id`),
  KEY `ix_integration_settings_id` (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `integration_settings` (`id`, `company_id`, `facebook_access_token`, `facebook_pixel_id`, `instagram_access_token`, `tiktok_access_token`, `tiktok_pixel_id`, `whatsapp_api_key`, `whatsapp_phone_number_id`, `openai_api_key`, `gw_model`) VALUES
(1,	1,	NULL,	NULL,	NULL,	NULL,	NULL,	NULL,	NULL,	NULL,	'gpt-4o');

DROP TABLE IF EXISTS `lead_history`;
CREATE TABLE `lead_history` (
  `id` int NOT NULL AUTO_INCREMENT,
  `lead_id` int DEFAULT NULL,
  `user_id` int DEFAULT NULL,
  `previous_status` varchar(50) DEFAULT NULL,
  `new_status` varchar(50) DEFAULT NULL,
  `comment` varchar(500) DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `lead_id` (`lead_id`),
  KEY `user_id` (`user_id`),
  KEY `ix_lead_history_id` (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `lead_history` (`id`, `lead_id`, `user_id`, `previous_status`, `new_status`, `comment`, `created_at`) VALUES
(1,	6,	2,	'new',	'contacted',	'testt\n',	'2026-01-28 21:45:14'),
(2,	8,	3,	'new',	'contacted',	'gdgfgfd',	'2026-01-29 01:09:08'),
(3,	6,	3,	'contacted',	'interested',	'jfnlkn',	'2026-01-29 01:09:36'),
(4,	8,	3,	'contacted',	'interested',	'test seguimento 2 ',	'2026-02-05 15:28:50'),
(5,	13,	3,	'new',	'contacted',	'no esta interesado',	'2026-02-05 20:18:32');

DROP TABLE IF EXISTS `leads`;
CREATE TABLE `leads` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `source` varchar(50) DEFAULT NULL,
  `status` varchar(50) DEFAULT NULL,
  `message` varchar(1000) DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `company_id` int DEFAULT NULL,
  `assigned_to_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `company_id` (`company_id`),
  KEY `assigned_to_id` (`assigned_to_id`),
  KEY `ix_leads_id` (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `leads` (`id`, `name`, `email`, `phone`, `source`, `status`, `message`, `created_at`, `company_id`, `assigned_to_id`) VALUES
(1,	'Test Lead Crash',	NULL,	'3000000000',	'web',	'new',	'Testing 500 error',	'2026-01-28 18:49:15',	1,	NULL),
(2,	'Cliente Demo 6',	NULL,	'3001234567',	'web',	'new',	'Hola, me interesa el Mazda 3',	'2026-01-28 18:49:52',	1,	NULL),
(3,	'Cliente Demo 77',	NULL,	'3001234567',	'web',	'lost',	'Hola, me interesa el Mazda 3',	'2026-01-28 18:49:54',	1,	NULL),
(4,	'Cliente Demo 73',	NULL,	'3001234567',	'web',	'new',	'Hola, me interesa el Mazda 3',	'2026-01-28 18:50:09',	1,	NULL),
(5,	'Test Lead Crash',	NULL,	'3000000000',	'web',	'new',	'Testing 500 error',	'2026-01-28 19:02:08',	1,	2),
(6,	'Cliente Demo 74',	NULL,	'3001234567',	'web',	'sold',	'Hola, me interesa el Mazda 3',	'2026-01-28 19:04:58',	1,	2),
(7,	'Cliente Demo 84',	NULL,	'3001234567',	'web',	'contacted',	'Hola, me interesa el Mazda 3',	'2026-01-28 19:05:13',	1,	2),
(8,	'Cliente Demo 48',	NULL,	'3001234567',	'web',	'sold',	'Hola, me interesa el Mazda 3',	'2026-01-28 19:05:14',	1,	2),
(9,	'Cliente Demo 29',	NULL,	'3001234567',	'web',	'sold',	'Hola, me interesa el Mazda 3',	'2026-01-28 19:05:14',	1,	2),
(10,	'Cliente Demo 91',	NULL,	'3001234567',	'web',	'sold',	'Hola, me interesa el Mazda 3',	'2026-01-28 19:05:15',	1,	2),
(11,	'Cliente Demo 96',	NULL,	'3001234567',	'web',	'sold',	'Hola, me interesa el Mazda 3',	'2026-01-28 19:05:15',	1,	2),
(12,	'Cliente Nuevo 599',	NULL,	'3007032969',	'facebook',	'new',	'Estoy interesado en conocer los planes de financiamiento.',	'2026-01-29 01:15:30',	1,	2),
(13,	'Python User',	NULL,	'573005555555',	'whatsapp',	'contacted',	NULL,	'2026-02-05 15:57:22',	1,	2);

DROP TABLE IF EXISTS `messages`;
CREATE TABLE `messages` (
  `id` int NOT NULL AUTO_INCREMENT,
  `conversation_id` int DEFAULT NULL,
  `sender_type` varchar(50) DEFAULT NULL,
  `content` varchar(2000) DEFAULT NULL,
  `media_url` varchar(1000) DEFAULT NULL,
  `message_type` varchar(20) DEFAULT NULL,
  `whatsapp_message_id` varchar(100) DEFAULT NULL,
  `status` varchar(20) DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `conversation_id` (`conversation_id`),
  KEY `ix_messages_id` (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `messages` (`id`, `conversation_id`, `sender_type`, `content`, `media_url`, `message_type`, `whatsapp_message_id`, `status`, `created_at`) VALUES
(1,	1,	'lead',	'Test message via python script',	NULL,	'text',	'wamid.PYTHON1',	'delivered',	'2026-02-05 15:57:22'),
(2,	1,	'user',	'esto es otra prueba',	NULL,	'text',	NULL,	'failed',	'2026-02-05 16:02:51');

DROP TABLE IF EXISTS `roles`;
CREATE TABLE `roles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(50) DEFAULT NULL,
  `label` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ix_roles_name` (`name`),
  KEY `ix_roles_id` (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `roles` (`id`, `name`, `label`) VALUES
(1,	'super_admin',	'Súper Admin Global'),
(2,	'admin',	'Administrador de Empresa'),
(3,	'asesor',	'Asesor / Vendedor'),
(4,	'user',	'Usuario Básico');

DROP TABLE IF EXISTS `sales`;
CREATE TABLE `sales` (
  `id` int NOT NULL AUTO_INCREMENT,
  `vehicle_id` int DEFAULT NULL,
  `lead_id` int DEFAULT NULL,
  `seller_id` int DEFAULT NULL,
  `company_id` int DEFAULT NULL,
  `sale_price` int DEFAULT NULL,
  `commission_percentage` int DEFAULT NULL,
  `commission_amount` int DEFAULT NULL,
  `net_revenue` int DEFAULT NULL,
  `status` varchar(50) DEFAULT NULL,
  `approved_by_id` int DEFAULT NULL,
  `sale_date` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `vehicle_id` (`vehicle_id`),
  KEY `lead_id` (`lead_id`),
  KEY `seller_id` (`seller_id`),
  KEY `company_id` (`company_id`),
  KEY `approved_by_id` (`approved_by_id`),
  KEY `ix_sales_id` (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `sales` (`id`, `vehicle_id`, `lead_id`, `seller_id`, `company_id`, `sale_price`, `commission_percentage`, `commission_amount`, `net_revenue`, `status`, `approved_by_id`, `sale_date`) VALUES
(1,	11,	11,	1,	1,	92000000,	0,	0,	92000000,	'approved',	3,	'2026-01-28 20:28:34'),
(2,	10,	9,	3,	1,	48000000,	0,	0,	48000000,	'approved',	3,	'2026-01-28 20:47:49'),
(3,	9,	10,	2,	1,	52000000,	10,	5200000,	46800000,	'approved',	3,	'2026-01-28 20:36:49'),
(4,	7,	6,	2,	1,	50000000,	10,	5000000,	45000000,	'approved',	3,	'2026-01-29 01:12:20'),
(5,	6,	8,	2,	1,	1321321,	10,	132132,	1189189,	'approved',	3,	'2026-02-05 20:24:52');

DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `email` varchar(100) DEFAULT NULL,
  `hashed_password` varchar(255) DEFAULT NULL,
  `role_id` int DEFAULT NULL,
  `company_id` int DEFAULT NULL,
  `commission_percentage` int DEFAULT NULL,
  `base_salary` int DEFAULT NULL,
  `payment_dates` varchar(100) DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ix_users_email` (`email`),
  KEY `role_id` (`role_id`),
  KEY `company_id` (`company_id`),
  KEY `ix_users_id` (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `users` (`id`, `email`, `hashed_password`, `role_id`, `company_id`, `commission_percentage`, `base_salary`, `payment_dates`, `created_at`) VALUES
(1,	'admin@autosqp.com',	'$2b$12$8DFCbB3.ncqvCBYLsmXYx.6NOP5AacQtMO9JpUoA9g/e.ZgCXfw..',	1,	NULL,	0,	NULL,	NULL,	'2026-01-28 10:44:39'),
(2,	'vendedor1@autosqp.com',	'$2b$12$ctxKk62DWsAke2RBAVVSIerZk8b/U7tAaV3GCAIJAyVpG9EXoJiBq',	3,	1,	1,	1500000,	'5 y10',	'2026-01-28 10:44:39'),
(3,	'diego@autosqp.com',	'$2b$12$5jO/I8wo9d1H0mM3pSaZLuvIM0LwEG5dWCkvyAd9nnzEucaXAfwCm',	2,	1,	0,	NULL,	NULL,	'2026-01-28 20:22:01');

DROP TABLE IF EXISTS `vehicles`;
CREATE TABLE `vehicles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `make` varchar(100) DEFAULT NULL,
  `model` varchar(100) DEFAULT NULL,
  `year` int DEFAULT NULL,
  `price` int DEFAULT NULL,
  `plate` varchar(20) DEFAULT NULL,
  `mileage` int DEFAULT NULL,
  `color` varchar(50) DEFAULT NULL,
  `description` varchar(500) DEFAULT NULL,
  `status` varchar(50) DEFAULT NULL,
  `photos` json DEFAULT NULL,
  `company_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `company_id` (`company_id`),
  KEY `ix_vehicles_id` (`id`),
  KEY `ix_vehicles_plate` (`plate`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `vehicles` (`id`, `make`, `model`, `year`, `price`, `plate`, `mileage`, `color`, `description`, `status`, `photos`, `company_id`) VALUES
(1,	'Mazda',	'Mazda 3',	2024,	74000000,	'DEM-129',	17674,	'Gris',	'Vehículo de prueba generado automáticamente',	'available',	'[]',	1),
(2,	'Toyota',	'Hilux',	2022,	24000000,	'DEM-895',	31176,	'Gris',	'Vehículo de prueba generado automáticamente',	'available',	'[]',	1),
(3,	'Kia',	'Picanto',	2020,	60000000,	'DEM-445',	37429,	'Gris',	'Vehículo de prueba generado automáticamente',	'available',	'[]',	1),
(4,	'Toyota',	'Hilux',	2022,	40000000,	'DEM-676',	35494,	'Gris',	'Vehículo de prueba generado automáticamente',	'available',	'[]',	1),
(5,	'Mazda',	'Mazda 3',	2018,	61000000,	'DEM-506',	32955,	'Gris',	'Vehículo de prueba generado automáticamente',	'available',	'[]',	1),
(6,	'Kia',	'Picanto',	2018,	74000000,	'DEM-806',	37443,	'Gris',	'Vehículo de prueba generado automáticamente',	'sold',	'[]',	1),
(7,	'Renault',	'Logan',	2018,	51000000,	'DEM-263',	3369,	'Gris',	'Vehículo de prueba generado automáticamente',	'sold',	'[]',	1),
(8,	'Chevrolet',	'Spark',	2024,	51000000,	'DEM-999',	27894,	'Gris',	'Vehículo de prueba generado automáticamente',	'sold',	'[]',	1),
(9,	'Chevrolet',	'Spark',	2019,	50000000,	'DEM-455',	45124,	'Gris',	'Vehículo de prueba generado automáticamente',	'sold',	'[]',	1),
(10,	'Ford',	'Fiesta',	2020,	48000000,	'DEM-776',	13764,	'Gris',	'Vehículo de prueba generado automáticamente',	'sold',	'[]',	1),
(11,	'Chevrolet',	'Spark',	2018,	94000000,	'DEM-818',	20931,	'Gris',	'Vehículo de prueba generado automáticamente',	'sold',	'[]',	1);

-- 2026-02-09 16:55:36
