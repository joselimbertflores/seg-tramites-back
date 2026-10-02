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

## Logout

`POST /api/auth/logout` elimina la sesión local y limpia las cookies. Para LOCAL termina allí. Para SIAU obtiene primero el `identitySid` y, después del cierre local, notifica en segundo plano a `/internal/sessions/logout` con ese `sid` y las credenciales del cliente. Los fallos remotos se registran y no bloquean ni revierten el logout local.

`POST /api/auth/backchannel-logout` recibe `logout_token` en un cuerpo `application/x-www-form-urlencoded`. Valida RS256/JWKS, `kid`, `typ=logout+jwt`, emisor, audiencia exacta del cliente, `iat`, `exp`, `jti`, `sid`, el evento estándar de Back-Channel Logout y ausencia de `nonce`. Elimina idempotentemente las sesiones `IDENTITY_HUB` con ese `identitySid` y desconecta sus sockets; las sesiones LOCAL permanecen.

Durante la convivencia, un usuario híbrido puede seguir entrando por LOCAL aunque SIAU revoque su acceso institucional; para impedir ese acceso LOCAL debe desactivarse el usuario en Seguimiento.

## Configuración y puesta en servicio

- `SEG_TRAMITES_PUBLIC_URL`: URL pública del backend; define el callback `/auth/callback`.
- `SEG_TRAMITES_UI_URL`: URL opcional del frontend para redirecciones y CORS con credenciales.
- `IDENTITY_HUB_PUBLIC_URL`: URL canónica de SIAU para autorización y emisor esperado.
- `IDENTITY_HUB_INTERNAL_URL`: base opcional para token, JWKS, directorio y logout entre servidores; si falta, se usa la URL pública.
- `OAUTH_CLIENT_ID` y `OAUTH_CLIENT_SECRET`: credenciales del cliente registrado en SIAU.

Registrar en SIAU `launchUrl` con `/auth/login`, `redirectUri` con `/auth/callback` y `backchannelLogoutUri` con `/api/auth/backchannel-logout`, sobre la URL pública del backend.

Con todas las instancias del backend detenidas, ejecutar `npm run migrate:siau-oidc` antes de poner en servicio el login OIDC. El script elimina las sesiones institucionales y transacciones OAuth pendientes y limpia los campos obsoletos de las sesiones LOCAL, conservando sus vencimientos y las credenciales de usuarios. `npm run migrate:siau-oidc -- --dry-run` muestra cuántas sesiones institucionales y transacciones se eliminarían. Ejecutarlo con el nuevo backend activo cerraría también sus sesiones SIAU.
