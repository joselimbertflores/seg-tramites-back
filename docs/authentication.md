# Autenticación LOCAL y SIAU

Seguimiento conserva temporalmente el login LOCAL junto con SIAU (Identity Hub), autoridad de autenticación institucional. Ambos terminan en la misma sesión local: cookie opaca HttpOnly `seg_tramites_session` → `auth_sessions` → `User` local → autorización. Las `Account`, los roles y los permisos siguen siendo propios de Seguimiento; la autoridad efectiva combina `User.roles` y `Account.role`.

## Login LOCAL

`POST /api/auth` valida `login` y `password` con bcrypt y exige `User.isActive=true`. La sesión tiene `authMethod=LOCAL` y carece de `identitySid`. Desactivar el usuario invalida también sus sesiones LOCAL existentes cuando se resuelven.

`GET /api/auth/me` devuelve usuario, método de autenticación, cuenta, menú y permisos; incluye `updatedPassword` solo para LOCAL. `PUT /api/auth` permite cambiar una contraseña desde una sesión LOCAL si el usuario conserva `login` y `password`. Los usuarios híbridos pueden mantener esas credenciales aunque tengan `externalKey`; las credenciales institucionales se administran en SIAU.

## Login SIAU

Se utiliza OpenID Connect con Authorization Code, PKCE S256 y `scope=openid`:

1. `GET /auth/login` genera `state`, `nonce` y un verificador PKCE. Guarda una transacción de cinco minutos y establece la cookie HttpOnly `seg_tramites_oauth_transaction` con `Path=/auth` y `SameSite=Lax` antes de redirigir a SIAU.
2. `GET /auth/callback` consume atómicamente la transacción, valida `state` y su expiración, y canjea el código con el verificador PKCE y las credenciales del cliente OAuth.
3. Valida el ID Token mediante RS256/JWKS y `kid`, emisor, audiencia del cliente, `iat`, `exp`, `nonce`, `sub`, `sid`, `externalKey` y `name`. El `nonce` debe coincidir con el de la transacción.
4. Busca el `User` local por `externalKey`, previamente aprovisionado. Si falta, rechaza el login como `not_provisioned`. Crea la sesión con `authMethod=IDENTITY_HUB` e `identitySid=sid`, sustituye la sesión anterior y redirige a `/home`.

Las rutas `/auth/login` y `/auth/callback` están fuera del prefijo `/api`. El ID Token se usa únicamente durante el callback y no se persiste ni se entrega al frontend. `isActive` no condiciona el login ni las sesiones SIAU; la revocación institucional usa `sid` y Back-Channel Logout.

## Sesión local y guards

Ambos métodos usan sesiones de diez horas absolutas desde su creación, sin prolongación por actividad. HTTP y WebSocket comprueban la cookie, la existencia y expiración de la sesión y el usuario local; solo LOCAL comprueba además `isActive`. Las peticiones normales no consultan SIAU. La autorización converge en las mismas cuentas, roles y permisos locales.

Los sockets comprueban también su sesión local antes de mensajes protegidos y periódicamente mientras están inactivos. Eliminar una sesión desconecta sus sockets en el mismo proceso; los demás procesos detectan la revocación al comprobar la sesión.

## Orígenes, cookies y comparación con Intranet

| Aspecto | Intranet | Seguimiento |
| --- | --- | --- |
| Login | Solo OIDC Authorization Code + PKCE S256 | OIDC con el mismo flujo y login LOCAL por `POST /api/auth` |
| Sesiones | PostgreSQL, ID opaco aleatorio, diez horas absolutas | MongoDB, ID opaco aleatorio, diez horas absolutas; `isActive` se exige solo para LOCAL |
| Guard global | Omite primero las rutas `@Public()`; después valida sesión y usuario locales | Valida el origen HTTP antes de `@Public()`; después valida sesión y usuario locales |
| Cookies de sesión | `HttpOnly`, `SameSite=Lax`, `Path=/`; `Secure` si la URL pública usa HTTPS | `HttpOnly`, `Path=/`; `SameSite` configurable (`lax` por defecto); `Secure` configurable y obligatorio en producción |
| Cookie OAuth | `HttpOnly`, `SameSite=Lax`, `Path=/auth`; mismo criterio de `Secure` | `HttpOnly`, `SameSite=Lax`, `Path=/auth`; usa `AUTH_COOKIE_SECURE` |
| CORS HTTP | Un origen UI opcional, con credenciales | Un origen UI opcional, con credenciales |
| Control adicional de origen | Sin lista de orígenes, comprobación de `Origin`/`Referer`, Fetch Metadata ni token CSRF general en el backend | `assertRequestOrigin()` para métodos distintos de `GET`, `HEAD` y `OPTIONS`; `allowRequest` comprueba el origen del handshake de Socket.IO |

Ambos consumen una transacción OAuth de cinco minutos vinculada al navegador mediante cookie, comprueban `state` y `nonce`, canjean el código con PKCE y validan el ID Token antes de crear la sesión local. Ambos eliminan la sesión local y limpian cookies antes de notificar el logout a SIAU, y validan el Logout Token firmado para Back-Channel Logout. No consultan SIAU para validar cada petición ni delegan los permisos locales en él.

El modelo de Intranet no permite eliminar sin más la comprobación de origen de Seguimiento:

- El login LOCAL acepta `login` y `password` mediante el parser `application/x-www-form-urlencoded` predeterminado de Nest/Express. Sin la comprobación de origen, un formulario externo podría iniciar una sesión con credenciales del atacante en el navegador de la víctima. No necesita una cookie previa, por lo que `SameSite=Lax` no evita por sí solo este login CSRF. `state` y PKCE protegen el flujo OIDC, no el login LOCAL.
- `AUTH_COOKIE_SAME_SITE=none` permite enviar la cookie de sesión en peticiones entre sitios. Quitar el control de origen dejaría expuestas operaciones autenticadas que aceptan peticiones simples, sin otro mecanismo CSRF general en este backend.
- `SameSite` distingue sitios, no orígenes: servicios en otros puertos del mismo host o subdominios del mismo sitio requieren una evaluación de confianza adicional.

`HttpOnly` impide que JavaScript lea la cookie; no impide que el navegador la envíe en una petición inducida. CORS limita el acceso del JavaScript externo a las respuestas y determinadas peticiones con preflight, pero no bloquea los formularios simples. Véanse [OWASP: prevención de CSRF y login CSRF](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html) y [MDN: CSRF y límites de SameSite](https://developer.mozilla.org/en-US/docs/Web/Security/Attacks/CSRF).

Por ello se conservan `assertRequestOrigin()` y su llamada antes de `@Public()`: una ruta pública de login/logout también puede cambiar la autenticación del navegador. El Back-Channel Logout no necesita una cookie ni un origen de navegador; las llamadas entre servidores sin `Origin` ni `Sec-Fetch-Site: cross-site` siguen llegando a la validación del token firmado. `GET /auth/login` y `GET /auth/callback` ya están exentos de la comprobación de origen; el `403 Origen de solicitud no permitido` descrito corresponde a un método no exento, como el `POST` LOCAL, no a esos `GET` OIDC.

Responsabilidades de las URLs y propiedades actuales:

- `SEG_TRAMITES_PUBLIC_URL` es necesaria para el callback registrado en SIAU y como destino de redirección cuando no hay una UI separada. Su origen alimenta también la lista permitida HTTP y WebSocket.
- `SEG_TRAMITES_UI_URL` es opcional. Si existe, define los destinos de redirección y el origen CORS HTTP/Socket.IO, y agrega ese origen a la lista permitida. Se omite cuando NestJS sirve Angular desde el mismo origen.
- `publicOrigin` solo alimenta `trustedOrigins`; `uiOrigin` también configura CORS HTTP y Socket.IO. `trustedOrigins` tiene dos consumidores: la validación HTTP y `SessionIoAdapter.allowRequest`. Incluso si en el futuro se retira la validación HTTP, la lista sigue siendo necesaria para conservar la protección de WebSockets.

Límites pendientes, anteriores a esta revisión: el control actual permite peticiones sin `Origin` ni Fetch Metadata y no comprueba `Referer`; tampoco cubre efectos secundarios de rutas `GET`. En particular, `GET /api/chat/start/:receiverId` y `GET /api/chat/account/:accountId` pueden crear chats. `SameSite=Lax` admite cookies en navegaciones superiores entre sitios mediante `GET`. Estas rutas deben revisarse por separado; eliminar el control HTTP no resuelve esos límites.

## Logout

`POST /api/auth/logout` elimina la sesión local y limpia las cookies. Para LOCAL termina allí. Para SIAU obtiene primero el `identitySid` y, después del cierre local, notifica en segundo plano a `/internal/sessions/logout` con ese `sid` y las credenciales del cliente. Los fallos remotos se registran y no bloquean ni revierten el logout local.

`POST /api/auth/backchannel-logout` recibe `logout_token` en un cuerpo `application/x-www-form-urlencoded`. Valida RS256/JWKS, `kid`, `typ=logout+jwt`, emisor, audiencia exacta del cliente, `iat`, `exp`, `jti`, `sid`, el evento estándar de Back-Channel Logout y ausencia de `nonce`. Elimina idempotentemente las sesiones `IDENTITY_HUB` con ese `identitySid` y desconecta sus sockets; las sesiones LOCAL permanecen.

Durante la convivencia, un usuario híbrido puede seguir entrando por LOCAL aunque SIAU revoque su acceso institucional; para impedir ese acceso LOCAL debe desactivarse el usuario en Seguimiento.

## Configuración y puesta en servicio

- `SEG_TRAMITES_PUBLIC_URL`: URL pública del backend; define el callback `/auth/callback`.
- `SEG_TRAMITES_UI_URL`: URL opcional del frontend para redirecciones y CORS con credenciales. Omitir cuando NestJS sirve el build de Angular; se usa `SEG_TRAMITES_PUBLIC_URL` para las redirecciones y no se habilita CORS HTTP.
- `IDENTITY_HUB_PUBLIC_URL`: URL canónica de SIAU para autorización y emisor esperado.
- `IDENTITY_HUB_INTERNAL_URL`: base opcional para token, JWKS, directorio y logout entre servidores; si falta, se usa la URL pública.
- `OAUTH_CLIENT_ID` y `OAUTH_CLIENT_SECRET`: credenciales del cliente registrado en SIAU.

Registrar en SIAU `launchUrl` con `/auth/login`, `redirectUri` con `/auth/callback` y `backchannelLogoutUri` con `/api/auth/backchannel-logout`, sobre la URL pública del backend.

`SEG_TRAMITES_PUBLIC_URL` debe coincidir con la URL canónica usada por el navegador, incluyendo esquema y puerto, y con el callback registrado en SIAU. Acceder por una IP/puerto alternativos puede provocar `403` en peticiones de escritura y rechazo del handshake WebSocket. Para un despliegue del mismo origen no hace falta duplicar esa URL en `SEG_TRAMITES_UI_URL`. En producción se requiere HTTPS para poder usar las cookies `Secure` obligatorias.

Con todas las instancias del backend detenidas, ejecutar `npm run migrate:siau-oidc` antes de poner en servicio el login OIDC. El script elimina las sesiones institucionales y transacciones OAuth pendientes y limpia los campos obsoletos de las sesiones LOCAL, conservando sus vencimientos y las credenciales de usuarios. `npm run migrate:siau-oidc -- --dry-run` muestra cuántas sesiones institucionales y transacciones se eliminarían. Ejecutarlo con el nuevo backend activo cerraría también sus sesiones SIAU.
