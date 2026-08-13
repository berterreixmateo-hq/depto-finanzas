@AGENTS.md

# Finanzas del depto

Dashboard de finanzas compartidas para dos personas (una pareja que vive junta). Uso diario, mobile-first, con carga rápida de gastos desde el celular.

## Estado del proyecto

- **Fase 1 (hecha):** setup, auth (email + contraseña), onboarding (crear hogar / unirse con código de invitación), esqueleto de navegación de las 5 pestañas con el diseño visual definido, modo claro/oscuro.
- **Fase 2 (hecha):** carga de gastos + split, listado por mes con búsqueda y filtro, edición y borrado, balance entre los dos con settlements en Inicio.
- **Próximo:** Fase 3 — deploy a Vercel.

Ver el prompt original completo y el detalle de las 6 fases en el historial de la conversación donde se definió el proyecto; el resumen de fases está más abajo.

## Stack

Next.js 15 (App Router) + TypeScript + Tailwind CSS v4 + shadcn/ui (preset `base-nova`) + Supabase (Postgres, Auth, Storage, Realtime) + Recharts. Deploy en Vercel. Moneda: pesos argentinos.

## Esquema de datos

Fuente de verdad: `supabase/migrations/0001_init.sql`. Resumen:

- `households` / `household_members` — un hogar, dos miembros (`user_id` único por miembro). Alta vía código de invitación de 6 caracteres.
- `categories` — por hogar, con `color` (hex) e `icon` (nombre lucide).
- `budgets` — presupuesto por categoría con historial: se inserta una fila nueva solo cuando el monto cambia (`effective_month`); el vigente para un mes es la fila más reciente con `effective_month <= mes`.
- `expenses` — `paid_by` + `payer_share_percentage` (% que le corresponde a quien pagó) definen el split. `split_type` es solo la etiqueta de UI (`50_50` / `custom` / `only_payer`); el cálculo real siempre usa `payer_share_percentage`.
- `settlements` — registra cuando se saldó el balance entre los dos.
- `recurring_expenses` (definición) + `recurring_expense_instances` (ocurrencia mensual, con `expense_id` que se completa al marcar como pagado y `invoice_url` en Supabase Storage).
- `shopping_items` — cubre las dos sub-listas de "Listas" via `list_type` (`faltantes` | `super`). Tabla agregada a la publicación `supabase_realtime`.

RLS: todas las tablas filtran por `household_id` a través de `is_household_member(household_id)` (función `security definer`), `households` incluida. No hay excepciones: ninguna tabla es legible por un autenticado que no sea miembro.

El onboarding no inserta directo. `create_household()` y `join_household()` (`supabase/migrations/0002_onboarding_rpc.sql`, ambas `security definer`) son el único camino para crear un hogar o unirse a uno, y validan el código de invitación y el tope de dos miembros del lado del servidor. Antes esto se chequeaba solo en el cliente, con `households` legible por cualquiera y una política de insert que no miraba el código: alcanzaba con una cuenta cualquiera y un insert directo contra la API para meterse en un hogar ajeno y leer todos sus datos. Si volvés a tocar el onboarding, no reintroduzcas inserts desde el cliente sobre esas dos tablas.

## Convenciones de código

- UI en español (es-AR).
- Moneda: siempre con `formatCurrency()` de `lib/utils/currency.ts` (formato `$ 12.500`), nunca `Intl.NumberFormat` a mano en componentes. Para campos donde el usuario tipea un monto, el mismo módulo tiene `formatAmountInput()` / `parseAmountInput()` / `amountToInput()`: el input va como `type="text"` con `inputMode="decimal"` (uno `type="number"` no puede mostrar el punto de miles).
- `Select` de Base UI: pasarle siempre `items` al Root (`{ value, label }[]`). Sin eso `<SelectValue>` imprime el valor crudo en el trigger — un UUID, o el `"all"` de un filtro — en vez de la etiqueta del `SelectItem`.
- Colores semánticos definidos en `app/globals.css` / mapeados en `@theme inline`: `success` (verde, a favor), `danger` (rojo, en contra), `warning` (ámbar, presupuesto cerca del límite). Usar las clases `bg-success`, `text-danger`, etc., no colores sueltos.
- El color e ícono de cada categoría vive en la tabla `categories`, nunca hardcodeado en componentes.
- Clientes de Supabase: `lib/supabase/server.ts` en Server Components/actions, `lib/supabase/client.ts` en Client Components, `lib/supabase/middleware.ts` para el refresco de sesión (ya conectado en `middleware.ts` de la raíz).
- Tipos de la base en `lib/types/database.types.ts`, escritos a mano por ahora (incluyen `Relationships` porque el `Database` genérico de esta versión de `@supabase/supabase-js` lo exige). Reemplazar con `supabase gen types typescript` en cuanto el proyecto esté linkeado a la CLI.
- Estados vacíos: componente compartido `components/shared/empty-state.tsx`.
- Funcionalidad todavía no conectada: usar `components/shared/coming-soon-button.tsx` (dispara un toast "se habilita en la Fase X") en vez de dejar un botón sin acción.
- El balance entre los dos nunca se persiste como número: se recalcula siempre a partir de `expenses` + `settlements` con `lib/utils/split.ts`.

## Decisiones de diseño (con trade-offs ya conversados)

- Alta de hogar por código de invitación, no por seed manual en la base.
- Presupuestos con historial mensual real (no un valor único).
- Las instancias de gastos fijos del mes se generan de forma perezosa cuando alguien abre la pestaña Fijos (sin cron/Edge Function). Suficiente para 2 usuarios activos; si se nota que quedan meses sin generar, pasar a un cron.

## Fases

1. ✅ Setup, auth, esqueleto de navegación con diseño final
2. Gastos + split entre los dos
3. Deploy a Vercel
4. Gastos fijos + facturas (Supabase Storage)
5. Presupuestos + gráficos de Inicio
6. Listas (faltantes de la casa + súper, con Realtime)

## Notas del entorno

- `AGENTS.md` advierte sobre breaking changes de Next.js y pide leer `node_modules/next/dist/docs/`. Esa carpeta no existe en la instalación actual (`next@15.5.22`, estándar). Si reaparece después de un upgrade, revisarla antes de tocar código de routing/rendering.
- La CLI de shadcn/ui instalada usa un sistema de presets (`shadcn init -d` → preset `base-nova`), distinto al flujo clásico `--style/--base-color`. `components.json` ya quedó configurado.
- `@supabase/supabase-js` 2.111.0 trae su propio `AGENTS.md` en `node_modules/@supabase/supabase-js/AGENTS.md` con la referencia canónica de la API — consultarlo ante dudas de tipos o métodos antes de asumir comportamiento de versiones anteriores.
