# Configuración de reglas de seguridad para Firestore

Las operaciones de sincronización del tablero (colecciones `users` y `activities`) requieren que las reglas de Firestore permitan lecturas a los usuarios institucionales y escrituras únicamente al administrador principal. Si ves errores como:

```
FirebaseError: Missing or insufficient permissions
```

debes actualizar las reglas de seguridad de tu proyecto siguiendo este ejemplo:

```rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isSignedIn() {
      return request.auth != null;
    }

    function isInstitutionalUser() {
      return isSignedIn()
        && request.auth.token.email_verified == true
        && lower(request.auth.token.email).endsWith('@potros.itson.edu.mx');
    }

    function isPrimaryAdmin() {
      return isInstitutionalUser()
        && lower(request.auth.token.email) == 'isaac.paniagua@potros.itson.edu.mx';
    }

    match /users/{userId} {
      allow read: if isInstitutionalUser();
      allow create, update, delete: if isPrimaryAdmin();
    }

    match /activities/{activityId} {
      allow read: if isInstitutionalUser();
      allow create, update, delete: if isPrimaryAdmin();
    }
  }
}
```

## Cómo usar estas reglas

1. Abre la consola de Firebase y ve a **Firestore Database → Rules**.
2. Sustituye el contenido por el snippet anterior.
3. Ajusta los valores si tu administrador principal o dominio institucional son distintos:
   - Cambia `potros.itson.edu.mx` por el dominio institucional que corresponda.
   - Cambia `isaac.paniagua@potros.itson.edu.mx` por el correo del administrador con permisos de escritura.
4. Publica los cambios para que los permisos se apliquen.

Con esta configuración:

- Cualquier cuenta institucional verificada puede leer los registros necesarios para utilizar el tablero.
- Sólo el administrador principal puede crear, actualizar o eliminar usuarios y actividades, lo que evita modificaciones no autorizadas.

Si necesitas dar permisos a más administradores puedes duplicar la condición de `isPrimaryAdmin()` o, de preferencia, validar contra un campo `role` dentro del documento del usuario.
