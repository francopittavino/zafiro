CREATE TYPE "public"."cobro_labor" AS ENUM('ha', 'hora');--> statement-breakpoint
CREATE TYPE "public"."entidad_personalizable" AS ENUM('campo', 'lote', 'producto', 'labor', 'receta');--> statement-breakpoint
CREATE TYPE "public"."modalidad_labor" AS ENUM('propia', 'contratista');--> statement-breakpoint
CREATE TYPE "public"."tenencia" AS ENUM('propio', 'alquilado');--> statement-breakpoint
CREATE TYPE "public"."tipo_dato" AS ENUM('texto', 'numero', 'fecha');--> statement-breakpoint
CREATE TYPE "public"."tipo_movimiento_stock" AS ENUM('ingreso', 'aplicacion', 'ajuste');--> statement-breakpoint
CREATE TABLE "campos_personalizados" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "campos_personalizados_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"entidad" "entidad_personalizable" NOT NULL,
	"nombre" text NOT NULL,
	"tipo" "tipo_dato" DEFAULT 'texto' NOT NULL,
	"orden" integer DEFAULT 0 NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categorias_gasto" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "categorias_gasto_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"nombre" text NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categorias_gasto_nombre_unique" UNIQUE("nombre")
);
--> statement-breakpoint
CREATE TABLE "gastos" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "gastos_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"campania_id" integer NOT NULL,
	"ciclo_id" integer,
	"campo_id" integer,
	"categoria_id" integer NOT NULL,
	"fecha" date NOT NULL,
	"descripcion" text,
	"importe_usd" numeric(14, 2) NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gastos_un_destino" CHECK (num_nonnulls("gastos"."ciclo_id", "gastos"."campo_id") <= 1)
);
--> statement-breakpoint
CREATE TABLE "movimientos_stock" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "movimientos_stock_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"campo_id" integer NOT NULL,
	"producto_id" integer NOT NULL,
	"fecha" date NOT NULL,
	"tipo" "tipo_movimiento_stock" NOT NULL,
	"cantidad" numeric(14, 4) NOT NULL,
	"labor_id" integer,
	"proveedor_id" integer,
	"nota" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "productores" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "productores_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"nombre" text NOT NULL,
	"cuit" text,
	"telefono" text,
	"email" text,
	"localidad" text,
	"notas" text,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "productores_nombre_unique" UNIQUE("nombre")
);
--> statement-breakpoint
ALTER TABLE "campos" ADD COLUMN "productor_id" integer;--> statement-breakpoint
ALTER TABLE "campos" ADD COLUMN "latitud" numeric(9, 6);--> statement-breakpoint
ALTER TABLE "campos" ADD COLUMN "longitud" numeric(9, 6);--> statement-breakpoint
ALTER TABLE "campos" ADD COLUMN "foto_mapa_id" integer;--> statement-breakpoint
ALTER TABLE "campos" ADD COLUMN "extras" jsonb;--> statement-breakpoint
ALTER TABLE "labores" ADD COLUMN "modalidad" "modalidad_labor";--> statement-breakpoint
ALTER TABLE "labores" ADD COLUMN "cobro" "cobro_labor" DEFAULT 'ha' NOT NULL;--> statement-breakpoint
ALTER TABLE "labores" ADD COLUMN "horas" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "labores" ADD COLUMN "costo_hora" numeric(14, 4);--> statement-breakpoint
ALTER TABLE "labores" ADD COLUMN "caudal_l_ha" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "labores" ADD COLUMN "temperatura" numeric(5, 1);--> statement-breakpoint
ALTER TABLE "labores" ADD COLUMN "humedad" numeric(5, 1);--> statement-breakpoint
ALTER TABLE "labores" ADD COLUMN "viento_km_h" numeric(5, 1);--> statement-breakpoint
ALTER TABLE "labores" ADD COLUMN "viento_direccion" text;--> statement-breakpoint
ALTER TABLE "labores" ADD COLUMN "aplicador" text;--> statement-breakpoint
ALTER TABLE "labores" ADD COLUMN "zonas" jsonb;--> statement-breakpoint
ALTER TABLE "labores" ADD COLUMN "extras" jsonb;--> statement-breakpoint
ALTER TABLE "lotes" ADD COLUMN "dibujo" jsonb;--> statement-breakpoint
ALTER TABLE "lotes" ADD COLUMN "tenencia" "tenencia";--> statement-breakpoint
ALTER TABLE "lotes" ADD COLUMN "tipo_suelo" text;--> statement-breakpoint
ALTER TABLE "lotes" ADD COLUMN "latitud" numeric(9, 6);--> statement-breakpoint
ALTER TABLE "lotes" ADD COLUMN "longitud" numeric(9, 6);--> statement-breakpoint
ALTER TABLE "lotes" ADD COLUMN "extras" jsonb;--> statement-breakpoint
ALTER TABLE "productos" ADD COLUMN "presentacion" text;--> statement-breakpoint
ALTER TABLE "productos" ADD COLUMN "extras" jsonb;--> statement-breakpoint
ALTER TABLE "recetas" ADD COLUMN "numero_oficial" text;--> statement-breakpoint
ALTER TABLE "recetas" ADD COLUMN "superficie_ha" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "recetas" ADD COLUMN "tipo_aplicacion" text;--> statement-breakpoint
ALTER TABLE "recetas" ADD COLUMN "caudal_l_ha" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "recetas" ADD COLUMN "fecha_aplicacion_prevista" date;--> statement-breakpoint
ALTER TABLE "recetas" ADD COLUMN "condiciones" text;--> statement-breakpoint
ALTER TABLE "recetas" ADD COLUMN "observaciones" text;--> statement-breakpoint
ALTER TABLE "recetas" ADD COLUMN "extras" jsonb;--> statement-breakpoint
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_campania_id_campanias_id_fk" FOREIGN KEY ("campania_id") REFERENCES "public"."campanias"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_ciclo_id_ciclos_id_fk" FOREIGN KEY ("ciclo_id") REFERENCES "public"."ciclos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_campo_id_campos_id_fk" FOREIGN KEY ("campo_id") REFERENCES "public"."campos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_categoria_id_categorias_gasto_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias_gasto"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_stock" ADD CONSTRAINT "movimientos_stock_campo_id_campos_id_fk" FOREIGN KEY ("campo_id") REFERENCES "public"."campos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_stock" ADD CONSTRAINT "movimientos_stock_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_stock" ADD CONSTRAINT "movimientos_stock_labor_id_labores_id_fk" FOREIGN KEY ("labor_id") REFERENCES "public"."labores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_stock" ADD CONSTRAINT "movimientos_stock_proveedor_id_proveedores_id_fk" FOREIGN KEY ("proveedor_id") REFERENCES "public"."proveedores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "campos_personalizados_entidad_nombre_index" ON "campos_personalizados" USING btree ("entidad","nombre");--> statement-breakpoint
CREATE INDEX "gastos_campania_id_index" ON "gastos" USING btree ("campania_id");--> statement-breakpoint
CREATE INDEX "gastos_ciclo_id_index" ON "gastos" USING btree ("ciclo_id");--> statement-breakpoint
CREATE INDEX "gastos_campo_id_index" ON "gastos" USING btree ("campo_id");--> statement-breakpoint
CREATE INDEX "movimientos_stock_campo_id_producto_id_index" ON "movimientos_stock" USING btree ("campo_id","producto_id");--> statement-breakpoint
CREATE INDEX "movimientos_stock_labor_id_index" ON "movimientos_stock" USING btree ("labor_id");--> statement-breakpoint
ALTER TABLE "campos" ADD CONSTRAINT "campos_productor_id_productores_id_fk" FOREIGN KEY ("productor_id") REFERENCES "public"."productores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campos" ADD CONSTRAINT "campos_foto_mapa_id_fotos_id_fk" FOREIGN KEY ("foto_mapa_id") REFERENCES "public"."fotos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
INSERT INTO "categorias_gasto" ("nombre") VALUES ('Alquiler / arrendamiento'), ('Flete'), ('Seguro'), ('Honorarios'), ('Impuestos'), ('Otros');