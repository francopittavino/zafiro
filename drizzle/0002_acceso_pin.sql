CREATE TABLE "intentos_acceso" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "intentos_acceso_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"ip" text NOT NULL,
	"exitoso" boolean NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sesiones" (
	"id" text PRIMARY KEY NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"expira_en" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "intentos_acceso_ip_creado_en_index" ON "intentos_acceso" USING btree ("ip","creado_en");