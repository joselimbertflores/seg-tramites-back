# Autenticación LOCAL y SSO

Identity Hub es la autoridad de autenticación institucional y del acceso a la aplicación. Seguimiento administra el `User` local, las `Account`, los roles y los permisos operativos. Los permisos efectivos son la unión de `User.roles` y `Account.role`; un usuario puede tener permisos propios sin ocupar una cuenta.

LOCAL y SSO utilizan el mismo modelo `AuthSession` en MongoDB, identificado por `authMethod: LOCAL | IDENTITY_HUB`. El navegador recibe `seg_tramites_session`, una cookie HttpOnly opaca con `Path=/` que contiene únicamente el identificador aleatorio de sesión.

## Login LOCAL

`POST /api/auth` valida `login` y `password` con bcrypt y requiere `User.isActive`. Crea una sesión LOCAL con una duración absoluta de diez horas y devuelve el estado del usuario.

`GET /api/auth/me` devuelve usuario, método de autenticación, cuenta, menú y permisos. Incluye `updatedPassword` únicamente para LOCAL. `PUT /api/auth` cambia la contraseña de una sesión LOCAL y establece `updatedPassword: true`; las contraseñas institucionales se administran en Identity Hub. `isActive` se comprueba al resolver sesiones LOCAL; para SSO, la autoridad de acceso es Identity Hub.

## Login SSO

El flujo utiliza OAuth Authorization Code con PKCE S256:

1. `GET /auth/login` crea una transacción con `state`, verificador PKCE y `expiresAt` a cinco minutos. Guarda su identificador en la cookie HttpOnly `seg_tramites_oauth_transaction`, con `Path=/auth` y `SameSite=Lax`, y redirige al navegador a Identity Hub.
2. Identity Hub devuelve el navegador a `GET /auth/callback`. Seguimiento consume la transacción de forma atómica, comprueba `state` y `expiresAt`, y canjea el código usando el verificador PKCE y las credenciales del cliente OAuth.
3. Seguimiento verifica el access token con JWKS: firma RS256, emisor, audiencia, expiración y claims obligatorios. El `externalKey` debe corresponder a un `User` local previamente provisionado. Si no existe, el login se rechaza como `not_provisioned`; no hay creación JIT de usuarios durante el login.
4. Se crea una `AuthSession` institucional, se sustituye la sesión anterior presentada por el navegador, se establece la cookie de sesión y se redirige a `/home` en la UI.

Las rutas `/auth/login` y `/auth/callback` están fuera del prefijo `/api`. Los access y refresh tokens de Identity Hub se almacenan únicamente en el servidor, asociados a la sesión; no se entregan a la UI.

## Sesión, renovación y logout

HTTP y WebSocket resuelven la misma `AuthSession`. WebSocket valida la conexión, revalida antes de ejecutar mensajes protegidos y comprueba periódicamente las conexiones inactivas. Las eliminaciones notifican inmediatamente a los sockets del mismo proceso; los demás procesos detectan la revocación al revalidar.

El refresh es rotatorio y se serializa por sesión mediante un lease en MongoDB, compartido por HTTP, WebSocket y los procesos de la aplicación. El servidor conserva el nuevo par de tokens antes de verificarlo con JWKS. La sesión SSO tiene como límite absoluto la expiración inicial del refresh token; la rotación no prolonga ese límite ni la cookie. Las expiraciones se comprueban explícitamente en código, además de los índices TTL de MongoDB.

`POST /api/auth/logout` elimina la sesión de Seguimiento y limpia sus cookies; no cierra la sesión global de Identity Hub. Tanto el login LOCAL como el logout pueden borrar la cookie OAuth indicando `Path=/auth`, pero no reciben su valor en `/api/auth`. Sus transacciones pendientes quedan para la limpieza TTL de MongoDB.

## URLs y registro del cliente

| Concepto             | Variable actual             | Responsabilidad                                                                                                                                                                                  |
| -------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `PUBLIC_URL`         | `SEG_TRAMITES_PUBLIC_URL`   | URL pública del backend. Define su origen permitido y permite construir el callback público `/auth/callback`.                                                                                    |
| `UI_URL`             | `SEG_TRAMITES_UI_URL`       | URL opcional del frontend. Define el destino de las redirecciones y el origen habilitado con credenciales para HTTP y WebSocket. Si se omite, las redirecciones usan la URL pública del backend. |
| Identity Hub público | `IDENTITY_HUB_PUBLIC_URL`   | URL canónica de Identity Hub: base de `/oauth/authorize` para el navegador y valor obligatorio del `iss` esperado del JWT. También es la base para token, JWKS y directorio interno si no existe `IDENTITY_HUB_INTERNAL_URL`. |
| Identity Hub interno | `IDENTITY_HUB_INTERNAL_URL` | Base opcional server-to-server del mismo Identity Hub para `/oauth/token`, `/.well-known/jwks.json` y `/internal/users/assignable` (búsqueda y detalle). Nunca define el issuer esperado ni la URL de autorización del navegador. |

El cliente se identifica mediante `OAUTH_CLIENT_ID` y `OAUTH_CLIENT_SECRET`. En Identity Hub, `launchUrl` normalmente apunta a `/auth/login` sobre la URL pública del backend; `redirectUri` debe coincidir con la URL pública `/auth/callback` que construye Seguimiento.
