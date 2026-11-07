# Resto Roadmap

Meta: llegar cuanto antes a un sistema vendible. Sin fechas comprometidas; el alcance es el del `CLAUDE.md` (piloto con 3 locales).

## Cómo se usa

- **Etiquetas:** cada tarea dice desde qué terminal se hace.
  - `[api]`: sesión abierta en `resto-api/`.
  - `[front]`: sesión abierta en `resto-front/`.
  - `[ambos]`: sesión global en `resto-club/` (ve los dos repos).
- **Qué tarea tomar:** cada terminal toma la primera tarea sin marcar de su etiqueta, en orden. Si dice "depende de" y esa tarea (o ese pendiente externo) no está resuelta, la saltea y sigue con la siguiente.
- **Dependencias:** "depende de" acepta tareas (`3.4`), etapas completas (`etapa 7`) y pendientes externos (`pendiente "Dominio"`, con el nombre exacto en negrita de la lista de pendientes).
- **Estados:** `[ ]` pendiente, `[~]` en curso (marcarla al empezar), `[x]` terminada.
- **Terminado:** una tarea se marca `[x]` solo cuando cumple la "Definición de terminado" del `CLAUDE.md`.
- **Qué se edita:**
  - Cada terminal toca solo las líneas de sus propias tareas.
  - Agregar, reordenar o renumerar tareas y etapas se hace solo desde la terminal global.
- **Tareas nuevas:** van en la etapa que corresponda. Nada fuera del alcance definido en el `CLAUDE.md` ("Fuera de alcance por ahora").
- **Etapa cerrada:** cuando todas sus tareas están en `[x]`, se resume en una línea en "Etapas terminadas" con este formato: `- Etapa 1 — Base técnica (12 tareas)`. Así el archivo no crece sin límite y el tablero sigue contando esas tareas y sus dependencias.
- **Tareas grandes:** primero se muestra el plan y se espera el ok antes de implementar.
- **Commits:** los hace el usuario después de revisar el diff, uno por tarea.
- **Tablero:** `roadmap/index.html` muestra este archivo de forma visual y se regenera solo con cada edición. Para que lo lea bien, respetar el formato de tareas, dependencias, pendientes y etapas cerradas descripto acá.

## Pendientes externos

Dependen del usuario o de terceros. Se marcan `[x]` cuando están resueltos. El nombre en negrita es el que usan las tareas en "depende de pendiente "…"". No hay fechas: "Para cuándo" dice antes de qué hay que tenerlo.

- [ ] **WhatsApp Business** — cuenta verificada + plantilla de autenticación aprobada por Meta. Para cuándo: arrancar el trámite ya (tarda días o semanas). Bloquea 13.5
- [x] **Dominio** — `clubsy.com.ar`, con el DNS en Cloudflare (solo DNS, sin proxy); `www` redirige a la raíz. Para cuándo: antes de fabricar las piezas (la URL queda grabada en el chip y en el QR). Bloquea 13.9 y las piezas físicas
- [x] **Hosting** — elegido: un VPS de Hostinger con Coolify; front, API y Postgres 16 en la misma máquina. Para cuándo: antes de la etapa 13. Bloquea 13.7 y 13.8
- [x] **VPS** — VPS de Hostinger contratado (2 vCPU, 8 GB de RAM). Para cuándo: antes del deploy. Bloquea 13.9
- [x] **Almacenamiento de imágenes** — bucket de R2 `clubsy-imagenes` en la cuenta de Cloudflare (plan gratis), servido desde `img.clubsy.com.ar`, con un token de API de cuenta de lectura y escritura limitado a ese bucket (las claves y el endpoint, en el documento de secretos). Para cuándo: antes de la etapa 11 (portada y logo). Bloquea 11.2
- [ ] **Almacenamiento de backups** — dónde guardar la copia de los backups fuera del VPS de Clubsy: un bucket de Cloudflare R2 (`clubsy-backups`, con un token limitado a ese bucket) o el otro VPS del usuario (que los va a buscar por SSH). Para cuándo: antes de la prueba con clientes reales (sin esto, si se pierde el VPS se pierden todos los sellos). Bloquea 13.15
- [x] **Proveedor de email** — Resend, desde `no-reply@mail.clubsy.com.ar` (dominio verificado); la recuperación de contraseña se probó en producción con un dueño real. Para cuándo: antes de la etapa 13. Bloquea 13.6
- [ ] **Textos legales** — revisión del abogado del borrador que ya está en `/terminos` y `/privacidad`: completar los datos de la empresa y cada "A definir" (quién es responsable de los datos, transferencia internacional, edad mínima, entrega del premio, cierre del club, jurisdicción, entre otros) y las condiciones nuevas de la etapa 12 (premio por monto, cambio de regla con conversión, vencimiento de la tarjeta y reinicio), y pasar el texto a versión aprobada (`resto-front/lib/legal/document.ts`). Para cuándo: antes del piloto. Bloquea 13.13
- [ ] **Los 3 locales** — logo, colores, premio, condiciones y datos del dueño de cada uno. Para cuándo: antes de cargarlos en producción. Bloquea 13.10
- [ ] **Piezas físicas** — piezas NFC + QR: proveedor, costo y demora. Para cuándo: pedirlas apenas esté el dominio. Bloquea 13.13
- [ ] **Cooldown** — valor por defecto del cooldown entre sellos (mientras tanto, valor provisorio configurable). Para cuándo: antes de cargar los locales. Bloquea 13.10
- [ ] **WhatsApp de soporte** — el número de WhatsApp de Clubsy para que clientes y locales pidan ayuda, y quién lo atiende. Tiene que ser otro número que el del código por WhatsApp (el de la API de Meta no se puede usar en la app de WhatsApp). Para cuándo: antes del piloto. Bloquea 12.13
- [ ] **Textos de la landing** — propuesta, qué gana el comercio, cómo contactar (WhatsApp o formulario) y si se muestran precios. Para cuándo: antes del piloto. Bloquea 13.14

## Etapas terminadas

- Etapa 1 — Base técnica (12 tareas)
- Etapa 2 — Modelo de datos y seed (6 tareas)
- Etapa 3 — Staff, admin y tenant (13 tareas)
- Etapa 4 — Cliente: alta y tarjeta (16 tareas)
- Etapa 5 — Sellos (9 tareas)
- Etapa 6 — Canje (8 tareas)
- Etapa 7 — Aislamiento entre comercios (RLS) (3 tareas)
- Etapa 8 — Panel del dueño y privacidad (11 tareas)
- Etapa 9 — Carteles NFC y ficha comercial (6 tareas)
- Etapa 10 — Mejoras del admin (6 tareas)
- Etapa 11 — Página del comercio (10 tareas)

## Etapa 12 — Mejoras de la app

Hito: la app tiene lo que los locales necesitan para el piloto.

- [ ] 12.1 [api] Listado de clientes del panel: `GET /panel/customers` sin búsqueda obligatoria, paginado y con orden (último consumo, sellos totales, fecha de alta y nombre), con el mismo filtro opcional por nombre o teléfono que hoy; el teléfono enmascarado para el EMPLOYEE, y tests de orden, paginación y aislamiento entre comercios
- [ ] 12.2 [front] Tabla de clientes en `/panel/clientes`: todos los socios del club con nombre, teléfono, sellos del ciclo, sellos totales, último consumo y fecha de alta; orden por columna, buscador por nombre o teléfono sobre la misma tabla, paginación, y cada fila abre la ficha del cliente. Pensada para celular primero — depende de 12.1
- [ ] 12.3 [api] Premio por monto: cada comercio elige su modo en la regla (sellos o monto); objetivo en pesos; registro de un consumo con su monto (por el QR de la tarjeta o manual por teléfono) con idempotencia y cooldown igual que el sello; saldo y sobrante en pesos (`calculateBalance`); máximo por operación configurable por el dueño; canje y anulaciones con las mismas reglas que hoy; tests de saldo, sobrante, máximo, cooldown, idempotencia, canje, anulación y aislamiento entre comercios
- [ ] 12.4 [api] Cambio de regla con fecha límite, en los dos modos (cambio de modo, más o menos sellos, otro monto objetivo): el dueño elige la fecha (en el momento o hasta 90 días; 30 por defecto); hasta entonces cada cliente sigue con la regla de su ciclo; al vencer, los que siguen con una regla vieja pasan a la vigente con el progreso convertido en proporción y redondeado a su favor, registrado y auditado; tests de conversión, redondeo, tarjeta completa y cambios encadenados — depende de 12.3
- [ ] 12.5 [api] Montos en la ficha del cliente, la actividad, las estadísticas (lo registrado en el período), el listado de clientes y el export: el EMPLOYEE ve solo el progreso del ciclo actual al escanear; historial de montos, totales por cliente, facturación y export, solo el OWNER — depende de 12.1, 12.3
- [ ] 12.6 [front] Panel en modo monto: elegir modo, objetivo y fecha límite del cambio en "Premio"; cargar el monto al escanear y en la carga manual (teclado numérico y el monto bien grande en la confirmación); máximo por operación en "Configuración". Probado en celular — depende de 12.3, 12.4
- [ ] 12.7 [front] Tarjeta del cliente en modo monto (progreso en pesos, "te faltan $X", historial con montos) y aviso del cambio de regla en los dos modos: cuál es la nueva, desde cuándo aplica y la fecha límite para completar la actual. Probado en celular — depende de 12.3, 12.4
- [ ] 12.8 [front] Montos en la ficha, la actividad, las estadísticas, la tabla de clientes y el export, según el rol. Probado en celular — depende de 12.2, 12.5
- [ ] 12.9 [api] Plazo para completar la tarjeta, opcional en la regla (sin plazo, o de 1 a 12 meses calendario en hora de Buenos Aires): corre desde el primer sello o consumo del ciclo (o desde el canje que dejó sobrante); al vencer se pierde lo del ciclo, sobrante incluido (queda en el historial como vencido), y la próxima compra arranca un ciclo nuevo con la regla vigente; una tarjeta completa no vence; el plazo se congela mientras el club está pausado; en la conversión por cambio de regla arranca de nuevo. Vencimiento en la ficha, al escanear, en las estadísticas (lo vencido en el período) y en el export; tests — depende de 12.3, 12.4
- [ ] 12.10 [api] Reiniciar la tarjeta: el cliente puede vaciar su ciclo actual y empezar de cero (solo con plazo activo, nunca con la tarjeta completa, sin vuelta atrás, en el historial como reiniciada y auditado); la tarjeta indica cuándo recomendarlo: cuando, a su ritmo en el ciclo (con al menos 2 sellos o consumos), no llega a completarla antes del vencimiento; tests — depende de 12.9
- [ ] 12.11 [front] Plazo en el panel: elegirlo en "Premio"; "vence en X días" al escanear; vencimiento en la ficha y en la tabla de clientes; lo vencido en las estadísticas. Probado en celular — depende de 12.6, 12.8, 12.9
- [ ] 12.12 [front] Plazo para el cliente: en las condiciones de la página del club antes de sumarse; "te quedan X días" siempre visible en la tarjeta y destacado con 7 días o menos; lo vencido y lo reiniciado en el historial; botón para reiniciar con confirmación y la recomendación cuando corresponde. Probado en celular — depende de 12.7, 12.10
- [ ] 12.13 [front] Ayuda por WhatsApp: un link al WhatsApp de soporte de Clubsy (`wa.me`, con un mensaje armado que diga desde dónde escribe) en la página del club, la tarjeta, las pantallas de ingreso y el panel; el número en una variable de entorno. Probado en celular — depende de pendiente "WhatsApp de soporte"
- [ ] 12.14 [api] Límites por IP pensados para muchos clientes con la misma IP (el WiFi del local o la red del celular): pedir el código, de 5 a 20 por minuto, y verificarlo, de 10 a 30; los límites por teléfono no cambian; tests
- [ ] 12.15 [api] Términos aceptados: al crear la cuenta del cliente se guarda qué versión de los términos y la privacidad aceptó y cuándo; tests
- [ ] 12.16 [front] Mandar la versión de los términos que el cliente aceptó al crear la cuenta — depende de 12.15

## Etapa 13 — Producción y piloto

Hito: los 3 locales usando el sistema con clientes reales.

- [x] 13.1 [api] Sentry
- [x] 13.2 [front] Sentry
- [x] 13.3 [front] PWA: `manifest` e íconos
- [x] 13.4 [front] Páginas de términos y privacidad — depende de pendiente "Textos legales"
- [~] 13.5 [api] `OtpSender` por WhatsApp — depende de pendiente "WhatsApp Business"
- [~] 13.6 [api] `EmailSender` real — depende de pendiente "Proveedor de email"
- [x] 13.7 [api] Imagen Docker de producción de la API: las migraciones como paso aparte con el rol `migrator`, y `trust proxy` solo para el proxy de Coolify, para que el límite de intentos vea la IP real del cliente — depende de pendiente "Hosting"
- [x] 13.8 [front] Imagen Docker de producción del front (`output: "standalone"`), sin depender de Vercel: el chequeo de Sentry del build (hoy mira `VERCEL_ENV`), la release de Sentry (hoy sale del commit de Vercel) y lo que quede de Vercel en el código y la documentación — depende de pendiente "Hosting"
- [x] 13.9 [ambos] Deploy en el VPS con Coolify: servidor asegurado (SSH solo con clave, firewall con 80 y 443, actualizaciones de seguridad automáticas); Postgres 16 sin exponer a internet, con los tres roles; API y front con el dominio y HTTPS; deploy desde GitHub; monitor de disponibilidad externo; y una guía de mantenimiento — depende de 13.7, 13.8, pendientes "VPS" y "Dominio"
- [ ] 13.10 [ambos] Alta de los 3 locales en producción (marca, regla, piezas, dueños) — depende de 13.9, pendientes "Los 3 locales" y "Cooldown"
- [ ] 13.11 [ambos] Métricas del piloto: definir los criterios de éxito (altas, clientes que vuelven, canjes, sellos manuales, errores, la opinión de los dueños) y una vista en el admin de FullSync que junte todos los locales — depende de 13.9
- [ ] 13.12 [ambos] Ensayo general en producción con un comercio de prueba y los celulares del equipo (iPhone y Android): alta, sellos y montos, canje, anulaciones, cambio de regla, vencimiento y reinicio; al terminar, el comercio de prueba queda finalizado — depende de 13.9, etapa 12
- [ ] 13.13 [ambos] Prueba completa en un local real con las piezas físicas — depende de 13.1, 13.2, 13.4, 13.5, 13.10, 13.11, 13.12, 13.15, etapa 7, etapa 8, etapa 9, etapa 10, etapa 11, etapa 12, pendientes "Piezas físicas" y "Textos legales"
- [ ] 13.14 [front] Landing para comercios en `/` (reemplaza la página provisoria): cómo funciona, qué gana el comercio, capturas de la tarjeta y del panel con los estilos finales, y contacto — depende de etapa 8, pendiente "Textos de la landing"
- [ ] 13.15 [ambos] Copia diaria de los backups de la base fuera del VPS (hoy solo hay un backup diario local en Coolify, a las 03:00 de Argentina, que guarda 7 días), con 30 días de retención, una restauración probada desde la copia y el procedimiento en la guía de mantenimiento — depende de 13.9, pendiente "Almacenamiento de backups"

## Etapa 14 — Después del piloto

Hito: Clubsy listo para sumar locales más allá del piloto.

- [ ] 14.1 [ambos] Ingreso del cliente con Google como alternativa al código por WhatsApp: primero definir el diseño (hoy la cuenta del cliente es su teléfono), después las tareas de API y front
- [ ] 14.2 [ambos] Entorno de pruebas (staging) en el VPS, con su propia base, para probar cada versión antes de publicarla
- [ ] 14.3 [ambos] Acuerdo con los locales (costo, duración, qué pasa al terminar, quién es responsable de los datos) e inscripción de la base en el Registro Nacional de Bases de Datos (AAIP)
- [ ] 14.4 [ambos] Comprobar que las alertas de Sentry (API y front) llegan por mail
- [ ] 14.5 [api] Limpieza de los pedidos de código vencidos (`otp_challenges`), que guardan teléfonos
- [ ] 14.6 [front] La landing visible en Google (`robots.txt`, `sitemap`, metadatos), con las tarjetas, las piezas, el panel y el admin fuera de los buscadores — depende de 13.14
