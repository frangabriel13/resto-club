# Clubsy — Contexto del proyecto

## Qué es

**Clubsy** (producto de la empresa FullSync) es un SaaS multi-tenant de **fidelización por sellos digitales** para locales gastronómicos (cafeterías, panaderías, heladerías). Es la versión digital de la tarjeta de cartón "juntá 8 sellos y llevate un premio".

- En el local hay una **pieza física** con un chip NFC y un QR. Ambos contienen una URL que identifica la pieza (y por lo tanto el local).
- El cliente final acerca el celular, se abre una **web mobile** (no hay app nativa), se registra con nombre + teléfono verificado por OTP y ve su tarjeta de sellos.
- Cada vez que compra, un **empleado confirma el sello** desde el panel del local.
- Al completar los sellos, el empleado confirma el **canje** del premio y la tarjeta arranca un nuevo ciclo.
- El dueño del local usa un **panel web** para configurar marca y premio, gestionar empleados y ver la actividad.

Además, FullSync vende **carteles NFC** a cualquier tipo de comercio (no solo gastronomía), tenga o no el club de premios: el cartel abre una URL de Clubsy que redirige a las reseñas de Google, el Instagram o el WhatsApp del negocio (ver "Escaneo de una pieza").

Un mismo sistema sirve a todos los locales. La personalización (logo, colores, premio, reglas) es **configuración**, nunca código por cliente.

Etapa actual: **piloto con 3 locales durante 30 días**. La prioridad es que el circuito completo (alta → sello → premio → canje) funcione sin errores ni confusión, no la cantidad de funciones.

## Stack

| Capa | Tecnología |
|---|---|
| Repos | Dos repos de código, `resto-api` y `resto-front`, dentro de `resto-club`. `resto-club` es un tercer repo que solo versiona `CLAUDE.md`, `ROADMAP.md`, `MANTENIMIENTO.md` (la guía de producción) y el tablero (su `.gitignore` excluye los otros dos). pnpm en ambos |
| Backend | NestJS (TypeScript strict) — `resto-api` |
| ORM / DB | Prisma + PostgreSQL 16 |
| Frontend | Next.js (App Router) + Tailwind + shadcn/ui — `resto-front` (PWA) |
| Contrato API | La API publica su OpenAPI (`@nestjs/swagger`, que lee los schemas de zod de forma nativa); el front genera sus tipos con `openapi-typescript`. No hay paquete compartido |
| Validación | zod en ambos repos (en la API, con el soporte nativo de Standard Schema de Nest 12: no se usa `nestjs-zod`, que no soporta Nest 12). Los esquemas de formularios del front viven en el front; los tipos de request/response salen del OpenAPI |
| Teléfonos | `libphonenumber-js`, solo Argentina (+54) por ahora, normalizado a E.164 |
| Módulos | ESM en la API (opción ESM del CLI de Nest) |
| Tests | Vitest para todo: unitarios y E2E de la API (con Supertest, contra Postgres de test en docker) |
| Colas (futuro) | Redis + BullMQ — **no implementar todavía** |
| Errores | Sentry (api y web) |
| Local | docker-compose con Postgres (en `resto-api`) |
| Hosting | Un VPS de Hostinger con Coolify: front, API y Postgres 16 en la misma máquina, detrás del proxy de Coolify. Dominio `clubsy.com.ar` (DNS en Cloudflare). Backup diario de la base en el VPS (Coolify, 7 días); falta la copia fuera del VPS (tarea 13.15). Imágenes (portada y logo) en Cloudflare R2: bucket `clubsy-imagenes`, servido desde `img.clubsy.com.ar`; en desarrollo, `clubsy-imagenes-dev` con su propio token |

### Estructura

```
resto-club/            repo git — CLAUDE.md, ROADMAP.md, MANTENIMIENTO.md y el tablero
  roadmap/             tablero visual del roadmap (build.mjs + template.html; index.html se genera)
  resto-api/           repo git — NestJS
    src/
      modules/
        auth/          OTP clientes, login staff, sesiones
        merchants/     comercios y su configuración
        staff/         usuarios del comercio y roles
        customers/     cuenta global del cliente
        memberships/   participación del cliente en el club de un comercio
        pieces/        piezas NFC/QR
        reward-rules/  reglas de premio
        stamps/        sellos
        redemptions/   canjes
        audit/         eventos de auditoría
        admin/         super-admin de FullSync
      common/          guards, interceptors, tenant context, idempotencia
    prisma/
    docker-compose.yml
  resto-front/         repo git — Next.js
    app/
      p/[code]/        entrada desde NFC/QR
      c/[slug]/        tarjeta del cliente para un comercio
      cuenta/          login/recuperación del cliente, cambio de cuenta
      panel/           panel del comercio (dueño y empleados)
      admin/           panel interno de FullSync
```

El `CLAUDE.md` vive en `resto-club/` y aplica a los dos repos (Claude Code lo lee desde las carpetas padre).

**Cookies y dominios:** el frontend hace proxy de `/api/*` a NestJS mediante `rewrites` de Next.js para que las cookies de sesión sean first-party. Cookies `httpOnly`, `Secure`, `SameSite=Lax`.

**IP del cliente:** el límite de intentos de la API es por IP. El proxy de Coolify pone la IP real en `X-Forwarded-For` y el rewrite de Next la reenvía; las llamadas que el front hace desde su servidor (`getServerApi`) tienen que reenviarla también, o todos los clientes compartirían la IP del front y su límite. La API no tiene dominio propio: se llega a ella solo por el front.

## Glosario (código en inglés, negocio en español)

| Negocio | Código |
|---|---|
| Comercio / local | `Merchant` |
| Dueño / empleado | `StaffUser` + `StaffRole` (`OWNER`, `EMPLOYEE`) |
| Cliente final | `Customer` |
| Participación en el club de un local | `Membership` |
| Pieza NFC/QR | `Piece` |
| Regla de premio | `RewardRule` |
| Sello | `Stamp` |
| Canje | `Redemption` |
| Super-admin FullSync | `PlatformAdmin` |

## Modelo de datos

El schema real está en `resto-api/prisma/schema.prisma`; esto es el resumen.

- En la base, tablas y columnas en snake_case; IDs UUID v7 y fechas `timestamptz`.
- Las referencias entre tablas de un comercio son claves foráneas compuestas `(id, merchant_id)`: la base impide que un sello, canje, membresía o sesión apunte a algo de otro comercio. Los `...ByStaffId` apuntan a la pertenencia del staff a ese comercio (`StaffMembership`).
- Nada del dominio se borra: se anula (`voidedAt`) o se desactiva (`active`). La única excepción es borrar un comercio desde el admin: sin clientes, en cualquier momento; con clientes, archivado (ver la API del admin).

- **Merchant**: id, name, slug (único), logoUrl, primaryColor, secondaryColor, googleReviewUrl, stampCooldownMinutes, status (`DRAFT` al crearse, `ACTIVE`, `PAUSED`, `ENDED`), archivedAt, timestamps. `stampCooldownMinutes` arranca en 60 (provisorio, ver Decisiones abiertas).
  - Datos de la página del comercio, todos opcionales y públicos (los ve cualquiera que abra la pieza, también la contraseña del Wi-Fi): coverUrl (la portada), Wi-Fi (wifiSsid de 1 a 32 caracteres, wifiPassword y wifiSecurity `WPA`, `WEP` o `NONE`: va completo o vacío, una red abierta sin contraseña y una con seguridad con contraseña, con un `CHECK`; la de `WPA` tiene de 8 a 63 caracteres) y redes (instagramUsername y tiktokUsername sin la `@` y en minúsculas, whatsappPhoneE164 con celular argentino y facebookUrl, solo `https` de `facebook.com` y sus subdominios).
- **MerchantProfile** (ficha comercial, solo para el admin): merchantId (clave primaria), contactName y contactPhoneE164 (el contacto del comercio, que no es usuario del panel), address (un solo campo), googleRatingInitial (1,0 a 5,0, un decimal), googleReviewsInitial, googleDataTakenOn (el día en que se tomaron la puntuación y las reseñas: va si hay alguna de las dos, y no sin ellas), notes, timestamps. Todo opcional: la fila se crea la primera vez que se carga un dato, y sin fila la ficha sale vacía. Está aparte de `merchants` porque esa tabla es de lectura pública.
- **StaffUser**: id, email (único, en minúsculas), passwordHash, name, mustChangePassword (bool, `true` al crearse), timestamps.
- **StaffMembership**: staffUserId, merchantId, role (`OWNER` | `EMPLOYEE`), active. Un usuario puede pertenecer a más de un comercio. Al dar de baja a un empleado se desactiva, no se borra.
- **StaffSession**: id, staffUserId, selectedMerchantId (nullable hasta elegir comercio; tiene que ser uno de sus comercios), tokenHash, createdAt, lastUsedAt, expiresAt, revokedAt, userAgent.
- **PasswordResetToken**: id, staffUserId, tokenHash, expiresAt, consumedAt.
- **PlatformAdmin**: usuarios internos de FullSync (puede haber varios). Login propio en `/admin`. Se crean con un script.
- **PlatformAdminSession**: igual que `StaffSession`, sin comercio.
- **Customer** (global, NO tiene merchantId): id, name (nullable solo tras borrar la cuenta), phoneE164 (único, nullable tras borrar la cuenta), phoneVerifiedAt, deletedAt, timestamps. Una persona puede estar en clubes de varios locales con la misma cuenta. El nombre es global y lo edita el cliente.
- **Membership**: id, customerId, merchantId, currentCycle (int, arranca en 1), currentCycleRewardRuleId (versión de regla con la que arrancó el ciclo actual), joinedViaPieceId (opcional), marketingConsent (bool), marketingConsentAt, marketingConsentRevokedAt, joinedAt, leftAt. Único por (customerId, merchantId). Si sale del club y vuelve, se reutiliza la misma fila.
- **Piece**: id, merchantId, publicCode (único, no adivinable), type (`NFC_QR`, el formato físico), label (ej. "Mostrador"), active, destination (`CLUB` por defecto, `GOOGLE_REVIEWS`, `INSTAGRAM` o `WHATSAPP`) y los campos del destino: googleReviewUrl (solo links de Google, como en la regla 8), instagramUsername (sin la `@`, en minúsculas), whatsappPhoneE164 (celular argentino) y whatsappMessage (opcional). Solo tiene valor el campo del destino elegido (`CHECK`). El destino se puede cambiar sin reprogramar el chip; un cartel es una pieza más.
- **PieceNfcPassword**: pieceId (clave primaria), merchantId, encrypted, createdAt. La contraseña que protege el chip para que nadie lo reescriba (los NTAG213 la admiten): 8 caracteres hexadecimales al azar (los 4 bytes del `PWD`), generada al crear la pieza y fija, porque cambiarla dejaría el chip con una contraseña desconocida. Va cifrada (ver Seguridad) y aparte de `pieces`, que es de lectura pública. Las piezas anteriores la reciben la primera vez que el admin la pide.
- **PieceScan**: id, pieceId, merchantId, destination (el que tenía la pieza al escanearla), scannedAt. Sin IP ni datos del dispositivo. Solo se registran los escaneos de piezas activas.
- **MenuCategory** (carta): id, merchantId, name (hasta 80 caracteres), visible, position, timestamps. Hasta 30 por comercio. A diferencia del resto del dominio, se borra de verdad: es contenido del comercio, no un registro de lo que pasó.
- **MenuItem** (carta): id, merchantId, categoryId, name (hasta 80), description (opcional, hasta 300), price (opcional, pesos enteros y positivos), priceFrom (mostrarlo como "desde", solo con precio: `CHECK`), visible, position, timestamps. Hasta 300 por comercio, sumando todas las categorías. El orden es el de `position`, a mano, sin que sea consecutivo. El nombre del botón es `Merchant.menuLabel` (`CARTA`, `MENU`, `SERVICES`, `PRODUCTS` o `PRICE_LIST`, para "Ver la carta", "Ver el menú", "Ver servicios", "Ver productos" y "Lista de precios"; `CARTA` por defecto).
- **RewardRule**: id, merchantId, stampsRequired, rewardDescription, conditions (texto visible al cliente), active, version, createdAt. Al cambiar la regla se crea una versión nueva y se desactiva la anterior; no se edita. Como máximo una activa por comercio (índice único parcial).
- **Stamp**: id, merchantId, membershipId, cycle, grantedByStaffId, source (`QR_SCAN` | `MANUAL`), idempotencyKey (único por comercio), createdAt, voidedAt, voidedByStaffId, voidReason, cooldownOverride (bool).
- **Redemption**: id, merchantId, membershipId, cycle, rewardRuleId, stampsUsed, carryOver (sellos sobrantes que pasan al ciclo siguiente), confirmedByStaffId, idempotencyKey (único por comercio), createdAt, voidedAt, voidedByStaffId, voidReason. Un solo canje no anulado por (membresía, ciclo).
- **CustomerSession**: id, customerId, tokenHash, createdAt, lastUsedAt, expiresAt, revokedAt, userAgent.
- **OtpChallenge**: id, phoneE164, codeHash, attempts, createdAt, expiresAt, consumedAt. Guarda teléfonos: más adelante conviene limpiar los vencidos.
- **AuditEvent**: id, merchantId (nullable), actorType, actorId, action, entityType, entityId, payload (json), createdAt.

### Saldo e historial

- **Saldo del ciclo** = sellos no anulados de la membresía con `cycle = currentCycle` + `carryOver` del canje (no anulado) que cerró el ciclo anterior.
- **Total histórico** = todos los sellos no anulados de la membresía. Nunca se borra.
- **Regla del ciclo**: cada ciclo queda atado a la versión de regla vigente cuando arrancó (`currentCycleRewardRuleId`). Si el dueño cambia la regla, aplica desde el ciclo siguiente de cada cliente; nadie pierde lo que ya venía juntando.
- **Canje**: solo si saldo del ciclo ≥ `stampsRequired` de la regla del ciclo. En una transacción: crea `Redemption` (con `carryOver = saldo − stampsRequired`), incrementa `currentCycle` y fija `currentCycleRewardRuleId` a la regla activa en ese momento. Los sellos anteriores quedan intactos en el historial.
- **Sellos de más**: no se pierden (pasan como `carryOver`). Cuando la tarjeta ya está completa, el panel avisa "ya puede canjear" antes de sumar otro sello.
- **Sin vencimiento**: los sellos y ciclos no vencen. (Cambia en la etapa 12: plazo opcional por comercio, ver "Premio por monto y cambios de regla").
- Calcular a partir de los eventos (función pura `calculateBalance` en `resto-api/src/modules/memberships/membership-balance.ts`; todo lo que muestre o valide saldo pasa por ahí). Si más adelante hace falta performance, agregar contadores cacheados, pero los eventos siguen siendo la fuente de verdad.
- **Concurrencia**: sello y canje toman `SELECT ... FOR UPDATE` sobre la fila de la `Membership` dentro de la transacción, para que dos empleados a la vez no se salteen el cooldown ni canjeen dos veces.

### Premio por monto y cambios de regla (etapa 12, por implementar)

Decidido para antes del piloto; cuando se implemente, pasa a las secciones de arriba (modelo, saldo, API y reglas de negocio).

- **Dos modos de premio por comercio:** por sellos (lo de hoy) o por monto gastado. El modo es parte de la regla de premio; un comercio tiene un solo modo vigente.
- **Por monto:** el empleado escribe el monto del ticket al escanear el QR de la tarjeta (o en la carga manual por teléfono, que queda `MANUAL`). No hay integración con la caja. Un consumo = un registro con su monto. Mismas reglas que el sello: idempotencia, cooldown con "es otro consumo", anulaciones (el EMPLOYEE, el propio dentro de los 5 minutos; después, el OWNER) y canje solo con el QR.
- Montos en pesos enteros. El objetivo es un monto fijo que el dueño actualiza (inflación) con un cambio de regla. Lo que sobra al canjear pasa al ciclo siguiente, igual que los sellos de más. Un solo premio por objetivo (los escalones quedan para más adelante).
- **Máximo por operación**, configurable por el dueño, contra los errores de tipeo; el panel muestra el monto bien grande antes de confirmar.
- **Privacidad:** el EMPLOYEE ve al escanear el progreso del ciclo actual del cliente (el mismo que muestra la tarjeta); el historial de montos, los totales por cliente, la facturación registrada y el export son solo para el OWNER. El cliente ve su historial con los montos.
- **Cambio de regla con fecha límite** (en los dos modos: cambio de modo, otra cantidad de sellos u otro monto): el dueño elige la fecha (en el momento o hasta 90 días; 30 por defecto). Hasta esa fecha, cada cliente sigue con la regla de su ciclo y la tarjeta le avisa del cambio y del plazo. Al vencer, los que siguen con una regla vieja pasan a la vigente con el progreso convertido en proporción (5/8 sellos con una regla nueva de $50.000 = $31.250), redondeado a favor del cliente; si llega al objetivo, la tarjeta queda completa. Si el dueño cambia la regla de nuevo antes de la fecha, vale el último cambio. La conversión queda registrada y auditada.
- **Plazo para completar la tarjeta**, opcional y parte de la regla (sin plazo, o de 1 a 12 meses calendario, en hora AR). Corre desde el primer sello o consumo del ciclo (o desde el canje que dejó sobrante). Al vencer se pierde lo juntado en ese ciclo, sobrante incluido; queda en el historial como vencido y la próxima compra arranca un ciclo nuevo con la regla vigente. Una tarjeta completa no vence (el premio ganado queda guardado). Con el club pausado el plazo se congela. Si la tarjeta se convierte por un cambio de regla, el plazo de la nueva arranca desde la conversión. El plazo se muestra antes de sumarse y en la tarjeta ("te quedan X días", destacado con 7 días o menos); el empleado lo ve al escanear; el dueño ve lo vencido en sus estadísticas y la fecha de vencimiento en el export. Por ahora el dueño no puede extenderle el plazo a un cliente puntual.
- **Reiniciar la tarjeta:** con plazo activo, el cliente puede vaciar su ciclo y empezar de cero (le conviene cuando no llega: así su próxima compra arranca una tarjeta con el plazo entero). Nunca con la tarjeta completa, sin vuelta atrás, queda en el historial y en auditoría. La tarjeta lo recomienda cuando, a su ritmo en el ciclo (con al menos 2 sellos o consumos), no llega a completarla antes del vencimiento.
- Los textos legales tienen que cubrir estas condiciones (pendiente "Textos legales").

### Página del comercio (etapa 11, en producción)

- El destino `CLUB` de las piezas pasa a llamarse **"Página del comercio"** en el admin y abre una página con: la portada arriba de todo, el header (logo y nombre), un menú y el footer (las redes cargadas y "by Clubsy"). Funciona en cualquier estado del club, también en `DRAFT` (para los comercios que solo compran carteles). Los destinos externos siguen redirigiendo directo.
- **Menú fijo**, cada botón solo si corresponde: "Sumarse al club" (con el club activo; lleva al premio, las condiciones y el formulario de hoy) o "Ver mi tarjeta" si ya es socio; la carta (con el nombre elegido, si hay algún ítem visible); "Dejar una reseña" (si hay link); "Conectarse al Wi-Fi" (si hay red). El socio ahora ve el menú en vez de ir directo a su tarjeta.
- **Carta:** en el menú va después del club y antes de la reseña, solo si hay algún ítem visible, y abre una pantalla aparte con las categorías como índice. La cargan el admin y el dueño (sección "Carta" del panel). Sin fotos por ahora y solo para ver: sin pedidos ni carrito (fuera de alcance).
- **Wi-Fi en la página:** una web no puede conectar el celular sola: muestra el nombre, la contraseña con "Copiar", los pasos y el QR estándar de Wi-Fi (la API lo manda armado) para otro celular.
- **Portada y logo:** la portada la cargan el admin y el dueño (en "Configuración"); el logo, solo el admin.

## Multi-tenancy (crítico)

- Una sola base compartida. Toda tabla del dominio de un comercio lleva `merchantId`.
- **Toda** consulta del panel se filtra por el `merchantId` del contexto de la request (tomado de la sesión del staff y del comercio seleccionado, nunca del body sin verificar).
- `TenantContext` (AsyncLocalStorage) con una capa de acceso que aplica el filtro siempre: cada request del panel corre en una transacción que arranca con `set_config('app.merchant_id', …, true)`, y una extensión de Prisma agrega el `merchantId` del contexto a toda consulta de tablas de comercio, completa y valida el `merchantId` en los `create`, y bloquea el acceso directo a `Customer`. Sin comercio seleccionado el panel responde `MERCHANT_NOT_SELECTED`; si el staff fue dado de baja con la sesión abierta, `MERCHANT_ACCESS_REVOKED`.
- **Row Level Security** de Postgres como red de seguridad (migración `rls`): cada request fija su contexto con `set_config(…, true)` dentro de su transacción, y sin contexto las tablas del dominio no devuelven nada (ni con SQL a mano). Todas con `ENABLE` y `FORCE ROW LEVEL SECURITY`; el runtime usa un rol que no es dueño de las tablas.
- Las políticas aceptan `app.merchant_id` **o** `app.customer_id`, para que el cliente pueda leer sus propias membresías en varios comercios (`/me/*`) sin ver nada de otros clientes. Para lo que se lee antes de saber de quién es el request hay dos variables más: `app.staff_user_id` (guards y login de staff: solo sus `staff_memberships`) y `app.customer_phone` (verificación del OTP: solo el cliente de ese teléfono).
- Por tabla:
  - `memberships`: su comercio o su cliente.
  - `stamps` y `redemptions`: su comercio; el cliente solo lee los de sus membresías.
  - `customers`: el propio cliente, el de ese teléfono (OTP) o, en lectura, los que tienen membresía en el comercio del contexto.
  - `staff_memberships` y `audit_events`: su comercio (y `staff_memberships`, también su usuario).
  - `merchants`, `reward_rules` y `pieces`: fuera del panel (cliente, login, pieza pública) la lectura es abierta, porque son datos públicos que muestra la pieza; dentro del panel, solo los del propio comercio. Escritura solo desde su comercio.
  - `menu_categories` y `menu_items`: solo su comercio; lo público se lee con `app_admin`, como las piezas.
  - `merchant_profiles`, `piece_scans` y `piece_nfc_passwords`: cerradas para `app` de dos formas: sin permisos (un acceso por error falla en vez de devolver vacío) y con RLS sin ninguna política. Solo las usa `app_admin`, que en `piece_nfc_passwords` tampoco tiene `UPDATE` (la contraseña es fija).
- Del lado del cliente hay un contexto equivalente (`CustomerContext`): cada request de `/me/*` corre en una transacción con `set_config('app.customer_id', …)` y una extensión de Prisma que filtra `Customer` y `Membership` por el cliente, `Stamp` y `Redemption` a través de su membresía, deja leer (y no escribir) `Merchant`, `RewardRule` y `Piece`, y bloquea el resto de las tablas.
- Roles de Postgres:
  - `migrator`: dueño de las tablas. Solo lo usa `prisma migrate`.
  - `app`: rol de runtime, sujeto a RLS.
  - `app_admin`: con `BYPASSRLS`. Solo lo usan los endpoints `/admin/*` y la lectura pública de piezas.

  Hacen falta dos `DATABASE_URL` (migraciones y runtime) más la de admin. En producción el Postgres corre en el VPS, así que los roles se crean igual que en local.
- `Customer` es global. El panel solo accede a clientes **a través de una `Membership` de su comercio**.
- Sin RLS, porque se leen antes de saber de qué comercio o cliente es el request: las tablas de sesiones (solo las toca el `SessionService`), `otp_challenges`, `password_reset_tokens`, `platform_admins` y `staff_users` (el login la busca por email; no tiene comercio).
- Tests obligatorios: un staff del comercio A nunca puede leer ni modificar datos del comercio B, y un cliente nunca ve datos de otro. Las matrices de aislamiento recorren cada endpoint del panel y de `/me/*` dos veces: con la extensión de Prisma y RLS, y solo con RLS (la extensión reemplazada por una vacía, como si el código tuviera un bug).

## Reglas de negocio (no negociables)

1. **Abrir la URL del NFC/QR nunca acredita un sello.** Solo muestra la experiencia del club.
2. **Consultar la tarjeta nunca suma sellos.** Leer y registrar son operaciones separadas.
3. **El sello lo confirma un empleado** por un consumo válido. El cliente no puede autoacreditarse. **Un consumo = un sello**: no se suman varios de una vez.
4. **Sin duplicados:** cada operación de sello y canje lleva `idempotencyKey`. Reintentos o doble clic devuelven el mismo resultado, no crean un segundo registro. Reusar una key con otro payload devuelve 409.
5. **Cooldown:** si el cliente recibió un sello hace menos de `stampCooldownMinutes`, la API rechaza con un error específico. Cualquier empleado puede forzarlo confirmando que es otro consumo (sin motivo obligatorio); queda registrado con `cooldownOverride = true` y en auditoría.
6. **Canje confirmado por un empleado** y registrado con quién lo hizo. **Exige escanear el QR de la tarjeta** (prueba de que el cliente está presente); no se puede canjear buscando por teléfono.
7. **Sellos equivocados se anulan, no se borran** (`voidedAt`, quién y por qué):
   - El EMPLOYEE puede anular **su propio** sello dentro de los 5 minutos; después, solo el OWNER.
   - No se pueden anular sellos de ciclos ya canjeados (`cycle < currentCycle`).
   - Sumar sello buscando por teléfono (sin QR) está permitido como alternativa, pero queda con `source = MANUAL`.
   - **Canjes equivocados** también se anulan (solo OWNER): solo el último canje de la membresía y solo si el ciclo nuevo todavía no tiene sellos (si tiene, primero hay que anularlos). Anular el canje vuelve `currentCycle` al ciclo anterior.
8. **Reseñas de Google:** el link está visible para todos los clientes, sin condicionarlo a ninguna valoración y sin premio a cambio (lo prohíbe la política de Google). Nunca filtrar o pedir solo reseñas positivas. Solo se aceptan links `https` de Google (`google.com`, `google.com.ar` y sus subdominios, `g.page`, `goo.gl`, `maps.app.goo.gl`), tanto desde el panel como desde el admin, para que no sirva para mandar a los clientes a otro sitio.
9. **Consentimientos separados:** unirse al club ≠ aceptar comunicaciones comerciales. El checkbox de marketing es opcional, sin marcar por defecto, se registra con fecha y se puede revocar.
10. **Datos mínimos:** nombre y teléfono. No pedir ni leer IMEI, contactos ni nada del dispositivo.
11. Toda acción de staff relevante (sello, anulación, canje, anulación de canje, cambio de regla, alta/baja de empleado) genera un `AuditEvent`.
12. **Estado del comercio y de la pieza:**
    - `DRAFT`: estado inicial, mientras el dueño configura la regla. La pieza no muestra el club ni acepta inscripciones. Un comercio que solo compra carteles (sin club de premios) queda en `DRAFT`: sus piezas con destino externo funcionan igual.
    - Transiciones: `DRAFT → ACTIVE`, `ACTIVE ↔ PAUSED`, `ACTIVE | PAUSED → ENDED`. `ENDED` es final y nunca se vuelve a `DRAFT`. La activación la hace el PlatformAdmin, después de que el dueño cargó la regla.
    - El slug se puede cambiar solo en `DRAFT` (después ya circulan links `/c/[slug]`). Si no se indica al crear, se arma con el nombre, y si ese ya existe se le suma un número (`cafe-2`); un slug indicado que ya existe da `SLUG_TAKEN`.
    - `ACTIVE` requiere una regla de premio activa. No se puede activar un comercio sin regla.
    - `PAUSED`: el cliente ve su tarjeta en solo lectura con un aviso de "club pausado". No se pueden sumar sellos ni nuevas inscripciones; el canje de tarjetas ya completas sí se permite. El panel funciona en modo consulta.
    - `ENDED`: el cliente ve su historial y un aviso de "club finalizado". El panel queda en solo lectura (el OWNER puede exportar).
    - Pieza inactiva: muestra "Este código ya no está activo", sin datos del club.
    - **Archivado** (`archivedAt`), aparte del estado: solo en `DRAFT` o `ENDED` (un club abierto primero se finaliza). Sale del listado del admin, sus piezas se desactivan (al desarchivar se reactivan a mano) y no se edita hasta desarchivarlo. El panel del comercio no cambia.
    - Pieza con destino externo (Google, Instagram o WhatsApp): redirige en cualquier estado del comercio; solo depende de que la pieza esté activa.
13. **Privacidad del cliente:**
    - El EMPLOYEE ve el teléfono enmascarado (`11 ••• 4321`); el OWNER lo ve completo.
    - El cliente puede **salir del club** de un comercio (`leftAt`, se revoca el consentimiento de marketing) y **borrar su cuenta**: se anonimiza el `Customer` (nombre y teléfono eliminados, `deletedAt`), se revocan las sesiones, y los sellos y canjes quedan sin datos personales para las estadísticas del comercio.
    - El export CSV incluye a todos los clientes con una columna de consentimiento de marketing bien visible.

## Flujos

### Escaneo de una pieza
1. Toca el NFC o escanea el QR → `GET /p/[code]` del front.
2. Antes de mostrar nada, el servidor del front llama una sola vez a `POST /api/public/pieces/:code/scans`, que registra el escaneo (si la pieza está activa) y resuelve el destino.
3. Si responde `REDIRECT`, el front contesta con un `302` a esa URL y `Cache-Control: no-store`, así un cambio de destino aplica enseguida. Si no, muestra la página del comercio.

Las recargas de la página usan `GET /public/pieces/:code`, que responde lo mismo sin registrar el escaneo.

### Cliente — primer uso
1. Toca el NFC o escanea el QR → `GET /p/[code]` (ver "Escaneo de una pieza").
2. Web obtiene los datos del comercio y muestra su página: portada, header, menú y redes.
3. "Sumarse al club" (solo con el club activo) muestra el premio, las condiciones y el formulario (nombre, teléfono, consentimiento de marketing opcional).
4. `POST /api/auth/customer/otp/request` → envía código.
5. `POST /api/auth/customer/otp/verify` → crea o recupera el `Customer`, crea la sesión (cookie).
6. `POST /api/me/memberships` con `merchantId` y consentimientos → crea la `Membership` si no existía.
7. Redirige a `/c/[slug]` con la tarjeta.

### Cliente — vuelve al local
1. Toca la pieza → ve la página del comercio; con sesión y membresía, el menú ofrece "Ver mi tarjeta" en vez de "Sumarse al club".
2. Para recibir el sello, muestra el **QR de su tarjeta** al empleado.

### QR de la tarjeta del cliente
- `GET /api/me/memberships/:id/stamp-token` devuelve un token firmado (HMAC) con `membershipId` y expiración corta (~2 min). La tarjeta lo muestra como QR y lo renueva solo.
- Evita que una captura de pantalla vieja sirva para pedir sellos.

### Empleado — sumar sello
1. En `/panel/escanear` abre la cámara y escanea el QR del cliente (lector estándar `BarcodeDetector` del navegador, con el polyfill `barcode-detector` donde no existe, como en iPhone; `html5-qrcode` se descartó por abandonada).
2. `POST /api/panel/stamps` `{ stampToken, idempotencyKey }`.
3. La API valida firma, expiración, que la membresía sea de su comercio y el cooldown. Crea el sello.
4. El panel muestra nombre del cliente, saldo actualizado y si ya puede canjear.
5. **Alternativa** si falla la cámara: buscar al cliente por teléfono en el panel y sumar el sello desde ahí.

### Empleado — canje
`POST /api/panel/redemptions` `{ stampToken, idempotencyKey }` → valida el token (cliente presente), el saldo contra la regla del ciclo, crea el canje e incrementa el ciclo.

### Staff — alta, login y contraseñas
- El PlatformAdmin crea al dueño con una contraseña temporal (`mustChangePassword = true`); en el primer login la tiene que cambiar: hasta entonces el panel responde `PASSWORD_CHANGE_REQUIRED`. Contraseñas de 8 a 128 caracteres, sin reglas de composición; cambiarla cierra las otras sesiones del usuario.
- El login da el mismo error para email inexistente y contraseña incorrecta (`INVALID_CREDENTIALS`). Un usuario dado de baja en todos sus comercios no entra (`NO_ACTIVE_MERCHANT`). El dueño crea a sus empleados de la misma forma. No se mandan invitaciones por mail.
- Después del login, si el usuario pertenece a más de un comercio, elige con cuál trabajar; queda guardado en la sesión (`selectedMerchantId`), nunca en el body.
- **Recuperación:** el OWNER recupera su contraseña por email (link con token de un solo uso, expiración corta). La contraseña de un EMPLOYEE la resetea el OWNER desde el panel.
- Envío de mails detrás de una interfaz `EmailSender` (en desarrollo loguea en consola, igual que `OtpSender`; en producción, Resend, cuenta de Franco, desde `Clubsy <no-reply@mail.clubsy.com.ar>`: el subdominio está verificado en Resend, con SPF, DKIM y DMARC en Cloudflare).
- Sesiones: staff 30 días, cliente 180 días, admin 12 horas; se renuevan con el uso (como máximo una escritura por hora). Cada tipo tiene su cookie (`fs_staff`, `fs_customer`, `fs_admin`), así un mismo navegador puede tener sesión de staff y de cliente sin que se pisen.

### Recuperación de cuenta
El cliente pide un nuevo OTP al teléfono verificado y recupera la misma cuenta y sus sellos. Escribir el número sin el código nunca da acceso. Tiene que haber un "cerrar sesión / cambiar de cuenta" visible (teléfonos compartidos).

## API (borrador)

**Errores:** toda respuesta de error tiene la forma `{ statusCode, code, message, details? }` (schema `ApiError` en el OpenAPI). El front decide qué mostrar según `code` (`VALIDATION_ERROR`, `COOLDOWN_ACTIVE`, …); `message` es un texto de respaldo en español.

**Públicos**
- `GET /public/pieces/:code` (60 por minuto por IP): responde según `state`. `PIECE_INACTIVE` (pieza desactivada) y `REDIRECT` (destino externo, con `url`, en cualquier estado del comercio) vienen sin datos del comercio. Con destino club, en cualquier estado (`CLUB_NOT_OPEN` si está en `DRAFT`, o `ACTIVE`, `PAUSED` y `ENDED`) trae la marca (con `coverUrl` y el link de reseña) y `page`: `wifi` (`ssid`, `password`, `security` y `qrPayload`, el texto del QR estándar `WIFI:T:…;S:…;P:…;;` con los caracteres especiales escapados) y `socials` (`[{ type, url }]`, solo las cargadas, en orden Instagram, TikTok, WhatsApp, Facebook). También `menu`, la carta visible (`{ label, categories: [{ id, name, items: [{ id, name, description, price, priceFrom }] }] }`, en orden): una categoría oculta o sin ítems visibles no sale, y sin ningún ítem visible `menu` es `null`. La regla vigente solo con el club abierto (en `DRAFT`, `null`) y `canJoin` solo en `ACTIVE`. Un código inexistente da 404
- `POST /public/pieces/:code/scans` (60 por minuto por IP, `Cache-Control: no-store`): lo mismo que el `GET`, y además registra el escaneo si la pieza está activa. Lo llama el front una vez por escaneo

**Auth**
- `POST /auth/customer/otp/request` `{ phone }`: responde lo mismo tenga o no cuenta el teléfono. Límites: 5 por minuto por IP; por teléfono, uno cada 60 s (salvo que el último ya se haya usado) y 5 por hora, contando los usados. Si el envío falla, `OTP_DELIVERY_FAILED` (502): el pedido no queda registrado y se puede reintentar enseguida
- `POST /auth/customer/otp/verify` `{ phone, code, name? }`: crea o recupera la cuenta e inicia la sesión. Si el teléfono no tiene cuenta y falta el nombre, responde `NAME_REQUIRED` sin gastar el código. 10 por minuto por IP
- `POST /auth/customer/logout`. Una cuenta borrada pierde el acceso aunque tenga una sesión abierta
- `POST /auth/staff/login` (10 intentos por minuto por IP), `POST /auth/staff/logout`, `GET /auth/staff/me` (cuenta y comercios de la sesión actual; cada comercio trae su estado, el rol y `hasActiveRule`)
- `POST /auth/staff/select-merchant` (si el usuario tiene un solo comercio, el login ya lo deja seleccionado)
- `POST /auth/staff/password` (cambio de contraseña, obligatorio si `mustChangePassword`)
- `POST /auth/staff/password-reset/request` `{ email }` (5 por minuto por IP): siempre `204`, exista o no la cuenta. Solo manda el mail si la cuenta es OWNER activo en algún comercio, como mucho uno por minuto por cuenta; el link (`APP_URL/panel/restablecer?token=…`) vence a los 30 minutos y pedir otro invalida los anteriores
- `POST /auth/staff/password-reset/confirm` `{ token, newPassword }` (10 por minuto por IP): `204`; un token desconocido, vencido o usado da `RESET_TOKEN_INVALID`. Cambia la contraseña, saca el cambio obligatorio y cierra todas sus sesiones (después entra con el login)
- `POST /auth/admin/login` (10 intentos por minuto por IP), `POST /auth/admin/logout`, `GET /auth/admin/me`

**Cliente (sesión de cliente)**
- `GET /me`, `PATCH /me` (nombre)
- `DELETE /me` (borrar cuenta, `204`): sale de todos sus clubes (con los consentimientos revocados), anonimiza al cliente (nombre, teléfono y verificación en `null`, con `deletedAt`), cierra todas sus sesiones, borra sus `otp_challenges` y la cookie. Los sellos y canjes quedan para el comercio, sin datos personales. No se puede deshacer: el mismo teléfono puede registrarse otra vez, pero como cuenta nueva y vacía. Alcanza con la sesión (la confirmación la pide el front)
- `GET /me/memberships`: sus clubes (sin los que dejó), con la marca y un resumen del saldo
- `POST /me/memberships` `{ merchantId, marketingConsent, pieceCode? }`: solo en un comercio `ACTIVE` (si no, `MERCHANT_NOT_ACCEPTING_MEMBERS`). Si ya es miembro devuelve la misma membresía (`isNew: false`) sin tocar el consentimiento. Si había salido, reutiliza la fila: conserva ciclo, sellos y fecha de alta. `pieceCode` registra la pieza de origen si es de ese comercio y su destino es el club
- `GET /me/memberships/:id` → tarjeta: saldo del ciclo (sellos del ciclo + sobrante del canje anterior), faltan, total histórico, la regla **del ciclo** (`cycleRule`) y, si el dueño la cambió, la que aplica desde el próximo (`nextCycleRule`), y el historial de sellos y canjes (últimos 50, con los anulados marcados)
- `DELETE /me/memberships/:id` (salir del club, `204`): marca `leftAt` y revoca el consentimiento de marketing con su fecha. Conserva ciclo y sellos por si vuelve (al volver, el consentimiento queda en no). Salir dos veces no es error; la membresía de otro cliente da 404
- `PATCH /me/memberships/:id/consent`: dar el consentimiento guarda la fecha; revocarlo guarda la fecha de revocación y conserva la del consentimiento original
- `GET /me/memberships/:id/stamp-token` → `{ token, expiresAt, refreshInSeconds }`: token `v1.<membershipId>.<vence>.<firma HMAC>`, vence a los 2 minutos y se renueva cada 60 s

**Panel (sesión de staff, con tenant)**
- `GET /panel/customers?query=` (mínimo 2 caracteres): busca clientes activos del comercio por nombre (sin distinguir mayúsculas; todavía no ignora acentos) o, con 3 o más dígitos, por teléfono completo o parcial. Hasta 20 resultados
- `GET /panel/customers/:membershipId`: ficha con saldo, cooldown y el historial de sellos y canjes (quién, origen, anulaciones con quién y por qué), con `canVoid` en cada sello según quién la mira
- `POST /panel/scans` `{ stampToken }`: vista previa de solo lectura antes de confirmar (cliente, saldo, si ya puede canjear y si está en cooldown). El teléfono va enmascarado para el EMPLOYEE
- `POST /panel/stamps` `{ stampToken, idempotencyKey, cooldownOverride? }` o `{ membershipId, idempotencyKey, cooldownOverride? }` (manual, 5.3). Devuelve el sello, el saldo actualizado y `replayed`. Reintentar con la misma `idempotencyKey` devuelve el mismo sello (aunque el QR ya haya vencido); usarla para otro cliente da `IDEMPOTENCY_KEY_REUSED`. Errores: `STAMP_TOKEN_INVALID`, `STAMP_TOKEN_EXPIRED`, `CUSTOMER_OF_OTHER_MERCHANT`, `MEMBERSHIP_LEFT`, `MERCHANT_READ_ONLY` (pausado o finalizado), `COOLDOWN_ACTIVE` (con `lastStampAt` y `retryAfterSeconds`; se reintenta con la misma key y `cooldownOverride: true`). `cooldownOverride` queda en `true` solo si realmente se salteó el cooldown
- `POST /panel/stamps/:id/void` `{ reason }` (motivo obligatorio): OWNER siempre, o EMPLOYEE sobre su propio sello dentro de los 5 min (`VOID_NOT_ALLOWED`). Nunca en un ciclo canjeado (`STAMP_IN_REDEEMED_CYCLE`) ni dos veces (`STAMP_ALREADY_VOIDED`). Se puede con el club pausado, no con el finalizado
- `POST /panel/redemptions` `{ stampToken, idempotencyKey }` (solo por QR: sin `membershipId`). Si el saldo del ciclo alcanza la regla del ciclo, crea el canje con `stampsUsed` = sellos de la regla y `carryOver` = el sobrante, y pasa la membresía al ciclo siguiente con la regla activa. Devuelve el canje, la membresía ya en el ciclo nuevo y `replayed`. Se puede con el club pausado, no con el finalizado (`MERCHANT_READ_ONLY`). Errores: `INSUFFICIENT_BALANCE` (con `balance` y `stampsRequired`), `STAMP_TOKEN_INVALID`, `STAMP_TOKEN_EXPIRED`, `CUSTOMER_OF_OTHER_MERCHANT`, `MEMBERSHIP_LEFT`, `IDEMPOTENCY_KEY_REUSED`; la idempotencia funciona igual que en el sello
- `POST /panel/redemptions/:id/void` `{ reason }` (solo OWNER, motivo obligatorio): solo el último canje (`REDEMPTION_NOT_LAST`), una vez (`REDEMPTION_ALREADY_VOIDED`) y si el ciclo nuevo no tiene sellos válidos (`NEW_CYCLE_HAS_STAMPS`, con la cantidad: hay que anularlos primero). La membresía vuelve al ciclo del canje y a la regla de ese ciclo, con el saldo de antes de canjear. Se puede con el club pausado, no con el finalizado. La ficha trae `canVoid` también en cada canje
- `GET /panel/activity?from=&to=&cursor=` (OWNER y EMPLOYEE): eventos `STAMP`, `STAMP_VOIDED`, `REDEMPTION`, `REDEMPTION_VOIDED` y `JOINED`, de lo más nuevo a lo más viejo, con el cliente (teléfono según el rol) y quién lo hizo. `from` y `to` son días `YYYY-MM-DD` en hora de Buenos Aires, inclusive; sin fechas, hoy; hasta 366 días (`INVALID_DATE_RANGE`). Páginas de 50 con `nextCursor`. Sale de las tablas del dominio, no de `audit_events`
- `GET /panel/stats?from=&to=` (OWNER y EMPLOYEE): `members` es la foto actual del club (inscriptos activos, clientes con 2+ consumos y con consentimiento de marketing); `period`, lo del período (altas, sellos no anulados, manuales, con cooldown salteado, canjes no anulados y anulaciones hechas en el período); `daily`, un elemento por día AR con altas, sellos y canjes, incluidos los días sin movimiento. Sin fechas, los últimos 30 días hasta hoy; mismas reglas de rango que la actividad
- `GET|PUT /panel/settings` — OWNER: el `GET` trae `merchant` (nombre, slug, logo y estado, de solo lectura: los maneja FullSync) y `settings` (colores, link de reseña y cooldown) y `page` (la página del comercio; la portada, de solo lectura). El `PUT` recibe los cuatro campos de `settings` completos (`null` para borrar un color o el link; otro campo da `VALIDATION_ERROR`), solo en `DRAFT` o `ACTIVE` (`MERCHANT_READ_ONLY`), y audita `merchant.updated` con lo que cambió. También acepta `page` (opcional y parcial: si no viene, no la toca), con el Wi-Fi (`{ security, ssid, password? }` o `null`) y las redes, auditada aparte como `merchant_page.updated` con `changedFields`, sin los valores. El cooldown nuevo aplica desde el próximo sello
- `GET /panel/menu` — OWNER, en cualquier estado: la carta entera, también lo oculto (`Menu`: `{ label, categories: [{ id, name, visible, items: [{ id, name, description, price, priceFrom, visible }] }] }`, en orden). Editarla, solo OWNER y en `DRAFT` o `ACTIVE` (`MERCHANT_READ_ONLY`); todo devuelve la carta actualizada:
  - `PUT /panel/menu/label` `{ label }`: el nombre del botón.
  - `POST /panel/menu/categories` `{ name, visible? }`, `PATCH|DELETE /panel/menu/categories/:categoryId`. Borrar una categoría se lleva sus ítems (la confirmación la pide el front).
  - `POST /panel/menu/categories/:categoryId/items` `{ name, description?, price?, priceFrom?, visible? }`, `PATCH|DELETE /panel/menu/items/:itemId`. El `PATCH` acepta `categoryId` para pasarlo a otra categoría del comercio (queda al final). `null` borra la descripción o el precio; sacar el precio saca el "desde", y pedir "desde" sin precio da `VALIDATION_ERROR`.
  - `POST /panel/menu/categories/:categoryId/move` y `POST /panel/menu/items/:itemId/move` `{ direction: 'up' | 'down' }`: intercambia con el vecino, dentro del comercio o de la categoría; en la punta no hace nada. Lo nuevo va al final.
  - Más de 30 categorías o 300 ítems da `MENU_LIMIT_REACHED` (con `kind` y `limit`); cada edición bloquea la fila del comercio, así dos altas a la vez no pasan el límite. Se audita cada cambio real (`menu.label_updated`, `menu_category.*` y `menu_item.*` con `created`, `updated`, `deleted` y `moved`), con los valores: es contenido público. Lo que no cambia nada no se audita.
- `GET|POST /panel/reward-rules` — OWNER. Crear una regla desactiva la anterior y suma una versión; solo en `DRAFT` o `ACTIVE` (en `PAUSED` y `ENDED` responde `MERCHANT_READ_ONLY`)
- `GET|POST|PATCH /panel/staff` y `POST /panel/staff/:staffUserId/reset-password` — OWNER. El panel gestiona solo empleados: con un dueño responde `STAFF_IS_OWNER` (los dueños los da de alta FullSync).
  - `GET`: dueños y empleados del comercio, activos y dados de baja, con `pendingFirstLogin`.
  - `POST` `{ email, name }`: alta de un EMPLOYEE con contraseña temporal (16 caracteres, se muestra una vez). Si el email ya es de alguien de staff de otro comercio, le suma este y conserva su contraseña (`temporaryPassword: null`). Si ya está en el comercio (aunque dado de baja), `STAFF_ALREADY_IN_MERCHANT`: se reactiva con el `PATCH`.
  - `PATCH /:staffUserId` `{ active }`: baja o reactivación. La baja corta el acceso en el próximo request (`MERCHANT_ACCESS_REVOKED`) sin cerrar sus sesiones, porque puede trabajar en otros comercios.
  - `reset-password`: contraseña temporal nueva (se muestra una vez), cambio obligatorio y todas sus sesiones cerradas. No se puede si la cuenta también está en otro comercio (`STAFF_ACCOUNT_SHARED`): con esa contraseña, el dueño entraría también al otro.
  - El alta y la reactivación van solo en `DRAFT` o `ACTIVE`; la baja y el reset, en cualquier estado (son de seguridad).
- `PUT|DELETE /panel/settings/cover` — OWNER, solo en `DRAFT` o `ACTIVE` (`MERCHANT_READ_ONLY`): sube (`multipart/form-data`, campo `file`) o saca la portada, igual que el admin, y devuelve la configuración. El logo no: lo maneja FullSync
- `GET /panel/export` — OWNER, en cualquier estado del comercio: descarga `clubsy-<slug>-<día>.csv` con todos los clientes del club (también los que salieron; las cuentas borradas como "(cuenta borrada)", sin teléfono). Columnas: nombre, teléfono completo en formato nacional, **acepta comunicaciones (Sí/No)**, fechas de consentimiento y revocación, alta, salida, ciclo, sellos en el ciclo, sellos totales, canjes, último sello y pieza de origen. Para Excel en español: UTF-8 con BOM, separador `;`, fechas en hora AR; los campos que empiezan con `=`, `+`, `-` o `@` llevan un `'` adelante (inyección de fórmulas). Cada export queda auditado (`merchant.customers_exported`, con la cantidad de filas)

**Admin FullSync**
- `GET|POST /admin/merchants`, `GET|PATCH /admin/merchants/:id` (datos y estado; el logo y la portada se suben aparte, ver `images`). Solo el nombre es obligatorio. El listado filtra por estado (`?status=`) y no trae los archivados, salvo con `?archived=true`, que trae solo esos.
  - **Link de reseñas desde el Place ID:** el admin arma `https://search.google.com/local/writereview?placeid=…` a partir del Place ID de Google (en los datos del comercio y en el cartel de reseñas); lo resuelve el front y la API lo acepta como cualquier link de Google. Solo admin: el dueño no sabe qué es un Place ID.
  - `POST /admin/merchants/:id/archive` y `/unarchive` → `Merchant`. Archivar solo en `DRAFT` o `ENDED` (`MERCHANT_NOT_ARCHIVABLE`), desactiva las piezas y audita `merchant.archived` (con `deactivatedPieces`); desarchivar audita `merchant.unarchived` y no reactiva las piezas. Repetirlos no es error ni vuelve a auditar. Mientras está archivado, editar el comercio, sus piezas o sumarle un dueño da `MERCHANT_ARCHIVED`; verlo, ver la contraseña NFC de sus piezas, desarchivarlo y borrarlo, no.
  - `DELETE /admin/merchants/:id?confirmName=<nombre>` (`204`): borra de verdad. Sin clientes, en cualquier estado; con clientes (alguna membresía, también de los que salieron), solo archivado (si no, `MERCHANT_HAS_CUSTOMERS`, con la cantidad). Los escaneos no lo impiden. `confirmName` es el nombre del comercio (sin distinguir mayúsculas ni espacios en los extremos; si no coincide, `VALIDATION_ERROR`); el tilde de "no se puede deshacer" lo pide el front.
    - En una transacción que bloquea la fila del comercio (un cliente que se suma a la vez espera y lo impide) y las de sus clientes, borra los sellos, canjes y membresías, la ficha, la carta, las piezas con sus contraseñas NFC y escaneos, las reglas, la auditoría del comercio y los usuarios del panel que no están en otro comercio (con sus sesiones); los que sí, se quedan y su sesión queda sin comercio elegido.
    - La cuenta de cada cliente que no tiene ninguna membresía en otro comercio (tampoco de un club que dejó) se borra como en `DELETE /me` (anonimizada, con las sesiones revocadas y sin `otp_challenges`); la de los que tienen otro club queda, con lo de ese club intacto. Una cuenta ya borrada no se toca.
    - Deja un `AuditEvent` sin comercio (`merchant.deleted`) con el admin, la fecha, el nombre, el slug y las cantidades del resumen.
    - Después de confirmar la transacción, borra su logo y su portada del bucket de R2, como al reemplazar una imagen: si falla, se reporta a Sentry y el comercio queda borrado igual (la imagen, huérfana), y una URL que no es del bucket no se toca.
  - `GET /admin/merchants/:id/deletion-summary` → lo que borraría: `customers` (membresías), `stamps` y `redemptions` (también los anulados), `pieces`, `customerAccounts` y `staffUsers` (las cuentas que no están en otro comercio), más `archived` y `canDelete`. Lo calcula lo mismo que el borrado, así coincide con lo que queda auditado.
  - `GET /admin/merchants/:id/export`: el mismo CSV que `GET /panel/export`, en cualquier estado (también archivado), para llevarse los datos antes de borrar. Auditado como `merchant.customers_exported` con actor `PLATFORM_ADMIN`.
  - La página del comercio va anidada como `page`, igual que en la configuración del dueño (la portada se sube aparte). `Merchant` la trae siempre; los cambios se auditan como `merchant_page.updated` con `changedFields` y el alta suma `pageFields` a `merchant.created`.
  - La ficha comercial va anidada como `profile`: en el `POST` y el `PATCH` es opcional y parcial (`null` borra un campo; el celular se normaliza a E.164), y el detalle la trae siempre, con `null` en lo que no está cargado. El listado no la incluye.
  - Auditoría: los cambios de la ficha van en `merchant_profile.updated` con `changedFields` (solo los nombres de los campos, nunca los valores) y solo si algo cambió; el alta lista en `profileFields` qué campos se cargaron. `merchant.updated` se registra solo si cambió algún dato del comercio.
- `GET|POST /admin/merchants/:id/pieces`, `PATCH /admin/merchants/:id/pieces/:pieceId` (nombre, activa y destino; el `publicCode` no se edita). El destino va como `destination: { type, ...sus campos }` (`{ type: 'CLUB' }` por defecto al crear); un campo de otro destino da `VALIDATION_ERROR`, y cambiarlo borra los campos del anterior. La respuesta trae `destination` y `redirectUrl` (la URL armada, `null` para el club). La auditoría guarda el destino y `destinationFields` (qué columnas cambiaron), sin los valores: el WhatsApp puede ser un celular personal
- `POST /admin/merchants/:id/pieces/:pieceId/nfc-password/reveal` → `{ password }` (`Cache-Control: no-store`): la contraseña NFC de la pieza, que nunca va en `Piece`, los listados ni lo público. Si la pieza no tenía (es anterior a la contraseña), la genera una sola vez, también con pedidos simultáneos. Cada vez queda auditado (`piece.nfc_password_revealed`, con `generated`), sin la contraseña. Es `POST` porque audita y puede generarla
- `PUT|DELETE /admin/merchants/:id/images/:kind` (`kind` es `logo` o `cover`) → `Merchant`: es la única forma de cargar el logo y la portada. El alta y el `PATCH` de `/admin/merchants` no aceptan `logoUrl` (si viene, se ignora, como cualquier campo desconocido), así nadie carga una imagen de afuera; los logos ya guardados no se tocan y las respuestas lo siguen trayendo. El endpoint sube (`multipart/form-data`, campo `file`) o saca la imagen. Con el comercio archivado, `MERCHANT_ARCHIVED`. Audita el logo como `merchant.updated` (con la URL de antes y de después) y la portada como `merchant_page.updated` (`changedFields: ['coverUrl']`). Validación, guardado y borrado de la anterior: ver "Imágenes" en Seguridad
- `/admin/merchants/:merchantId/menu`: las mismas rutas de la carta que `/panel/menu`. A diferencia del dueño, el admin edita en cualquier estado del club, salvo con el comercio archivado (`MERCHANT_ARCHIVED`), como el Wi-Fi y las redes
- `POST /admin/merchants/:id/owner` `{ email, name }`: crea al dueño con una contraseña temporal (16 caracteres, se muestra una sola vez). Si el email ya es de un usuario de staff, le suma el comercio y conserva su contraseña (`temporaryPassword: null`)

## Seguridad

- Contraseñas con argon2.
- Tokens de sesión aleatorios, guardados hasheados en DB.
- OTP: 6 dígitos, vence a los 10 minutos, 5 intentos por código (contados de forma atómica), solo vale el último pedido. Se guarda como HMAC-SHA256 con `SECRET_KEY`, atado al teléfono.
- Teléfonos: solo celulares argentinos, en E.164. Si el número se escribe sin el 15 ni el 9 (`11 2345-6789`), se lo toma como celular.
- Envío de OTP detrás de una interfaz `OtpSender`. En desarrollo: implementación que loguea el código en consola. En producción: WhatsApp, directo con la Cloud API de Meta y una plantilla de autenticación con botón de copiar código.
- `publicCode` de las piezas: 12 caracteres al azar (nanoid, sin caracteres ambiguos), inmutable.
- Las acciones del PlatformAdmin sobre comercios y piezas también generan `AuditEvent` (actor `PLATFORM_ADMIN`).
- Guards de rol (`OWNER`, `EMPLOYEE`, `PLATFORM_ADMIN`) y de tenant en cada endpoint del panel.
- No loguear teléfonos completos ni códigos OTP en producción.
- **Imágenes** (portada y logo): el tipo se verifica por el contenido (los primeros bytes: PNG, JPEG o WebP), nunca por lo que dice el navegador; un SVG u otra cosa renombrada da `IMAGE_TYPE_NOT_ALLOWED` (415), más de 2 MB da `IMAGE_TOO_LARGE` (413, cortado antes de leer el archivo entero). Se guardan en R2 con un nombre al azar (`merchants/<id>/<logo|cover>-<12 caracteres>.<ext>`) y caché permanente; la URL pública queda en el comercio. La anterior se borra del bucket recién después de que se confirma la transacción: si el borrado falla, queda huérfana y se reporta a Sentry, pero el comercio nunca apunta a una imagen que no existe. Una URL que no es del bucket no se toca. Si R2 falla al subir, `IMAGE_UPLOAD_FAILED` (502) y no cambia nada; sin las variables de R2 (solo fuera de producción), `IMAGE_STORAGE_UNAVAILABLE` (503).
- **Contraseñas NFC:** cifradas con AES-256-GCM con `NFC_PASSWORD_KEY` (32 bytes en hexadecimal), con el id de la pieza como dato asociado (copiada a otra pieza no se descifra) y un prefijo de versión (`v1.`) para poder rotar la clave. Esa clave no se deriva de `SECRET_KEY`: rotar `SECRET_KEY` no las afecta. Si se pierde, las contraseñas no se recuperan: está en el documento de secretos. Nunca en logs, auditoría, URLs ni respuestas, salvo la de "reveal".
- **Sentry (API):** solo los 5xx: los errores inesperados (`INTERNAL_ERROR`) y las fallas al mandar el código (`OTP_DELIVERY_FAILED`, con el código de error de Meta); los 4xx no. También los mails de recuperación que no salen (el pedido igual responde 204). Sin datos personales: el SDK tiene apagada la recolección de cookies, cabeceras (salvo `user-agent` y `content-type`), bodies, query, usuario y variables locales, y un `beforeSend` limpia el request como segunda capa. `SENTRY_DSN` es obligatorio en producción.

## UX

- Marca Clubsy: naranja `#FC5D00` y azul marino `#001D67` sobre fondo blanco, sin modo oscuro. Logos en `resto-front/public/` (`icon.png`, `logo.png` vertical, `logoLateral.png` horizontal).
- Tarjeta del cliente pensada para celular primero, con colores y logo del comercio.
- Mostrar desde el inicio el premio y sus condiciones.
- Flujo del empleado en la menor cantidad de toques posible: escanear → confirmar → listo.
- Mensajes de error claros para el empleado (QR vencido, cooldown, cliente de otro local, saldo insuficiente).
- Español rioplatense en toda la interfaz.
- Fechas, actividad y estadísticas en zona horaria `America/Argentina/Buenos_Aires`.
- Estadística "clientes con 2+ consumos" = membresías con 2 o más sellos no anulados en el total histórico.
- El logo y la portada se suben a Cloudflare R2 (PNG, JPG o WebP, hasta 2 MB; sin SVG, que puede llevar código): el logo desde el admin, la portada desde el admin y desde "Configuración". El OWNER edita colores, link de reseña, cooldown, Wi-Fi, redes y portada.
- La raíz (`/`) es la landing de venta para comercios, en el mismo front, dominio y deploy.
- PWA "liviana": solo `manifest` con nombre e ícono (el cliente puede agregarla a la pantalla de inicio). Sin service worker ni modo offline: el sello necesita al servidor igual.

## Fuera de alcance por ahora (no implementar)

Apple Wallet / Google Wallet, chips NTAG 424 DNA y validación criptográfica de lecturas, integración con caja o tickets, mensajería por WhatsApp (salvo el envío del OTP) e IA, campañas y recontacto, reservas, pedidos, lista de espera, niveles, referidos, cumpleaños, segmentación, app nativa.

Diseñar el modelo para que se puedan sumar sin rehacer (por ejemplo, Wallet leerá el mismo saldo calculado en el servidor), pero sin escribir código para ellos.

## Convenciones

- **Git:** los commits, `git init` y los push los hace el usuario después de revisar el diff, un commit por tarea, salvo que pida explícitamente que los haga Claude. Claude hace los cambios, los verifica y avisa qué archivos tocó.
- TypeScript `strict` en ambos repos.
- **Comentarios:** solo cuando el porqué no es obvio (una restricción, un caso borde, una decisión no evidente), en una o dos líneas. Nada que describa lo que el código ya dice ni que repita este `CLAUDE.md`.
- **Código modular:** archivos y funciones chicos con una sola responsabilidad. En el front, componentes por funcionalidad y la lógica fuera de los componentes.
- Lógica de negocio en services de NestJS; controllers finos.
- Operaciones de sello y canje dentro de transacciones.
- Tests:
  - Unitarios para cálculo de saldo, ciclo, cooldown y canje.
  - E2E (con base de test) para: alta con OTP, sello, duplicado por idempotencia, cooldown, canje, canje con saldo insuficiente, anulación, aislamiento entre comercios, varios empleados sumando a la vez.
- Migraciones con Prisma; nunca editar una migración ya aplicada.
- Seed con un comercio de demo (`cafe-demo`), una pieza, un dueño, un empleado y clientes ficticios claramente marcados (nombres con prefijo `[DEMO]` y teléfonos del rango inexistente `+549110000…`). Se usa para las demostraciones comerciales: cada corrida recrea la demo desde cero sin tocar otros datos (detalle en `resto-api/CLAUDE.md`).
- Variables de entorno documentadas en `.env.example`.

### Definición de terminado

Una tarea está terminada cuando, en el repo que tocó:

- `pnpm lint` y `pnpm typecheck` pasan.
- Los tests pasan. Las reglas de negocio (saldo, ciclo, cooldown, idempotencia, canje, anulaciones, aislamiento entre comercios) llevan tests sí o sí.
- Si se tocó el modelo: la migración está creada y aplicada, y el seed sigue funcionando.
- Si se tocó un endpoint: el OpenAPI refleja el cambio.
- Si hay variables de entorno nuevas: están en `.env.example`.
- En el front: `pnpm build` pasa y la pantalla se probó en tamaño celular.
- Si cambió una decisión de diseño o de negocio: está reflejada en este `CLAUDE.md`.

## Roadmap y forma de trabajo

Las tareas y su avance están en ROADMAP.md. Al terminar una tarea, marcala con [x]. Tocá solo las líneas de tus propias tareas.

- Al principio se trabaja con una sola terminal. Las terminales en paralelo (una por repo) vienen después, cuando la base esté armada.
- En las tareas grandes, primero mostrar el plan y esperar el ok antes de implementar.
- **Tablero visual:** `roadmap/index.html` (generado, ignorado por git) se arma desde el roadmap con `roadmap/build.mjs` y `roadmap/template.html`. Lo regenera solo un hook `PostToolUse` de `~/.claude/settings.json` cada vez que una sesión toca el roadmap. Para regenerarlo a mano: `node roadmap/build.mjs`.

@ROADMAP.md

## Decisiones abiertas

El seguimiento (para cuándo y qué bloquea cada una) está en ROADMAP.md › "Pendientes externos".

- Proveedor del OTP: **WhatsApp, directo con la Cloud API de Meta** (sin intermediario). El envío ya está implementado y probado contra la API de Meta; falta la verificación de la empresa (Meta la exige también para crear la plantilla de autenticación, así que hasta entonces no se puede probar el mensaje real), el número propio y un token permanente. Queda por ver el costo por verificación. Bloquea el cierre de la tarea 13.5 del roadmap.
  La cuenta de producción la crea un socio, en una cuenta de Meta propia (la app y el número de prueba actuales son solo para desarrollo: las plantillas no pasan de una cuenta a otra). Checklist:
  1. Portfolio de Meta Business a nombre de FullSync, verificado, con al menos dos administradores.
  2. Una línea propia para Clubsy (que no se use en la app de WhatsApp), con nombre visible "Clubsy".
  3. Medio de pago en la cuenta de WhatsApp.
  4. Plantilla `clubsy_codigo`: categoría Autenticación, Español (ARG), "Copiar código", recomendación de seguridad y vencimiento de 10 minutos (con otro nombre o idioma, cambiar las variables).
  5. Token permanente de un usuario del sistema con permiso `whatsapp_business_messaging`, asignado a la app y a la cuenta de WhatsApp (el temporal vence a las 24 h).
  6. Cargar en Coolify (variables de la API), sin pasarlas por chat ni mail: `OTP_SENDER=whatsapp`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN` y `WHATSAPP_TEMPLATE_NAME`.
  7. Acceso de desarrollador a la app para quien mantiene la API, o al menos el Phone number ID y el WhatsApp Business Account ID.
  8. Probar con un celular real (confirma el envío sin el 9 con el número propio) y cerrar la 13.5.
- Cliente sin WhatsApp: Meta acepta el mensaje y recién después avisa que no se entregó, así que el cliente no recibe el código. Para el piloto no se hace nada especial; si aparece el caso, sumar SMS como alternativa.
- Valor por defecto del cooldown entre sellos (provisorio: 60 minutos, configurable por comercio).
- Qué pasa sin internet en el local (por ahora: el sello no se puede registrar y el panel lo informa claramente).
- Textos legales (términos y política de privacidad, Ley 25.326) y quién es responsable de los datos: FullSync, el comercio o ambos.
