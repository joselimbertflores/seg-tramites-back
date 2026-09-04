# Identidad, funcionarios y cuentas operativas

Seguimiento separa tres conceptos que no deben fusionarse: la identidad local de una persona (`User`), su proyección laboral desde RRHH (`Officer`) y el cargo o bandeja operativa (`Account`). Esta separación permite que un cargo sobreviva a los cambios de funcionario y que una persona conserve permisos propios aunque no ocupe un cargo.

## Autoridades del modelo

- **Identity Hub** es la autoridad de identidad y autenticación, y controla el acceso de la persona a la aplicación.
- **RRHH** es la autoridad de los datos del funcionario y de su vigencia laboral.
- **Seguimiento** es la autoridad de las cuentas, los roles y los permisos operativos.

## User

`User` representa la identidad local dentro de Seguimiento. Se vincula con la identidad institucional de Identity Hub mediante `externalKey`, pero conserva su `_id` propio de MongoDB como identidad y referencia interna.

Un `User` puede tener roles directos y puede existir sin una `Account`; por ejemplo, un administrador con autoridad transversal. `login` y `password` pertenecen al mecanismo local actual o *legacy* y dejarán de ser relevantes cuando SSO sea el único mecanismo de autenticación.

## Officer

`Officer` es la proyección local del funcionario proveniente de RRHH. No autentica usuarios ni contiene permisos. Su identificador funcional es la `relationKey` de RRHH, almacenada actualmente en el campo `dni`.

No debe existir un CRUD administrativo independiente para `Officer`: sus datos y su vigencia se validan contra RRHH. El registro local puede conservarse por razones históricas aunque el funcionario ya no esté asignado a una `Account`.

## Account

`Account` representa una bandeja o cargo operativo, no una persona. Contiene la configuración operativa y el `role` propio del cargo. Su ciclo de vida es independiente del funcionario que la ocupa, por lo que sobrevive a reasignaciones y puede estar ocupada o vacante.

Una asignación siempre es completa:

```text
Account ocupada: user != null y officer != null
Account vacante: user == null y officer == null
```

Nunca debe existir una `Account` parcialmente asignada. Además:

```text
1 User    → máximo 1 Account
1 Officer → máximo 1 Account
```

Una misma persona no debe duplicarse creando varios `User` u `Officer` para ocupar más de una `Account`.

## Asignación y desasignación

La asignación resuelve y valida las identidades en este orden:

```text
Identity Hub externalKey
→ User de Identity Hub
→ relationKey
→ validación en RRHH
→ User + Officer locales
→ Account
```

`externalKey` y `relationKey` son las claves de correlación entre autoridades. Nunca se debe hacer *matching* por nombre, email o `login`.

Desasignar deja vacante el cargo de forma atómica:

```ts
account.user = null;
account.officer = null;
```

La desasignación no elimina automáticamente `User`, `Officer` ni `Account`. Tampoco revoca automáticamente el acceso a la aplicación en Identity Hub, porque el `User` puede conservar autoridad directa independiente de la `Account`.

## Autorización

La autoridad efectiva dentro de Seguimiento es la unión de:

```text
User.roles
+
Account.role
```

Los roles directos de `User` pertenecen a la persona; el `role` de `Account` pertenece al cargo operativo. Identity Hub controla el acceso a la aplicación, pero no define los permisos internos de Seguimiento.
