CREATE TYPE "public"."categoria_producto" AS ENUM('herbicida', 'insecticida', 'fungicida', 'fertilizante', 'semilla', 'coadyuvante', 'otro');--> statement-breakpoint
CREATE TYPE "public"."estado_receta" AS ENUM('borrador', 'emitida', 'aplicada', 'anulada');--> statement-breakpoint
CREATE TYPE "public"."moneda" AS ENUM('ARS', 'USD');--> statement-breakpoint
CREATE TYPE "public"."tipo_labor" AS ENUM('siembra', 'pulverizacion', 'fertilizacion', 'cosecha', 'laboreo', 'otra');--> statement-breakpoint
CREATE TYPE "public"."unidad" AS ENUM('L', 'kg', 'u');--> statement-breakpoint
CREATE TABLE "campanias" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "campanias_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"nombre" text NOT NULL,
	"fecha_inicio" date,
	"fecha_fin" date,
	CONSTRAINT "campanias_nombre_unique" UNIQUE("nombre")
);
--> statement-breakpoint
CREATE TABLE "campos" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "campos_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"nombre" text NOT NULL,
	"localidad" text,
	"provincia" text,
	"notas" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ciclos" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ciclos_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"lote_id" integer NOT NULL,
	"campania_id" integer NOT NULL,
	"cultivo" text NOT NULL,
	"variedad" text,
	"fecha_siembra" date,
	"superficie_ha" numeric(10, 2),
	"rinde_kg_ha" numeric(10, 2),
	"notas" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contratistas" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "contratistas_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"nombre" text NOT NULL,
	"cuit" text,
	"telefono" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "labor_insumos" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "labor_insumos_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"labor_id" integer NOT NULL,
	"producto_id" integer NOT NULL,
	"dosis_por_ha" numeric(12, 4) NOT NULL,
	"cantidad_total" numeric(14, 4) NOT NULL,
	"precio_unitario" numeric(14, 4),
	"moneda" "moneda"
);
--> statement-breakpoint
CREATE TABLE "labores" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "labores_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"ciclo_id" integer NOT NULL,
	"receta_id" integer,
	"tipo" "tipo_labor" NOT NULL,
	"fecha" date NOT NULL,
	"superficie_ha" numeric(10, 2) NOT NULL,
	"contratista_id" integer,
	"costo_labor_por_ha" numeric(14, 4),
	"moneda_labor" "moneda",
	"tipo_cambio" numeric(14, 4),
	"notas" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lotes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "lotes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"campo_id" integer NOT NULL,
	"nombre" text NOT NULL,
	"superficie_ha" numeric(10, 2),
	"contorno" geometry(MultiPolygon, 4326),
	"activo" boolean DEFAULT true NOT NULL,
	"notas" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "precios_producto" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "precios_producto_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"producto_id" integer NOT NULL,
	"proveedor_id" integer,
	"moneda" "moneda" NOT NULL,
	"precio_unitario" numeric(14, 4) NOT NULL,
	"fecha" date NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "productos" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "productos_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"nombre_comercial" text NOT NULL,
	"principio_activo" text,
	"concentracion" text,
	"formulacion" text,
	"categoria" "categoria_producto" DEFAULT 'otro' NOT NULL,
	"unidad" "unidad" NOT NULL,
	"banda_toxicologica" text,
	"carencia_dias" integer,
	"activo" boolean DEFAULT true NOT NULL,
	"notas" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proveedores" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "proveedores_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"nombre" text NOT NULL,
	"localidad" text,
	"contacto" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "receta_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "receta_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"receta_id" integer NOT NULL,
	"producto_id" integer NOT NULL,
	"dosis_por_ha" numeric(12, 4) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recetas" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "recetas_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"numero" integer NOT NULL,
	"fecha" date NOT NULL,
	"ciclo_id" integer NOT NULL,
	"plaga_objetivo" text,
	"recomendaciones" text,
	"estado" "estado_receta" DEFAULT 'borrador' NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ciclos" ADD CONSTRAINT "ciclos_lote_id_lotes_id_fk" FOREIGN KEY ("lote_id") REFERENCES "public"."lotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ciclos" ADD CONSTRAINT "ciclos_campania_id_campanias_id_fk" FOREIGN KEY ("campania_id") REFERENCES "public"."campanias"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labor_insumos" ADD CONSTRAINT "labor_insumos_labor_id_labores_id_fk" FOREIGN KEY ("labor_id") REFERENCES "public"."labores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labor_insumos" ADD CONSTRAINT "labor_insumos_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labores" ADD CONSTRAINT "labores_ciclo_id_ciclos_id_fk" FOREIGN KEY ("ciclo_id") REFERENCES "public"."ciclos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labores" ADD CONSTRAINT "labores_receta_id_recetas_id_fk" FOREIGN KEY ("receta_id") REFERENCES "public"."recetas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labores" ADD CONSTRAINT "labores_contratista_id_contratistas_id_fk" FOREIGN KEY ("contratista_id") REFERENCES "public"."contratistas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lotes" ADD CONSTRAINT "lotes_campo_id_campos_id_fk" FOREIGN KEY ("campo_id") REFERENCES "public"."campos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "precios_producto" ADD CONSTRAINT "precios_producto_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "precios_producto" ADD CONSTRAINT "precios_producto_proveedor_id_proveedores_id_fk" FOREIGN KEY ("proveedor_id") REFERENCES "public"."proveedores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receta_items" ADD CONSTRAINT "receta_items_receta_id_recetas_id_fk" FOREIGN KEY ("receta_id") REFERENCES "public"."recetas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receta_items" ADD CONSTRAINT "receta_items_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recetas" ADD CONSTRAINT "recetas_ciclo_id_ciclos_id_fk" FOREIGN KEY ("ciclo_id") REFERENCES "public"."ciclos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ciclos_lote_id_index" ON "ciclos" USING btree ("lote_id");--> statement-breakpoint
CREATE INDEX "ciclos_campania_id_index" ON "ciclos" USING btree ("campania_id");--> statement-breakpoint
CREATE INDEX "labor_insumos_labor_id_index" ON "labor_insumos" USING btree ("labor_id");--> statement-breakpoint
CREATE INDEX "labores_ciclo_id_index" ON "labores" USING btree ("ciclo_id");--> statement-breakpoint
CREATE INDEX "labores_fecha_index" ON "labores" USING btree ("fecha");--> statement-breakpoint
CREATE INDEX "lotes_campo_id_index" ON "lotes" USING btree ("campo_id");--> statement-breakpoint
CREATE INDEX "lotes_contorno_gist" ON "lotes" USING gist ("contorno");--> statement-breakpoint
CREATE INDEX "precios_producto_producto_id_fecha_index" ON "precios_producto" USING btree ("producto_id","fecha");--> statement-breakpoint
CREATE INDEX "receta_items_receta_id_index" ON "receta_items" USING btree ("receta_id");--> statement-breakpoint
CREATE UNIQUE INDEX "recetas_numero_index" ON "recetas" USING btree ("numero");--> statement-breakpoint
CREATE INDEX "recetas_ciclo_id_index" ON "recetas" USING btree ("ciclo_id");