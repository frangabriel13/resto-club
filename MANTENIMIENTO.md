# Clubsy — Guía de mantenimiento de producción

Cómo está armada la producción y qué hacer en el día a día y cuando algo falla. Ningún secreto va en este archivo: las contraseñas y claves están en el gestor de contraseñas (y en las variables de cada app en Coolify).

El servidor usa hora UTC; Argentina es UTC−3 (las 06:00 UTC son las 03:00 de acá).

## 1. Cómo está armado

| Qué | Dónde |
|---|---|
| Sitio | `https://clubsy.com.ar` (`www` redirige ahí; `http` redirige a `https`) |
| DNS | Cloudflare: registros A de `@` y `www` hacia la IP del VPS, **con la nube en gris** (solo DNS). Con la nube naranja Cloudflare se pone en el medio y cambian la IP del cliente y la renovación del certificado |
| Servidor | VPS de Hostinger `clubsy-prod-1`, IP `31.220.31.26`. Ubuntu, 2 vCPU, 8 GB de RAM, 96 GB de disco, 4 GB de swap |
| Plataforma | Coolify (con Docker y su proxy Traefik, que maneja HTTPS con Let's Encrypt y renueva solo los certificados) |
| Proyecto en Coolify | "Clubsy" → entorno `production`, con tres recursos: `api`, `front` y la base Postgres |
| API | NestJS, desde `github.com/frangabriel13/resto-api` (rama `main`, archivo `docker-compose.prod.yml`). Contenedor `api-qzeoa2xdfugv6m2ze0deneho`. No tiene dominio propio: se llega solo a través del front (`/api/*`) |
| Front | Next.js, desde `github.com/frangabriel13/resto-front` (rama `main`, `docker-compose.prod.yml`). Contenedor `front-xwydydb7c1ksnunetjw73la8` |
| Base | Postgres 16, contenedor `u4niqr8odahqs8pulcsig1ik` (también es su nombre en la red interna). No está expuesta a internet. Base `resto_club`, con los roles `resto_migrator` (dueño de las tablas, solo migraciones), `resto_app` (la API, sujeta a RLS) y `resto_app_admin` (BYPASSRLS, `/admin` y piezas públicas) |
| Imágenes | Portadas y logos en Cloudflare R2: bucket `clubsy-imagenes`, servido desde `https://img.clubsy.com.ar` (ese subdominio sí va con la nube naranja). Plan gratis: 10 GB, sin costo por tráfico. No están en el VPS, así que no entran en los backups de la base |
| Errores | Sentry: un proyecto para la API y otro para el front. Solo llegan los errores 5xx |
| Monitor | UptimeRobot, cada 5 minutos, con aviso por mail: `https://clubsy.com.ar` y `https://clubsy.com.ar/api/health` (este último también consulta la base) |
| Backups | Diario a las 06:00 UTC, en el mismo VPS, 7 días. **Todavía no hay copia fuera del VPS** (tarea 13.15 del roadmap) |

### Seguridad del servidor

- SSH solo con clave (sin contraseña). `root` entra solo con clave porque Coolify lo necesita.
- Firewall `ufw`: 80 y 443 abiertos; el 22 con límite de intentos (más de 6 conexiones en 30 s desde la misma IP se rechazan por un rato: si aparece `Connection refused`, esperar medio minuto). Además, el firewall del panel de Hostinger solo deja pasar 22, 80 y 443.
- `fail2ban` bloquea las IP que fallan el login por SSH.
- Actualizaciones de seguridad automáticas (`unattended-upgrades`), con reinicio automático a las 07:00 UTC si alguna lo requiere. Los contenedores vuelven solos.
- El panel de Coolify solo escucha dentro del servidor (`/data/coolify/source/docker-compose.custom.yml`): se entra por túnel SSH. No publicarlo en internet: controla todo el servidor.

## 2. Accesos

**SSH** (desde la PC que tiene la clave `~/.ssh/clubsy_vps`):

```bash
ssh -i ~/.ssh/clubsy_vps root@31.220.31.26
```

Si se pierde la clave: panel de Hostinger → VPS → consola del navegador, y cargar una clave nueva en `/root/.ssh/authorized_keys`.

**Panel de Coolify:** abrir el túnel y dejar esa terminal abierta mientras se usa:

```bash
ssh -i ~/.ssh/clubsy_vps -N -L 8000:127.0.0.1:8000 -L 6001:127.0.0.1:6001 -L 6002:127.0.0.1:6002 root@31.220.31.26
```

Después, en el navegador: `http://localhost:8000`. Los puertos 6001 y 6002 son los de las actualizaciones en vivo y la terminal del panel.

**Admin de FullSync:** `https://clubsy.com.ar/admin/ingresar`.

## 3. Publicar una versión nueva (deploy)

El deploy es manual: Coolify no está expuesto a internet, así que GitHub no puede avisarle de un push.

1. Hacer push a `main` del repo que cambió.
2. Abrir el panel de Coolify → Clubsy → production → la app (`api` o `front`) → **Deploy**.
3. Si cambian los dos repos y el front usa algo nuevo de la API, desplegar primero la API y después el front.
4. Mirar el resultado en la pestaña **Deployments** de la app. Al terminar, comprobar `https://clubsy.com.ar/api/health` y la página que se tocó.

**Migraciones:** el deploy de la API corre primero el servicio `migrate` (`prisma migrate deploy`, con el rol `resto_migrator`). Si una migración falla, la API nueva no arranca: el error está en los logs del deploy, y hay que comprobar enseguida `/api/health` para ver si quedó andando la versión anterior. Nunca editar una migración ya aplicada: se arregla con una migración nueva.

**Volver atrás:** `git revert` del commit en GitHub, push y Deploy. Ojo si la versión que se revierte trajo una migración: el código viejo tiene que seguir funcionando con la base ya migrada (las migraciones no se deshacen solas).

**Variables de entorno:** en cada app → **Environment Variables**. Cualquier cambio necesita un Deploy para aplicarse. En el front, `API_URL` y las `NEXT_PUBLIC_*` quedan fijas al compilar (el Deploy recompila, así que alcanza con eso). Las variables tienen que estar marcadas como "build" y "runtime" como están ahora; y en las dos apps está apagada la opción de inyectar las variables como argumentos del build, para que los secretos no queden guardados en la imagen.

## 4. Logs y diagnóstico

- **Panel de Coolify:** cada app tiene la pestaña **Logs** (lo que imprime el contenedor) y **Deployments** (los logs de cada build).
- **Por SSH:**

  ```bash
  docker ps --format '{{.Names}}\t{{.Status}}'          # qué está corriendo y si está sano
  docker logs --tail 100 api-qzeoa2xdfugv6m2ze0deneho   # API
  docker logs --tail 100 front-xwydydb7c1ksnunetjw73la8 # front
  docker logs --tail 100 u4niqr8odahqs8pulcsig1ik       # Postgres
  df -h /                                               # disco
  free -h                                               # memoria
  ```

- **Sentry:** los errores inesperados de la API (`INTERNAL_ERROR`), las fallas al mandar el código por WhatsApp (`OTP_DELIVERY_FAILED`, con el código de error de Meta) y los mails de recuperación que no salieron.
- La API no loguea teléfonos completos ni códigos.

## 5. Si llega el aviso de caída

1. **¿Responde el servidor?** `ssh -i ~/.ssh/clubsy_vps root@31.220.31.26`.
   - Si no responde (y no es el límite de intentos del punto 1): panel de Hostinger → el VPS. Ver si está prendido, reiniciarlo desde ahí o entrar por la consola del navegador. Si Hostinger tiene un incidente, figura en su página de estado.
2. **Si el servidor responde,** `docker ps`: ver si los contenedores de la API, el front y Postgres están `Up (healthy)`. También `coolify-proxy`, que es el que recibe el tráfico.
   - Un contenedor caído: Coolify → la app → **Restart** (o Deploy). Mirar sus logs para saber por qué se cayó.
   - Postgres caído: Coolify → el recurso Postgres → **Restart**. Después reiniciar la API.
   - `coolify-proxy` caído: Coolify → Servers → localhost → Proxy → **Restart Proxy**.
3. **Si solo falla `/api/health`** (la web anda): es la API o la base. Logs de la API: si dice que no puede conectarse a la base, ir a Postgres.
4. **Disco lleno** (`df -h /` cerca del 100 %): Coolify → Servers → localhost → **Docker Cleanup**. Revisar también `/data/coolify/backups`.
5. **Memoria:** con 8 GB alcanza de sobra para el piloto; si `free -h` muestra la swap muy usada, reiniciar la app que más consume y anotarlo.

## 6. Backups

### Cómo están configurados

- Coolify → el recurso Postgres → pestaña **Backups**: un backup diario a las 06:00 UTC (03:00 de Argentina) de la base `resto_club`, con 7 días de retención.
- Los archivos quedan en el VPS, en `/data/coolify/backups/databases/root-team-0/postgres-u4niqr8odahqs8pulcsig1ik/` (formato `pg_dump` custom, `.dmp`).
- Desde la misma pestaña se puede hacer uno en el momento (**Backup Now**) y ver si las ejecuciones terminaron bien.
- **Todavía no hay copia fuera del VPS:** si se pierde el servidor, se pierden también los backups. Antes de la prueba con clientes reales hay que resolverlo (tarea 13.15).

### Importante: los backups no guardan los permisos

Coolify hace el backup con `pg_dump --no-acl`: guarda los datos, las tablas, sus dueños y el RLS, pero **no los permisos** (`GRANT`). Una base restaurada sin el paso de permisos deja a la API sin acceso a ninguna tabla. Tampoco guarda los roles de Postgres, que son del servidor y no de la base.

Este es el paso de permisos (verificado: deja la base con los mismos permisos que producción). Usa la variable `db` de `psql` con el nombre de la base:

```sql
REVOKE ALL ON DATABASE :"db" FROM PUBLIC;
GRANT CONNECT ON DATABASE :"db" TO resto_app, resto_app_admin;
GRANT USAGE ON SCHEMA public TO resto_app, resto_app_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO resto_app, resto_app_admin;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO resto_app, resto_app_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE resto_migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO resto_app, resto_app_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE resto_migrator IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO resto_app, resto_app_admin;
-- Tablas solo del admin (ficha comercial, escaneos y contraseñas NFC): cerradas para la API.
REVOKE ALL ON merchant_profiles, piece_scans, piece_nfc_passwords FROM resto_app;
-- La contraseña NFC es fija: ni el admin la modifica.
REVOKE UPDATE ON piece_nfc_passwords FROM resto_app_admin;
```

Si alguna vez una migración da permisos distintos a alguna tabla, hay que sumarlos acá. Para comparar una base restaurada con producción: `select table_name, grantee, string_agg(privilege_type, ',' order by privilege_type) from information_schema.role_table_grants where grantee like 'resto_%' group by 1, 2 order by 1, 2;` en las dos.

### Probar un backup sin tocar producción

Por SSH. Restaura el backup más nuevo en una base aparte, aplica los permisos y la deja lista para revisar:

```bash
C=u4niqr8odahqs8pulcsig1ik
F=$(ls -t /data/coolify/backups/databases/root-team-0/postgres-$C/*.dmp | head -1)
docker cp "$F" $C:/tmp/restore.dmp
docker exec $C psql -U postgres -c "CREATE DATABASE restore_prueba OWNER resto_migrator"
docker exec $C pg_restore -U postgres -d restore_prueba --exit-on-error /tmp/restore.dmp
docker exec -i $C psql -v ON_ERROR_STOP=1 -v db=restore_prueba -U postgres -d restore_prueba <<'SQL'
-- pegar acá el paso de permisos
SQL
docker exec $C psql -U postgres -d restore_prueba -c "select count(*) from merchants" -c "select count(*) from stamps"
```

Al terminar, borrarla: `docker exec $C psql -U postgres -c "DROP DATABASE restore_prueba"` y `docker exec $C rm /tmp/restore.dmp`.

### Restaurar producción en el mismo servidor

Para volver a un backup (por ejemplo, después de un borrado por error). Se pierde todo lo que pasó después de ese backup.

1. Coolify → `api` → **Stop**. Así nadie escribe mientras tanto.
2. Coolify → Postgres → Backups → **Backup Now**, para guardar el estado actual por las dudas.
3. Por SSH, con el archivo elegido en `F` (la lista está en la carpeta de backups):

   ```bash
   C=u4niqr8odahqs8pulcsig1ik
   docker cp "$F" $C:/tmp/restore.dmp
   # La base actual no se borra: queda renombrada por si hace falta algo de ahí.
   docker exec $C psql -U postgres -c "ALTER DATABASE resto_club RENAME TO resto_club_anterior"
   docker exec $C psql -U postgres -c "CREATE DATABASE resto_club OWNER resto_migrator"
   docker exec $C pg_restore -U postgres -d resto_club --exit-on-error /tmp/restore.dmp
   docker exec -i $C psql -v ON_ERROR_STOP=1 -v db=resto_club -U postgres -d resto_club <<'SQL'
   -- pegar acá el paso de permisos
   SQL
   docker exec $C rm /tmp/restore.dmp
   ```

4. Coolify → `api` → **Deploy**. Corre las migraciones que falten y levanta la API.
5. Comprobar `https://clubsy.com.ar/api/health`, entrar al admin y abrir un comercio.
6. Cuando todo esté bien, borrar la vieja: `DROP DATABASE resto_club_anterior`.

### Si se pierde el servidor

1. VPS nuevo (Hostinger u otro), asegurarlo igual que este (punto 1) e instalar Coolify.
2. En Coolify, crear un Postgres 16 y, con `psql` como `postgres`, los tres roles **con las mismas contraseñas que antes** (están en el gestor de contraseñas; así las URLs de conexión siguen sirviendo):

   ```sql
   CREATE ROLE resto_migrator LOGIN PASSWORD '…';
   CREATE ROLE resto_app LOGIN PASSWORD '…';
   CREATE ROLE resto_app_admin LOGIN BYPASSRLS PASSWORD '…';
   CREATE DATABASE resto_club OWNER resto_migrator;
   ```

   Y en la base `resto_club`: `ALTER SCHEMA public OWNER TO resto_migrator;`.
3. Restaurar el último backup en `resto_club` con `pg_restore` y aplicar el paso de permisos.
4. Crear las apps `api` y `front` desde GitHub como están ahora: tipo Docker Compose con `docker-compose.prod.yml`; nombres de contenedor fijos y conectadas a la red de Coolify; sin inyectar las variables como argumentos del build. Cargar las mismas variables, con el nombre nuevo del host de Postgres en las tres URLs de la base y el nombre nuevo del contenedor de la API en `API_URL` del front.
5. En el front, dominios `https://clubsy.com.ar,https://www.clubsy.com.ar` con redirección a sin `www`. Las imágenes siguen en R2: con las mismas variables `R2_*` e `IMAGES_PUBLIC_URL` no hay nada que restaurar.
6. En Cloudflare, apuntar los registros A de `@` y `www` a la IP nueva (con la nube en gris).
7. Deploy de la API y después del front. Comprobar la salud, el admin y un comercio.

## 7. Tareas frecuentes

**Crear un admin de FullSync, o darle una contraseña nueva a uno que ya existe.** El comando la muestra una sola vez; guardarla en el gestor:

```bash
ssh -i ~/.ssh/clubsy_vps root@31.220.31.26 '
IMG=$(docker images --format "{{.Repository}}:{{.Tag}}" | grep qzeoa2xdfugv6m2ze0deneho_migrate | head -1)
docker run --rm --network coolify \
  -e DATABASE_ADMIN_URL="$(docker exec api-qzeoa2xdfugv6m2ze0deneho printenv DATABASE_ADMIN_URL)" \
  "$IMG" node_modules/.bin/tsx scripts/create-admin.ts --email persona@ejemplo.com --name Nombre'
```

Si no aparece la imagen `_migrate` (la limpieza de Docker la puede borrar), hacer un Deploy de la API y repetir.

**Programar un cartel NFC** (NTAG213, con la app NFC Tools en el celular):

1. Admin → el comercio → **Nuevo cartel**, con su destino (club, reseñas de Google, Instagram o WhatsApp). La contraseña se genera sola al crearlo.
2. NFC Tools → **Escribir** → **Agregar un registro** → **URL / URI** → `https://clubsy.com.ar/p/<código>` (el código de 12 caracteres que muestra el cartel) → **Escribir** y apoyar el chip. El QR impreso lleva la misma URL.
3. Escanear con el celular fuera de la app: tiene que abrir el destino.
4. Admin → el cartel → contraseña → **Mostrar** → **Copiar**. NFC Tools → **Otros** → **Establecer contraseña**, pegarla y apoyar el chip. Desde ahí, nadie puede reescribir el chip sin esa contraseña (se sigue leyendo normalmente).
5. **Nunca usar "Bloquear la etiqueta"**: deja el chip de solo lectura para siempre.

Para cambiar a dónde lleva un cartel no se toca el chip: se edita el destino en el admin y aplica desde el próximo escaneo. Para reprogramar el chip (otra URL), primero NFC Tools → **Otros** → **Quitar contraseña** con la misma contraseña, siempre desde NFC Tools. Ver la contraseña queda auditado (`piece.nfc_password_revealed`), y cada escaneo queda en la tabla `piece_scans` (pieza, destino y hora).

**Archivar o borrar un comercio** (admin → el comercio):

- **Archivar** (solo en borrador o finalizado; un club abierto primero se finaliza): sale del listado (filtro "Archivados") y sus carteles se desactivan. No borra nada y se puede desarchivar, pero los carteles se reactivan a mano, uno por uno.
- **Borrar** no se puede deshacer, y el backup diario solo guarda 7 días. Sin clientes, se borra en cualquier estado; con clientes, solo archivado, y antes conviene descargar el CSV de clientes que ofrece la confirmación. Se borran también sus carteles con sus contraseñas NFC: **antes de borrar, sacarles la contraseña a los chips que se van a reutilizar** (NFC Tools → **Quitar contraseña**); después ya no se puede, y un chip protegido queda inservible. Los clientes que no estén en otro club pierden la cuenta. Queda registrado como `merchant.deleted` en la auditoría.

**Cambiar un secreto:**
- **`SECRET_KEY`:** cambiarla en las variables de la API y hacer Deploy. Invalida los códigos OTP que estén en camino y los QR de tarjeta que estén en pantalla (se renuevan solos en un minuto). Las sesiones no se ven afectadas.
- **`NFC_PASSWORD_KEY`: no se cambia.** Cifra las contraseñas de los carteles NFC; con otra clave, las que ya están guardadas no se descifran y esos chips quedan protegidos con una contraseña que nadie conoce (se pueden seguir escaneando, pero no reprogramar). Está en el documento de secretos: si se pierde, no hay forma de recuperarlas. Si se filtra, el daño es que alguien con acceso a la base podría descifrarlas; rotarla necesita una tarea de código (el formato `v1.` ya lo prevé).
- **Contraseña de un rol de Postgres:** `ALTER ROLE … PASSWORD '…'` como `postgres`; actualizar la URL correspondiente en las variables de la API (`MIGRATE_DATABASE_URL`, `DATABASE_URL` o `DATABASE_ADMIN_URL`) y hacer Deploy.
- **Token de R2:** en Cloudflare → R2 → Tokens de API, crear uno nuevo con "Lectura y escritura de objetos", solo para `clubsy-imagenes`. Cambiar `R2_ACCESS_KEY_ID` y `R2_SECRET_ACCESS_KEY` en las variables de la API, hacer Deploy, comprobar que se puede subir una imagen y recién ahí borrar el token viejo. Las imágenes ya subidas no se ven afectadas.
- **WhatsApp, Resend y Sentry:** cambiar la variable en Coolify y hacer Deploy. La lista completa de variables está en el `.env.example` de cada repo.

**Agregar una clave SSH** (por ejemplo, de otra PC): una línea nueva al final de `/root/.ssh/authorized_keys`. Cada clave va en su propio renglón y no hay que tocar la de Coolify.

## 8. Actualizaciones

- **Ubuntu:** solas (punto 1). Para ver si hay un reinicio pendiente: `ls /var/run/reboot-required`.
- **Coolify:** se actualiza solo todos los días a las 06:30 UTC (03:30 de Argentina), entre el backup y el reinicio de Ubuntu, fuera del horario de los locales (Settings → Auto Update Frequency, `30 6 * * *`). La actualización reinicia el panel; en general no toca las apps.
- **Postgres:** la imagen se queda en la versión 16 con la que se instaló. Las actualizaciones menores (16.x) se hacen desde Coolify → Postgres. Antes, un Backup Now. Pasar a otra versión mayor (17 o más) es una migración aparte: no hacerla sin plan.
- **Dependencias de la API y el front:** se actualizan en los repos, con los tests, y se publican con un deploy normal.

## 9. Revisión mensual

- [ ] Coolify → Postgres → Backups: las ejecuciones del último mes terminaron bien.
- [ ] Probar un backup sin tocar producción (punto 6). Como mínimo cada tres meses.
- [ ] `df -h /` y `free -h`: disco por debajo del 70 %, swap casi sin usar.
- [ ] Sentry: revisar los errores nuevos.
- [ ] UptimeRobot: caídas del mes y su duración.
- [ ] Certificado: vence a los 90 días y Coolify lo renueva solo a los 60; comprobar la fecha en el navegador.
- [ ] Hostinger: el VPS pago y con renovación automática. El dominio `clubsy.com.ar` se renueva en NIC Argentina (Cloudflare solo tiene el DNS).
- [ ] Claves y accesos: que no queden tokens de API de Coolify ni claves SSH que ya no se usen.
