CREATE TABLE `categorias` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nombre` text NOT NULL,
	`activa` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_categorias_nombre` ON `categorias` (`nombre`);--> statement-breakpoint
CREATE TABLE `clientes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tipo_doc` text DEFAULT 'DNI' NOT NULL,
	`nro_doc` text NOT NULL,
	`nombre` text NOT NULL,
	`domicilio` text,
	`telefono` text,
	`email` text,
	`cuenta_corriente` integer DEFAULT false NOT NULL,
	`limite_credito` integer,
	`activo` integer DEFAULT true NOT NULL,
	`creado_en` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_clientes_documento` ON `clientes` (`nro_doc`);--> statement-breakpoint
CREATE INDEX `ix_clientes_nombre` ON `clientes` (`nombre`);--> statement-breakpoint
CREATE TABLE `contadores` (
	`nombre` text PRIMARY KEY NOT NULL,
	`valor` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `factura_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`factura_id` integer NOT NULL,
	`producto_id` integer NOT NULL,
	`codigo` text NOT NULL,
	`descripcion` text NOT NULL,
	`cantidad` integer NOT NULL,
	`precio_unitario` integer NOT NULL,
	`subtotal` integer NOT NULL,
	FOREIGN KEY (`factura_id`) REFERENCES `facturas`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`producto_id`) REFERENCES `productos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_items_factura` ON `factura_items` (`factura_id`);--> statement-breakpoint
CREATE INDEX `ix_items_producto` ON `factura_items` (`producto_id`);--> statement-breakpoint
CREATE TABLE `facturas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`punto_venta` integer NOT NULL,
	`numero` integer NOT NULL,
	`fecha` integer NOT NULL,
	`cliente_id` integer,
	`cliente_nombre` text,
	`cliente_documento` text,
	`total` integer NOT NULL,
	`forma_pago` text NOT NULL,
	`monto_recibido` integer,
	`vuelto` integer,
	`estado` text DEFAULT 'emitida' NOT NULL,
	`tarjeta_tipo` text,
	`tarjeta_marca` text,
	`tarjeta_ultimos4` text,
	`motivo_anulacion` text,
	`anulada_en` integer,
	`anulada_por_id` integer,
	`usuario_id` integer,
	FOREIGN KEY (`cliente_id`) REFERENCES `clientes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`anulada_por_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_facturas_numero` ON `facturas` (`punto_venta`,`numero`);--> statement-breakpoint
CREATE INDEX `ix_facturas_fecha` ON `facturas` (`fecha`);--> statement-breakpoint
CREATE INDEX `ix_facturas_cliente` ON `facturas` (`cliente_id`);--> statement-breakpoint
CREATE TABLE `movimientos_cuenta` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`cliente_id` integer NOT NULL,
	`tipo` text NOT NULL,
	`importe` integer NOT NULL,
	`descripcion` text,
	`factura_id` integer,
	`pago_id` integer,
	`fecha` integer NOT NULL,
	FOREIGN KEY (`cliente_id`) REFERENCES `clientes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`factura_id`) REFERENCES `facturas`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`pago_id`) REFERENCES `pagos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_movcuenta_cliente` ON `movimientos_cuenta` (`cliente_id`);--> statement-breakpoint
CREATE INDEX `ix_movcuenta_factura` ON `movimientos_cuenta` (`factura_id`);--> statement-breakpoint
CREATE TABLE `movimientos_stock` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`producto_id` integer NOT NULL,
	`tipo` text NOT NULL,
	`cantidad` integer NOT NULL,
	`existencia_resultante` integer NOT NULL,
	`motivo` text,
	`observacion` text,
	`factura_id` integer,
	`usuario_id` integer,
	`fecha` integer NOT NULL,
	FOREIGN KEY (`producto_id`) REFERENCES `productos`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_movstock_producto` ON `movimientos_stock` (`producto_id`);--> statement-breakpoint
CREATE INDEX `ix_movstock_factura` ON `movimientos_stock` (`factura_id`);--> statement-breakpoint
CREATE TABLE `pagos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`cliente_id` integer NOT NULL,
	`numero` integer NOT NULL,
	`importe` integer NOT NULL,
	`medio` text NOT NULL,
	`observacion` text,
	`fecha` integer NOT NULL,
	`usuario_id` integer,
	FOREIGN KEY (`cliente_id`) REFERENCES `clientes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_pagos_numero` ON `pagos` (`numero`);--> statement-breakpoint
CREATE INDEX `ix_pagos_cliente` ON `pagos` (`cliente_id`);--> statement-breakpoint
CREATE TABLE `productos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`codigo` text NOT NULL,
	`descripcion` text NOT NULL,
	`categoria_id` integer,
	`precio` integer NOT NULL,
	`existencia` integer DEFAULT 0 NOT NULL,
	`stock_minimo` integer DEFAULT 0 NOT NULL,
	`activo` integer DEFAULT true NOT NULL,
	`creado_en` integer NOT NULL,
	FOREIGN KEY (`categoria_id`) REFERENCES `categorias`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_productos_codigo` ON `productos` (`codigo`);--> statement-breakpoint
CREATE INDEX `ix_productos_descripcion` ON `productos` (`descripcion`);--> statement-breakpoint
CREATE INDEX `ix_productos_categoria` ON `productos` (`categoria_id`);--> statement-breakpoint
CREATE TABLE `usuarios` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nombre` text NOT NULL,
	`email` text NOT NULL,
	`hash` text NOT NULL,
	`rol` text DEFAULT 'vendedor' NOT NULL,
	`activo` integer DEFAULT true NOT NULL,
	`creado_en` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_usuarios_email` ON `usuarios` (`email`);