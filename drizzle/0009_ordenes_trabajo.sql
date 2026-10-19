CREATE TYPE "public"."estado_orden" AS ENUM('pendiente', 'enviada', 'realizada', 'anulada');--> statement-breakpoint
CREATE TABLE "orden_gastos" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "orden_gastos_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"orden_id" integer NOT NULL,
	"concepto" text NOT NULL,
	"importe" numeric(14, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orden_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "orden_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"orden_id" integer NOT NULL,
	"producto_id" integer NOT NULL,
	"dosis_por_ha" numeric(12, 4) NOT NULL,
	"precio_unitario" numeric(14, 4) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ordenes_trabajo" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ordenes_trabajo_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"numero" integer NOT NULL,
	"fecha" date NOT NULL,
	"ciclo_id" integer NOT NULL,
	"receta_id" integer,
	"tipo_labor_id" integer,
	"fecha_prevista" date,
	"superficie_ha" numeric(10, 2) NOT NULL,
	"modalidad" "modalidad_labor",
	"contratista_id" integer,
	"cobro" "cobro_labor" DEFAULT 'ha' NOT NULL,
	"costo_labor_por_ha" numeric(14, 4),
	"horas" numeric(10, 2),
	"costo_hora" numeric(14, 4),
	"instrucciones" text,
	"observaciones" text,
	"mostrar_costos" boolean DEFAULT true NOT NULL,
	"estado" "estado_orden" DEFAULT 'pendiente' NOT NULL,
	"labor_id" integer,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orden_gastos" ADD CONSTRAINT "orden_gastos_orden_id_ordenes_trabajo_id_fk" FOREIGN KEY ("orden_id") REFERENCES "public"."ordenes_trabajo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orden_items" ADD CONSTRAINT "orden_items_orden_id_ordenes_trabajo_id_fk" FOREIGN KEY ("orden_id") REFERENCES "public"."ordenes_trabajo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orden_items" ADD CONSTRAINT "orden_items_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordenes_trabajo" ADD CONSTRAINT "ordenes_trabajo_ciclo_id_ciclos_id_fk" FOREIGN KEY ("ciclo_id") REFERENCES "public"."ciclos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordenes_trabajo" ADD CONSTRAINT "ordenes_trabajo_receta_id_recetas_id_fk" FOREIGN KEY ("receta_id") REFERENCES "public"."recetas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordenes_trabajo" ADD CONSTRAINT "ordenes_trabajo_tipo_labor_id_tipos_labor_id_fk" FOREIGN KEY ("tipo_labor_id") REFERENCES "public"."tipos_labor"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordenes_trabajo" ADD CONSTRAINT "ordenes_trabajo_contratista_id_contratistas_id_fk" FOREIGN KEY ("contratista_id") REFERENCES "public"."contratistas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordenes_trabajo" ADD CONSTRAINT "ordenes_trabajo_labor_id_labores_id_fk" FOREIGN KEY ("labor_id") REFERENCES "public"."labores"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "orden_gastos_orden_id_index" ON "orden_gastos" USING btree ("orden_id");--> statement-breakpoint
CREATE INDEX "orden_items_orden_id_index" ON "orden_items" USING btree ("orden_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ordenes_trabajo_numero_index" ON "ordenes_trabajo" USING btree ("numero");--> statement-breakpoint
CREATE INDEX "ordenes_trabajo_ciclo_id_index" ON "ordenes_trabajo" USING btree ("ciclo_id");