CREATE TABLE "fotos" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "fotos_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"campo_id" integer,
	"lote_id" integer,
	"labor_id" integer,
	"ruta" text NOT NULL,
	"fecha" date NOT NULL,
	"nota" text,
	"ancho" integer,
	"alto" integer,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fotos_ruta_unique" UNIQUE("ruta"),
	CONSTRAINT "fotos_un_destino" CHECK (num_nonnulls("fotos"."campo_id", "fotos"."lote_id", "fotos"."labor_id") = 1)
);
--> statement-breakpoint
ALTER TABLE "fotos" ADD CONSTRAINT "fotos_campo_id_campos_id_fk" FOREIGN KEY ("campo_id") REFERENCES "public"."campos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fotos" ADD CONSTRAINT "fotos_lote_id_lotes_id_fk" FOREIGN KEY ("lote_id") REFERENCES "public"."lotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fotos" ADD CONSTRAINT "fotos_labor_id_labores_id_fk" FOREIGN KEY ("labor_id") REFERENCES "public"."labores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fotos_campo_id_index" ON "fotos" USING btree ("campo_id");--> statement-breakpoint
CREATE INDEX "fotos_lote_id_index" ON "fotos" USING btree ("lote_id");--> statement-breakpoint
CREATE INDEX "fotos_labor_id_index" ON "fotos" USING btree ("labor_id");--> statement-breakpoint
-- Bucket privado de Supabase Storage para los archivos de las fotos (solo imágenes, hasta 5 MB).
-- La app accede con la clave secreta desde el servidor; los navegadores ven las fotos con URLs firmadas.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('fotos', 'fotos', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;
