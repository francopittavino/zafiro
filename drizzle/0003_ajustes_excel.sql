CREATE TYPE "public"."cotizacion_labor" AS ENUM('litros_gasoil', 'usd_fijo');--> statement-breakpoint
ALTER TYPE "public"."categoria_producto" ADD VALUE 'fertilizante_foliar';--> statement-breakpoint
ALTER TYPE "public"."categoria_producto" ADD VALUE 'inoculante';--> statement-breakpoint
ALTER TYPE "public"."categoria_producto" ADD VALUE 'curasemilla';--> statement-breakpoint
ALTER TYPE "public"."unidad" ADD VALUE 'tn';--> statement-breakpoint
ALTER TYPE "public"."unidad" ADD VALUE 'bolsa';--> statement-breakpoint
ALTER TYPE "public"."unidad" ADD VALUE 'pack';--> statement-breakpoint
ALTER TYPE "public"."unidad" ADD VALUE 'dosis';--> statement-breakpoint
CREATE TABLE "aportes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "aportes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"nombre" text NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "aportes_nombre_unique" UNIQUE("nombre")
);
--> statement-breakpoint
CREATE TABLE "configuracion" (
	"clave" text PRIMARY KEY NOT NULL,
	"valor" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cotizaciones" (
	"fecha" date PRIMARY KEY NOT NULL,
	"tipo_cambio" numeric(14, 4) NOT NULL,
	"precio_gasoil" numeric(14, 4) NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tipos_labor" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tipos_labor_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"nombre" text NOT NULL,
	"categoria" "tipo_labor" NOT NULL,
	"cotizacion" "cotizacion_labor" NOT NULL,
	"litros_gasoil_ha" numeric(10, 2),
	"costo_usd_ha" numeric(14, 4),
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tipos_labor_nombre_unique" UNIQUE("nombre")
);
--> statement-breakpoint
ALTER TABLE "labor_insumos" ALTER COLUMN "precio_unitario" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "labor_insumos" ALTER COLUMN "moneda" SET DEFAULT 'USD';--> statement-breakpoint
ALTER TABLE "labor_insumos" ALTER COLUMN "moneda" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "lotes" ALTER COLUMN "superficie_ha" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "precios_producto" ALTER COLUMN "moneda" SET DEFAULT 'USD';--> statement-breakpoint
ALTER TABLE "ciclos" ADD COLUMN "fecha_cosecha" date;--> statement-breakpoint
ALTER TABLE "ciclos" ADD COLUMN "precio_pizarra" numeric(14, 4);--> statement-breakpoint
ALTER TABLE "ciclos" ADD COLUMN "arrendamiento_porcentaje" numeric(6, 4);--> statement-breakpoint
ALTER TABLE "ciclos" ADD COLUMN "arrendamiento_kg_ha" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "ciclos" ADD COLUMN "gastos_comercializacion_porcentaje" numeric(6, 4);--> statement-breakpoint
ALTER TABLE "ciclos" ADD COLUMN "flete_usd_tn" numeric(14, 4);--> statement-breakpoint
ALTER TABLE "ciclos" ADD COLUMN "bonificacion_porcentaje" numeric(6, 4);--> statement-breakpoint
ALTER TABLE "labores" ADD COLUMN "tipo_labor_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "labores" ADD COLUMN "aporte_id" integer;--> statement-breakpoint
ALTER TABLE "lotes" ADD COLUMN "codigo" text;--> statement-breakpoint
ALTER TABLE "labores" ADD CONSTRAINT "labores_tipo_labor_id_tipos_labor_id_fk" FOREIGN KEY ("tipo_labor_id") REFERENCES "public"."tipos_labor"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labores" ADD CONSTRAINT "labores_aporte_id_aportes_id_fk" FOREIGN KEY ("aporte_id") REFERENCES "public"."aportes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campos" ADD CONSTRAINT "campos_nombre_unique" UNIQUE("nombre");--> statement-breakpoint
ALTER TABLE "lotes" ADD CONSTRAINT "lotes_codigo_unique" UNIQUE("codigo");--> statement-breakpoint
ALTER TABLE "productos" ADD CONSTRAINT "productos_nombreComercial_unique" UNIQUE("nombre_comercial");