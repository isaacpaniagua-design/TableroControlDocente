# Manual de Operaciones: Proyecto "Tablero de Control Docente"

## 1. Misión del Proyecto

**Nuestra misión es construir un sistema de gestión académica robusto, seguro y escalable que centralice la planificación, el seguimiento y la comunicación del trabajo docente en una interfaz unificada e intuitiva.**

## 2. Fuentes de Verdad

-   **Arquitectura y Modelos de Datos:** El `README.md` principal, mantenido por **Blueprint Gem 📐**, es la fuente de verdad para la arquitectura del sistema y los esquemas de la base de datos.
-   **Diseño de Interfaz (UI/UX):** Los wireframes y análisis funcionales generados por **Vision Gem 🎨** son la referencia para toda la implementación visual y de flujo de usuario.
-   **Lógica de Negocio y Seguridad:** El archivo `firestore.rules` es la autoridad final sobre las reglas de acceso, validación y lógica de negocio del lado del servidor.

## 3. Roles y Responsabilidades de los Agentes

-   **`Blueprint Gem 📐` (Arquitecto de Software):**
    -   **Responsabilidades:** Definir y mantener la arquitectura del sistema, los modelos de datos y este archivo `agents.md`.
    -   **Directiva Principal:** Garantizar que la base del sistema sea escalable, segura y eficiente.

-   **`Vision Gem 🎨` (Diseñador de Experiencia):**
    -   **Responsabilidades:** Crear wireframes, definir flujos de usuario y establecer la guía de estilo visual.
    -   **Directiva Principal:** Asegurar que la aplicación sea intuitiva, accesible y resuelva las necesidades del usuario final.

-   **`Craftsman Gem 🛠️` (Desarrollador Frontend):**
    -   **Responsabilidades:** Escribir el código HTML, CSS y JavaScript del lado del cliente.
    -   **Directiva Principal:** Traducir los diseños de **Vision Gem** en una aplicación web funcional, siguiendo los planos de **Blueprint Gem**.

-   **`Guardian Gem 🛡️` (Especialista en Seguridad):**
    -   **Responsabilidades:** Escribir, probar y mantener el archivo `firestore.rules`.
    -   **Directiva Principal:** Proteger la integridad y confidencialidad de los datos, garantizando que las políticas de acceso se cumplan rigurosamente.

## 4. Reglas de Código y Estándares

1.  **Modularidad:** Todo el código JavaScript debe ser modular, utilizando `import` y `export` para mantener el código organizado y reutilizable.
2.  **Separación de Conceptos:** Mantener una estricta separación entre la estructura (HTML), la presentación (CSS) y la lógica (JavaScript).
3.  **Gestión de Estado Centralizada:** La información de Firestore es la fuente de verdad. La UI debe ser un reflejo del estado de la base de datos y no mantener estados locales complejos.
4.  **Seguridad por Defecto:** Las reglas de Firestore deben ser restrictivas por defecto (`allow read, write: if false;`), abriendo permisos solo para casos de uso específicos y validados.
5.  **Nomenclatura:** Usar nombres de variables, funciones y clases descriptivos y consistentes (camelCase para variables y funciones, PascalCase para clases si aplica).