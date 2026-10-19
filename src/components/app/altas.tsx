"use client";

import { useEffect, useState, useTransition } from "react";
import { Camera, MapPin } from "lucide-react";
import type { Dibujo } from "@/db/schema";
import type { FotoMapa } from "@/lib/fotos";
import { Dialogo } from "./dialogo";
import { EditorDibujo, completas, subirFotoMapa, type LoteMapa } from "./mapa";
import { mapaParaMarcar } from "@/app/(app)/acciones-mapa";
import { CamposExtra, leerExtras } from "./campos-extra";
import type { Campo, Catalogo, CampoPersonalizado, Lote, Producto, Productor } from "@/lib/datos";
import { CATEGORIAS_LABOR, CATEGORIAS_PRODUCTO, CULTIVOS_SUGERIDOS, UNIDADES } from "@/lib/catalogos";
import { campaniaSugerida, hoyIso, leerNumero, numeroEditable } from "@/lib/formato";
import { aGms, leerCoordenada, leerPar, type Eje } from "@/lib/coordenadas";
import { cn } from "@/lib/utils";
import {
  crearEnLista,
  crearTipoLabor,
  guardarCampo,
  guardarCotizacion,
  guardarLote,
  guardarProductor,
  guardarProducto,
  type ListaSimple,
  type ResultadoAlta,
} from "@/app/(app)/acciones-catalogos";

/** Formularios de alta y edición que se abren en un Dialogo desde cualquier pantalla. */

export const etiqueta = "flex flex-col gap-1 text-sm font-bold";
export const entrada =
  "bg-card h-11 w-full rounded-lg border border-input px-3 font-normal outline-none focus:border-ring focus:ring-3 focus:ring-ring/30";
export const areaTexto =
  "bg-card border-input focus:border-ring w-full rounded-lg border p-3 font-normal outline-none";

/** Se llama al guardar: `id` es el registro creado (no viene en modo demo). */
type AlGuardar = (id?: number) => void;

/** Envía una acción y maneja "guardando…" y el mensaje de error. */
export function useEnvio(alGuardar: AlGuardar) {
  const [error, setError] = useState("");
  const [guardando, iniciar] = useTransition();
  const enviar = (accion: () => Promise<ResultadoAlta>) =>
    iniciar(async () => {
      const resultado = await accion();
      if (!resultado.ok) setError(resultado.error);
      else alGuardar(resultado.id);
    });
  return { error, setError, guardando, enviar };
}

export function Pie({ error, guardando, texto = "Guardar" }: { error: string; guardando: boolean; texto?: string }) {
  return (
    <>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={guardando}
        className="bg-primary text-primary-foreground h-12 rounded-xl font-bold disabled:opacity-50"
      >
        {guardando ? "Guardando…" : texto}
      </button>
    </>
  );
}

/** Bloque plegable con los datos opcionales, para que el formulario corto quede corto. */
export function MasDatos({ children, abierto = false }: { children: React.ReactNode; abierto?: boolean }) {
  return (
    <details open={abierto} className="group rounded-xl border">
      <summary className="text-zafiro flex h-11 cursor-pointer items-center px-3 text-sm font-bold">
        <span className="group-open:hidden">+ Más datos (opcionales)</span>
        <span className="hidden group-open:inline">− Más datos (opcionales)</span>
      </summary>
      <div className="flex flex-col gap-3 border-t p-3">{children}</div>
    </details>
  );
}

/** Lee un número opcional del formulario: vacío → null; inválido → NaN (para avisar). */
export function numeroOpcional(f: FormData, nombre: string) {
  const valor = String(f.get(nombre) ?? "").trim();
  return valor ? leerNumero(valor) : null;
}

const textoGms = (v: number | null | undefined, eje: Eje) => (v == null ? "" : aGms(v, eje));
const MENSAJE_COORDENADAS = `Completá la latitud y la longitud (ej. 32°28'57.14"S y 59°15'19.07"O).`;

/** Lee latitud y longitud del formulario (en grados, minutos y segundos o decimales). */
function leerCoordenadas(f: FormData) {
  const latitud = leerCoordenada(String(f.get("latitud") ?? ""), "lat");
  const longitud = leerCoordenada(String(f.get("longitud") ?? ""), "lon");
  return Number.isNaN(latitud) || Number.isNaN(longitud) ? null : { latitud, longitud };
}

/**
 * Latitud y longitud (obligatorias), en grados, minutos y segundos (59°15'19.07"O).
 * Se pueden pegar juntas como las copia Google Maps o tomar la ubicación del celular parado en el campo.
 */
function Coordenadas({ latitud, longitud }: { latitud?: number | null; longitud?: number | null }) {
  const [lat, setLat] = useState(textoGms(latitud, "lat"));
  const [lon, setLon] = useState(textoGms(longitud, "lon"));
  const [aviso, setAviso] = useState("");
  const [buscando, setBuscando] = useState(false);

  function pegar(e: React.ClipboardEvent<HTMLInputElement>) {
    const par = leerPar(e.clipboardData.getData("text"));
    if (!par) return;
    e.preventDefault();
    setLat(aGms(par[0], "lat"));
    setLon(aGms(par[1], "lon"));
  }

  /** Al salir del campo, lo que se escribió se pasa al formato 59°15'19.07"O (si se entiende). */
  function ordenar(texto: string, eje: Eje, poner: (v: string) => void) {
    const valor = leerCoordenada(texto, eje);
    if (!Number.isNaN(valor)) poner(aGms(valor, eje));
  }

  function miUbicacion() {
    if (!navigator.geolocation) return setAviso("Este dispositivo no da la ubicación.");
    setBuscando(true);
    setAviso("");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLat(aGms(p.coords.latitude, "lat"));
        setLon(aGms(p.coords.longitude, "lon"));
        setBuscando(false);
      },
      () => {
        setAviso("No se pudo tomar la ubicación (¿permiso del navegador?).");
        setBuscando(false);
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="grid grid-cols-2 gap-3">
        <label className={etiqueta}>
          Latitud *
          <input
            name="latitud"
            className={entrada}
            autoComplete="off"
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            onBlur={(e) => ordenar(e.target.value, "lat", setLat)}
            onPaste={pegar}
            placeholder={`32°28'57.14"S`}
            required
          />
        </label>
        <label className={etiqueta}>
          Longitud *
          <input
            name="longitud"
            className={entrada}
            autoComplete="off"
            value={lon}
            onChange={(e) => setLon(e.target.value)}
            onBlur={(e) => ordenar(e.target.value, "lon", setLon)}
            onPaste={pegar}
            placeholder={`59°15'19.07"O`}
            required
          />
        </label>
      </div>
      <p className="text-muted-foreground text-xs">
        Grados, minutos y segundos. En el celular también podés escribir “59 15 19,07”: sin letra se toma sur y
        oeste.
      </p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <button
          type="button"
          onClick={miUbicacion}
          disabled={buscando}
          className="text-zafiro flex items-center gap-1 font-bold disabled:opacity-50"
        >
          <MapPin className="size-3.5" aria-hidden />
          {buscando ? "Buscando…" : "Usar mi ubicación"}
        </button>
        <span className="text-muted-foreground">o pegá las dos juntas desde Google Maps</span>
      </div>
      {aviso && <p className="text-destructive text-xs">{aviso}</p>}
    </div>
  );
}

// ─── Botón que abre un formulario ───────────────────────────────────────────

/** Botón (ej. "+ Campo") que abre el formulario en un Dialogo y lo cierra al guardar. */
export function BotonAlta({
  texto,
  titulo,
  variante = "primario",
  formulario,
}: {
  texto: string;
  titulo: string;
  variante?: "primario" | "secundario";
  formulario: (alGuardar: AlGuardar) => React.ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className={cn(
          "h-10 rounded-lg px-3 text-sm font-bold",
          variante === "primario" ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted border",
        )}
      >
        {texto}
      </button>
      <Dialogo abierto={abierto} alCerrar={() => setAbierto(false)} titulo={titulo}>
        {formulario(() => setAbierto(false))}
      </Dialogo>
    </>
  );
}

// ─── Productor ──────────────────────────────────────────────────────────────

export function FormProductor({
  inicial,
  productorId,
  alGuardar,
}: {
  inicial?: Productor;
  productorId?: number;
  alGuardar: AlGuardar;
}) {
  const { error, guardando, enviar } = useEnvio(alGuardar);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const campo = (n: string) => String(f.get(n) ?? "");
        enviar(() =>
          guardarProductor(
            {
              nombre: campo("nombre"),
              cuit: campo("cuit"),
              telefono: campo("telefono"),
              email: campo("email"),
              localidad: campo("localidad"),
              notas: campo("notas"),
            },
            productorId,
          ),
        );
      }}
      className="flex flex-col gap-3"
    >
      <label className={etiqueta}>
        Nombre o razón social *
        <input name="nombre" className={entrada} defaultValue={inicial?.nombre} required autoFocus />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className={etiqueta}>
          Teléfono
          <input name="telefono" type="tel" className={entrada} defaultValue={inicial?.telefono ?? ""} />
        </label>
        <label className={etiqueta}>
          CUIT
          <input name="cuit" className={entrada} defaultValue={inicial?.cuit ?? ""} />
        </label>
      </div>
      <label className={etiqueta}>
        Email
        <input name="email" type="email" className={entrada} defaultValue={inicial?.email ?? ""} />
      </label>
      <label className={etiqueta}>
        Localidad
        <input name="localidad" className={entrada} defaultValue={inicial?.localidad ?? ""} />
      </label>
      <label className={etiqueta}>
        Notas
        <textarea name="notas" rows={2} className={areaTexto} defaultValue={inicial?.notas ?? ""} />
      </label>
      <Pie error={error} guardando={guardando} texto={productorId ? "Guardar cambios" : "Guardar"} />
    </form>
  );
}

// ─── Campo ──────────────────────────────────────────────────────────────────

export function FormCampo({
  productores = [],
  personalizados = [],
  inicial,
  campoId,
  alGuardar,
}: {
  productores?: Productor[];
  personalizados?: CampoPersonalizado[];
  inicial?: Campo;
  campoId?: number;
  alGuardar: AlGuardar;
}) {
  const { error, setError, guardando, enviar } = useEnvio(alGuardar);
  const extras = personalizados.filter((c) => c.entidad === "campo");
  // Foto del mapa (solo en el alta): se sube después de crear el campo.
  const [fotoMapa, setFotoMapa] = useState<File | null>(null);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const coordenadas = leerCoordenadas(f);
        if (!coordenadas) return setError(MENSAJE_COORDENADAS);
        const { latitud, longitud } = coordenadas;
        const productor = String(f.get("productorId") ?? "");
        enviar(async () => {
          const r = await guardarCampo(
            {
              nombre: String(f.get("nombre")),
              productorId: productor ? Number(productor) : null,
              localidad: String(f.get("localidad") ?? ""),
              provincia: String(f.get("provincia") ?? ""),
              latitud,
              longitud,
              notas: String(f.get("notas") ?? ""),
              extras: leerExtras(f),
            },
            campoId,
          );
          if (r.ok && r.id && fotoMapa) {
            const falla = await subirFotoMapa(r.id, fotoMapa);
            // El campo ya quedó guardado: la foto se puede volver a subir desde su ficha.
            if (falla) window.alert(`El campo se guardó, pero la foto del mapa no: ${falla}`);
          }
          return r;
        });
      }}
      className="flex flex-col gap-3"
    >
      <label className={etiqueta}>
        Nombre *
        <input
          name="nombre"
          className={entrada}
          defaultValue={inicial?.nombre}
          placeholder="Ej. Estancia Santa Marta"
          required
          autoFocus
        />
      </label>
      <label className={etiqueta}>
        Productor
        <select name="productorId" className={entrada} defaultValue={inicial?.productorId ?? ""}>
          <option value="">Sin productor</option>
          {productores.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className={etiqueta}>
          Localidad
          <input name="localidad" className={entrada} defaultValue={inicial?.localidad ?? ""} />
        </label>
        <label className={etiqueta}>
          Provincia
          <input name="provincia" className={entrada} defaultValue={inicial?.provincia ?? "Entre Ríos"} />
        </label>
      </div>
      <Coordenadas latitud={inicial?.latitud} longitud={inicial?.longitud} />
      {campoId === undefined && (
        <div className="flex flex-col gap-1">
          <p className="text-sm font-bold">Foto del mapa</p>
          <label className="bg-card hover:bg-muted flex h-11 cursor-pointer items-center gap-2 rounded-lg border border-dashed px-3 text-sm has-focus-visible:ring-3 has-focus-visible:ring-ring/50">
            <Camera className="text-zafiro size-4 shrink-0" aria-hidden />
            <span className="truncate">{fotoMapa ? fotoMapa.name : "Elegí una foto aérea o captura de Google Maps"}</span>
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => setFotoMapa(e.target.files?.[0] ?? null)}
            />
          </label>
          <p className="text-muted-foreground text-xs">
            Opcional. Sobre esta foto vas a marcar cada lote (al cargarlo o desde la ficha del campo).
          </p>
        </div>
      )}
      <MasDatos>
        <CamposExtra campos={extras} valores={inicial?.extras} etiqueta={etiqueta} entrada={entrada} />
        <label className={etiqueta}>
          Notas
          <textarea name="notas" rows={2} className={areaTexto} defaultValue={inicial?.notas ?? ""} />
        </label>
      </MasDatos>
      <Pie error={error} guardando={guardando} texto={campoId ? "Guardar cambios" : "Guardar"} />
    </form>
  );
}

// ─── Lote (alta y edición) ──────────────────────────────────────────────────

export function FormLote({
  campos,
  personalizados = [],
  inicial,
  loteId,
  alGuardar,
}: {
  campos: Campo[];
  personalizados?: CampoPersonalizado[];
  inicial?: Partial<Lote>;
  loteId?: number;
  alGuardar: AlGuardar;
}) {
  const { error, setError, guardando, enviar } = useEnvio(alGuardar);
  const [campoId, setCampoId] = useState(inicial?.campoId ? String(inicial.campoId) : "");
  const nuevoCampo = campoId === "__nuevo__";
  const extras = personalizados.filter((c) => c.entidad === "lote");
  // Mapa del campo elegido (se pide al cambiar de campo; `campoId` dice de cuál es).
  const [mapa, setMapa] = useState<{ campoId: string; datos: { foto: FotoMapa; lotes: LoteMapa[] } | null } | null>(null);
  const [dibujo, setDibujo] = useState<Dibujo[]>(inicial?.dibujo ? [inicial.dibujo] : []);
  const [dibujoTocado, setDibujoTocado] = useState(false);
  const mapaDelCampo = mapa?.campoId === campoId ? mapa.datos : null;
  const [vueltaMapa, setVueltaMapa] = useState(0);
  const [subiendo, iniciarSubida] = useTransition();
  const [errorFoto, setErrorFoto] = useState("");
  const campoElegido = campos.find((c) => String(c.id) === campoId);

  useEffect(() => {
    const id = Number(campoId);
    if (!campoId || !Number.isInteger(id)) return;
    let vigente = true;
    mapaParaMarcar(id).then(
      (datos) => vigente && setMapa({ campoId, datos }),
      () => vigente && setMapa({ campoId, datos: null }),
    );
    return () => {
      vigente = false;
    };
  }, [campoId, vueltaMapa]);

  function subirMapa(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (!archivo || !campoElegido) return;
    setErrorFoto("");
    iniciarSubida(async () => {
      const falla = await subirFotoMapa(campoElegido.id, archivo);
      if (falla) setErrorFoto(falla);
      else setVueltaMapa((v) => v + 1);
    });
  }

  /** Contorno a guardar: undefined deja el que estaba; null lo borra. */
  function contornoAGuardar(): Dibujo | null | undefined {
    if (dibujoTocado) return completas(dibujo)[0] ?? null;
    // Si se pasó el lote a otro campo, el contorno era sobre la foto del campo anterior.
    if (inicial?.campoId && String(inicial.campoId) !== campoId) return null;
    return undefined;
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const ha = leerNumero(String(f.get("ha")));
        if (!(ha > 0)) return setError("La superficie tiene que ser un número mayor a 0.");
        const coordenadas = leerCoordenadas(f);
        if (!coordenadas) return setError(MENSAJE_COORDENADAS);
        const { latitud, longitud } = coordenadas;
        const tenencia = String(f.get("tenencia") ?? "");
        if (dibujoTocado && dibujo.length && !completas(dibujo).length)
          return setError("Marcá al menos 3 puntos del lote en el mapa (o borrá el contorno).");
        enviar(() =>
          guardarLote(
            {
              campoId: nuevoCampo ? null : Number(campoId),
              nuevoCampo: nuevoCampo ? String(f.get("nuevoCampo")) : undefined,
              nombre: String(f.get("nombre")),
              codigo: String(f.get("codigo")),
              ha,
              cultivo: String(f.get("cultivo")),
              campania: String(f.get("campania") ?? "") || undefined,
              variedad: String(f.get("variedad") ?? ""),
              fechaSiembra: String(f.get("fechaSiembra") ?? ""),
              tenencia: tenencia === "propio" || tenencia === "alquilado" ? tenencia : null,
              tipoSuelo: String(f.get("tipoSuelo") ?? ""),
              latitud,
              longitud,
              notas: String(f.get("notas") ?? ""),
              extras: leerExtras(f),
              dibujo: contornoAGuardar(),
            },
            loteId,
          ),
        );
      }}
      className="flex flex-col gap-3"
    >
      <label className={etiqueta}>
        Campo *
        <select className={entrada} value={campoId} onChange={(e) => setCampoId(e.target.value)} required>
          <option value="">Elegí un campo…</option>
          {campos.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
          <option value="__nuevo__">+ Nuevo campo…</option>
        </select>
      </label>
      {nuevoCampo && (
        <label className={etiqueta}>
          Nombre del campo nuevo *
          <input name="nuevoCampo" className={entrada} required autoFocus />
        </label>
      )}
      <div className="grid grid-cols-[1fr_110px] gap-3">
        <label className={etiqueta}>
          Nombre del lote *
          <input name="nombre" className={entrada} defaultValue={inicial?.nombre} placeholder="Ej. La Planta" required />
        </label>
        <label className={etiqueta}>
          Código
          <input name="codigo" className={entrada} defaultValue={inicial?.codigo} placeholder="SM 1" />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className={etiqueta}>
          Superficie (ha) *
          <input
            name="ha"
            className={entrada}
            inputMode="decimal"
            defaultValue={inicial?.ha ? numeroEditable(inicial.ha) : ""}
            required
          />
        </label>
        <label className={etiqueta}>
          Cultivo en curso
          <input name="cultivo" className={entrada} list="cultivos" defaultValue={inicial?.cultivo} />
          <datalist id="cultivos">
            {CULTIVOS_SUGERIDOS.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
      </div>
      {/* La campaña solo hace falta si el cultivo es nuevo (alta, o un lote sin cultivo en curso). */}
      {!inicial?.cultivo && (
        <label className={etiqueta}>
          Campaña del cultivo
          <input name="campania" className={entrada} defaultValue={campaniaSugerida()} placeholder="2025/26" />
        </label>
      )}
      {/* En el alta se proponen las coordenadas del campo (después se ajustan). */}
      <Coordenadas
        key={loteId ? "lote" : campoId}
        latitud={inicial?.latitud ?? (loteId ? null : campoElegido?.latitud)}
        longitud={inicial?.longitud ?? (loteId ? null : campoElegido?.longitud)}
      />
      {nuevoCampo ? (
        <p className="bg-muted/60 text-muted-foreground rounded-lg p-3 text-xs">
          Mapa: guardá el lote y después subí la foto del campo desde su ficha para marcar los lotes.
        </p>
      ) : mapaDelCampo ? (
        <div className="flex flex-col gap-1">
          <p className="text-sm font-bold">Marcá el lote en el mapa del campo</p>
          <EditorDibujo
            foto={mapaDelCampo.foto}
            fondo={mapaDelCampo.lotes.filter((l) => l.id !== loteId)}
            figuras={dibujo}
            alCambiar={(f) => {
              setDibujo(f.slice(-1));
              setDibujoTocado(true);
            }}
          />
        </div>
      ) : (
        mapa?.campoId === campoId && (
          <div className="bg-muted/60 flex flex-col gap-2 rounded-lg p-3 text-sm">
            <p>
              <span className="font-bold">{campoElegido?.nombre} todavía no tiene foto del mapa.</span>{" "}
              <span className="text-muted-foreground">Subila acá y marcá el lote tocando sus esquinas.</span>
            </p>
            <label className="bg-primary text-primary-foreground flex h-10 w-fit cursor-pointer items-center gap-2 rounded-lg px-3 font-bold has-focus-visible:ring-3 has-focus-visible:ring-ring/50">
              <Camera className="size-4" aria-hidden />
              {subiendo ? "Subiendo…" : "Subir foto del mapa"}
              <input type="file" accept="image/*" onChange={subirMapa} className="sr-only" disabled={subiendo} />
            </label>
            {errorFoto && <p className="text-destructive text-xs">{errorFoto}</p>}
          </div>
        )
      )}
      <MasDatos>
        <div className="grid grid-cols-2 gap-3">
          <label className={etiqueta}>
            Variedad / híbrido
            <input name="variedad" className={entrada} defaultValue={inicial?.variedad ?? ""} />
          </label>
          <label className={etiqueta}>
            Fecha de siembra
            <input name="fechaSiembra" type="date" className={entrada} defaultValue={inicial?.fechaSiembra ?? ""} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className={etiqueta}>
            Tenencia
            <select name="tenencia" className={entrada} defaultValue={inicial?.tenencia ?? ""}>
              <option value="">Sin dato</option>
              <option value="propio">Propio</option>
              <option value="alquilado">Alquilado</option>
            </select>
          </label>
          <label className={etiqueta}>
            Tipo de suelo
            <input name="tipoSuelo" className={entrada} defaultValue={inicial?.tipoSuelo ?? ""} />
          </label>
        </div>
        <CamposExtra campos={extras} valores={inicial?.extras} etiqueta={etiqueta} entrada={entrada} />
        <label className={etiqueta}>
          Notas
          <textarea name="notas" rows={2} className={areaTexto} defaultValue={inicial?.notas ?? ""} />
        </label>
      </MasDatos>
      <Pie error={error} guardando={guardando} texto={loteId ? "Guardar cambios" : "Guardar"} />
    </form>
  );
}

// ─── Insumo ─────────────────────────────────────────────────────────────────

export function FormProducto({
  proveedores = [],
  personalizados = [],
  inicial,
  productoId,
  alGuardar,
}: {
  proveedores?: Catalogo[];
  personalizados?: CampoPersonalizado[];
  inicial?: Producto;
  productoId?: number;
  alGuardar: AlGuardar;
}) {
  const { error, setError, guardando, enviar } = useEnvio(alGuardar);
  const extras = personalizados.filter((c) => c.entidad === "producto");
  const editando = productoId !== undefined;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const precio = editando ? undefined : leerNumero(String(f.get("precio")));
        if (precio !== undefined && !(precio >= 0)) return setError("Escribí un precio válido (ej. 5,75).");
        const carencia = numeroOpcional(f, "carenciaDias");
        if (carencia !== null && !(Number.isInteger(carencia) && carencia >= 0))
          return setError("La carencia va en días (número entero).");
        const proveedor = String(f.get("proveedorId") ?? "");
        const campo = (n: string) => String(f.get(n) ?? "");
        enviar(() =>
          guardarProducto(
            {
              nombre: campo("nombre"),
              categoria: campo("categoria"),
              unidad: campo("unidad"),
              precio,
              proveedorId: proveedor ? Number(proveedor) : null,
              principioActivo: campo("principioActivo"),
              concentracion: campo("concentracion"),
              formulacion: campo("formulacion"),
              presentacion: campo("presentacion"),
              bandaToxicologica: campo("bandaToxicologica"),
              carenciaDias: carencia,
              notas: campo("notas"),
              extras: leerExtras(f),
            },
            productoId,
          ),
        );
      }}
      className="flex flex-col gap-3"
    >
      <label className={etiqueta}>
        Nombre comercial *
        <input
          name="nombre"
          className={entrada}
          defaultValue={inicial?.nombre}
          placeholder="Ej. Glifosato 66%"
          required
          autoFocus
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className={etiqueta}>
          Tipo *
          <select name="categoria" className={entrada} required defaultValue={inicial?.categoria ?? ""}>
            <option value="" disabled>
              Elegí…
            </option>
            {CATEGORIAS_PRODUCTO.map((c) => (
              <option key={c.valor} value={c.valor}>
                {c.texto}
              </option>
            ))}
          </select>
        </label>
        <label className={etiqueta}>
          Unidad *
          <select name="unidad" className={entrada} required defaultValue={inicial?.unidad ?? ""}>
            <option value="" disabled>
              Elegí…
            </option>
            {UNIDADES.map((u) => (
              <option key={u.valor} value={u.valor}>
                {u.texto}
              </option>
            ))}
          </select>
        </label>
      </div>
      {!editando && (
        <div className="grid grid-cols-2 gap-3">
          <label className={etiqueta}>
            Precio USD por unidad *
            <input name="precio" className={entrada} inputMode="decimal" required />
          </label>
          <label className={etiqueta}>
            Proveedor
            <select name="proveedorId" className={entrada} defaultValue="">
              <option value="">Sin dato</option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      <label className={etiqueta}>
        Principio activo
        <input name="principioActivo" className={entrada} defaultValue={inicial?.principioActivo ?? ""} />
      </label>
      <MasDatos>
        <div className="grid grid-cols-2 gap-3">
          <label className={etiqueta}>
            Concentración
            <input name="concentracion" className={entrada} defaultValue={inicial?.concentracion ?? ""} placeholder="Ej. 66,2%" />
          </label>
          <label className={etiqueta}>
            Formulación
            <input name="formulacion" className={entrada} defaultValue={inicial?.formulacion ?? ""} placeholder="Ej. SL, EC" />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className={etiqueta}>
            Presentación
            <input name="presentacion" className={entrada} defaultValue={inicial?.presentacion ?? ""} placeholder="Bidón 20 L" />
          </label>
          <label className={etiqueta}>
            Banda toxicológica
            <select name="bandaToxicologica" className={entrada} defaultValue={inicial?.bandaToxicologica ?? ""}>
              <option value="">Sin dato</option>
              {["Ia (roja)", "Ib (roja)", "II (amarilla)", "III (azul)", "IV (verde)"].map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className={etiqueta}>
          Carencia (días)
          <input
            name="carenciaDias"
            className={entrada}
            inputMode="numeric"
            defaultValue={inicial?.carenciaDias ?? ""}
          />
        </label>
        <CamposExtra campos={extras} valores={inicial?.extras} etiqueta={etiqueta} entrada={entrada} />
        <label className={etiqueta}>
          Notas
          <textarea name="notas" rows={2} className={areaTexto} defaultValue={inicial?.notas ?? ""} />
        </label>
      </MasDatos>
      {!editando && (
        <p className="text-muted-foreground text-xs">La dosis se carga en la misma unidad que el precio (ej. L/ha y USD/L).</p>
      )}
      <Pie error={error} guardando={guardando} texto={editando ? "Guardar cambios" : "Guardar"} />
    </form>
  );
}

// ─── Tipo de labor ──────────────────────────────────────────────────────────

export function FormTipoLabor({ alGuardar }: { alGuardar: AlGuardar }) {
  const { error, setError, guardando, enviar } = useEnvio(alGuardar);
  const [cotizacion, setCotizacion] = useState<"litros_gasoil" | "usd_fijo">("litros_gasoil");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const valor = leerNumero(String(f.get("valor")));
        if (!(valor >= 0)) return setError("Escribí una tarifa válida.");
        enviar(() =>
          crearTipoLabor({
            nombre: String(f.get("nombre")),
            categoria: String(f.get("categoria")),
            cotizacion,
            valor,
          }),
        );
      }}
      className="flex flex-col gap-3"
    >
      <label className={etiqueta}>
        Nombre *
        <input name="nombre" className={entrada} placeholder="Ej. Pasada de disco" required autoFocus />
      </label>
      <label className={etiqueta}>
        Tipo *
        <select name="categoria" className={entrada} required defaultValue="">
          <option value="" disabled>
            Elegí…
          </option>
          {CATEGORIAS_LABOR.map((c) => (
            <option key={c.valor} value={c.valor}>
              {c.texto}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-bold">¿Cómo se cotiza? *</legend>
        <div className="grid grid-cols-2 gap-2 text-sm">
          {(
            [
              ["litros_gasoil", "Litros de gasoil/ha"],
              ["usd_fijo", "USD/ha fijo"],
            ] as const
          ).map(([valor, texto]) => (
            <label
              key={valor}
              className={cn(
                "flex h-11 cursor-pointer items-center justify-center rounded-lg border font-bold",
                cotizacion === valor && "border-primary bg-zafiro-suave text-primary",
              )}
            >
              <input
                type="radio"
                name="cotizacion"
                value={valor}
                checked={cotizacion === valor}
                onChange={() => setCotizacion(valor)}
                className="sr-only"
              />
              {texto}
            </label>
          ))}
        </div>
      </fieldset>
      <label className={etiqueta}>
        {cotizacion === "litros_gasoil" ? "Litros de gasoil por ha *" : "USD por ha *"}
        <input name="valor" className={entrada} inputMode="decimal" required />
      </label>
      <p className="text-muted-foreground text-xs">Si la labor se cobra por hora, se elige al registrarla.</p>
      <Pie error={error} guardando={guardando} />
    </form>
  );
}

// ─── Elemento de una lista simple (aporte, contratista, proveedor, categoría de gasto) ──

export function FormListaSimple({
  lista,
  placeholder,
  alGuardar,
}: {
  lista: ListaSimple;
  placeholder?: string;
  alGuardar: AlGuardar;
}) {
  const { error, guardando, enviar } = useEnvio(alGuardar);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        enviar(() => crearEnLista(lista, { nombre: String(f.get("nombre")) }));
      }}
      className="flex flex-col gap-3"
    >
      <label className={etiqueta}>
        Nombre *
        <input name="nombre" className={entrada} placeholder={placeholder} required autoFocus />
      </label>
      <Pie error={error} guardando={guardando} />
    </form>
  );
}

// ─── Cotización ─────────────────────────────────────────────────────────────

export function FormCotizacion({
  actual,
  alGuardar,
}: {
  actual: { tipoCambio: number; precioGasoil: number };
  alGuardar: AlGuardar;
}) {
  const { error, setError, guardando, enviar } = useEnvio(alGuardar);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const tipoCambio = leerNumero(String(f.get("tipoCambio")));
        const precioGasoil = leerNumero(String(f.get("precioGasoil")));
        if (!(tipoCambio > 0) || !(precioGasoil >= 0)) return setError("Revisá los valores.");
        enviar(() => guardarCotizacion({ fecha: String(f.get("fecha")), tipoCambio, precioGasoil }));
      }}
      className="flex flex-col gap-3"
    >
      <div className="grid grid-cols-2 gap-3">
        <label className={etiqueta}>
          Tipo de cambio ($/USD) *
          <input
            name="tipoCambio"
            className={entrada}
            inputMode="decimal"
            defaultValue={numeroEditable(actual.tipoCambio)}
            required
          />
        </label>
        <label className={etiqueta}>
          Gasoil ($/L) *
          <input
            name="precioGasoil"
            className={entrada}
            inputMode="decimal"
            defaultValue={numeroEditable(actual.precioGasoil)}
            required
          />
        </label>
      </div>
      <label className={etiqueta}>
        Vigente desde *
        <input name="fecha" type="date" className={entrada} defaultValue={hoyIso()} required />
      </label>
      <p className="text-muted-foreground text-xs">
        Cambia el costo en USD/ha de las labores que se carguen desde ahora. Las ya cargadas no cambian.
      </p>
      <Pie error={error} guardando={guardando} />
    </form>
  );
}

// ─── Botones listos para los encabezados (las páginas son de servidor) ──────

export function BotonesCamposLotes({
  campos,
  productores,
  personalizados,
}: {
  campos: Campo[];
  productores?: Productor[];
  personalizados?: CampoPersonalizado[];
}) {
  return (
    <>
      <BotonAlta
        texto="+ Campo"
        titulo="Nuevo campo"
        variante="secundario"
        formulario={(listo) => (
          <FormCampo productores={productores} personalizados={personalizados} alGuardar={listo} />
        )}
      />
      <BotonAlta
        texto="+ Lote"
        titulo="Nuevo lote"
        formulario={(listo) => <FormLote campos={campos} personalizados={personalizados} alGuardar={listo} />}
      />
    </>
  );
}

export function BotonEditarLote({
  campos,
  lote,
  personalizados,
}: {
  campos: Campo[];
  lote: Lote;
  personalizados?: CampoPersonalizado[];
}) {
  return (
    <BotonAlta
      texto="Editar"
      titulo="Editar lote"
      variante="secundario"
      formulario={(listo) => (
        <FormLote campos={campos} personalizados={personalizados} inicial={lote} loteId={lote.id} alGuardar={listo} />
      )}
    />
  );
}

export function BotonEditarCampo({
  campo,
  productores,
  personalizados,
}: {
  campo: Campo;
  productores?: Productor[];
  personalizados?: CampoPersonalizado[];
}) {
  return (
    <BotonAlta
      texto="Editar"
      titulo="Editar campo"
      variante="secundario"
      formulario={(listo) => (
        <FormCampo
          productores={productores}
          personalizados={personalizados}
          inicial={campo}
          campoId={campo.id}
          alGuardar={listo}
        />
      )}
    />
  );
}

export function BotonProductor({ productor }: { productor?: Productor }) {
  return (
    <BotonAlta
      texto={productor ? "Editar" : "+ Productor"}
      titulo={productor ? "Editar productor" : "Nuevo productor"}
      variante={productor ? "secundario" : "primario"}
      formulario={(listo) => <FormProductor inicial={productor} productorId={productor?.id} alGuardar={listo} />}
    />
  );
}

export function BotonNuevoInsumo({
  proveedores,
  personalizados,
}: {
  proveedores?: Catalogo[];
  personalizados?: CampoPersonalizado[];
}) {
  return (
    <BotonAlta
      texto="+ Insumo"
      titulo="Nuevo insumo"
      formulario={(listo) => (
        <FormProducto proveedores={proveedores} personalizados={personalizados} alGuardar={listo} />
      )}
    />
  );
}

export function BotonNuevaLabor() {
  return (
    <BotonAlta texto="+ Labor" titulo="Nuevo tipo de labor" formulario={(listo) => <FormTipoLabor alGuardar={listo} />} />
  );
}

export function BotonCotizacion({ actual }: { actual: { tipoCambio: number; precioGasoil: number } }) {
  return (
    <BotonAlta
      texto="Actualizar cotización"
      titulo="Tipo de cambio y gasoil"
      variante="secundario"
      formulario={(listo) => <FormCotizacion actual={actual} alGuardar={listo} />}
    />
  );
}
