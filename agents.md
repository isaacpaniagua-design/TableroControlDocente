Claro, he integrado las directrices de colaboración y la estructura de roles del archivo `agents (1).md` en el documento principal.

La sección de **Colaboración y Comunicación** ha sido enriquecida para reflejar la importancia de respetar las "fuentes de verdad" y colaborar con los roles especializados cuando surgen problemas.

Aquí está la versión final y consolidada del `agents.md`:

***

# Acuerdos de Trabajo para Desarrollo (agents.md)

Este documento establece las directrices y buenas prácticas que todo desarrollador Senior Fullstack debe seguir. Nuestro objetivo es mantener la calidad, consistencia y mantenibilidad del código a través de múltiples proyectos, fomentando un entorno de trabajo colaborativo y eficiente.

---

## Filosofía General

* **Propiedad y Responsabilidad (Ownership):** Eres responsable del código que escribes, desde su concepción hasta su despliegue y mantenimiento. Actúa como un propietario, no como un simple ejecutor.
* **Profesionalismo:** Escribe código del que te sientas orgulloso. Un trabajo limpio, probado y bien documentado es la marca de un profesional.
* **Mejora Continua:** Busca siempre formas de mejorar el código, los procesos y tus propias habilidades. La complacencia es el enemigo de la calidad.

---

## 1. Control de Versiones (Git Workflow) 🌳

La integridad de nuestro código base es primordial. Un flujo de trabajo ordenado previene errores y facilita la colaboración.

* **Nunca hagas push directo a `main` o `develop`:** Todo cambio, sin importar cuán pequeño sea, debe realizarse en una *feature branch*.
* **Flujo de Trabajo Basado en Pull Requests (PRs):**
    1.  Crea una rama descriptiva desde `develop` (ej. `feature/TICKET-123-nueva-autenticacion`).
    2.  Realiza commits atómicos y con mensajes claros (se recomienda [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)).
    3.  Abre un Pull Request hacia `develop` cuando el trabajo esté listo para revisión.
    4.  El PR debe tener una descripción clara, explicando **qué** cambia y **por qué**.
    5.  Se requiere al menos **una aprobación** de otro miembro del equipo para hacer merge. No apruebes tus propios PRs.
* **Mantén tu rama actualizada:** Antes de solicitar una revisión, asegúrate de que tu rama está actualizada con los últimos cambios de `develop` (`git pull origin develop`) para evitar conflictos.

---

## 2. Calidad y Estilo de Código ✨

Un código limpio es más fácil de leer, entender y mantener.

* **Código Limpio y Explicado:** El código debe ser autoexplicativo siempre que sea posible. Usa nombres de variables y funciones descriptivos. Si la lógica es compleja, **apóyala con comentarios que expliquen el "porqué"**, no el "qué".
* **Sigue los Principios Fundamentales:** Aplica principios de diseño de software como **SOLID**, **DRY** (Don't Repeat Yourself) y **KISS** (Keep It Simple, Stupid).
* **Nomenclatura Consistente:** Usar nombres de variables, funciones y clases descriptivos y consistentes (camelCase para variables y funciones, PascalCase para clases).
* **Modularidad y Separación de Conceptos:** Todo el código debe ser modular (`import`/`export`). Mantén una estricta separación entre la estructura (HTML), la presentación (CSS) y la lógica (JavaScript).
* **Gestión de Estado Centralizada:** La información de la base de datos (ej. Firestore) es la fuente de verdad. La UI debe ser un reflejo de su estado y no mantener estados locales complejos.
* **Manejo de Secretos:** **Nunca** almacenes credenciales, tokens o cualquier tipo de información sensible directamente en el código. Utiliza variables de entorno (`.env`) y servicios de gestión de secretos.

---

## 3. Documentación 📚

El código solo cuenta una parte de la historia. Una buena documentación es crucial para la escalabilidad del equipo y del proyecto.

* **Documentación es Obligatoria, no Opcional:** No se aceptará código sin la documentación correspondiente. No hay omisiones ni asunciones.
* **Documentación de APIs:** Todas las APIs deben estar documentadas usando estándares como OpenAPI (Swagger).
* **README.md actualizado:** Cada repositorio debe tener un `README.md` claro que explique qué hace el proyecto, cómo instalarlo, ejecutarlo y correr sus pruebas.

---

## 4. Pruebas y QA (Quality Assurance) ✅

No puedes garantizar que algo funciona si no lo has probado.

* **Las nuevas funcionalidades requieren pruebas:** Todo nuevo desarrollo o corrección de error debe ir acompañado de pruebas unitarias y/o de integración que validen su comportamiento.
* **Cobertura de Código (Code Coverage):** Apuntamos a una cobertura de código mínima del 80%.
* **Prueba Manual:** Antes de enviar un PR, prueba tu funcionalidad de forma manual para asegurar que la experiencia de usuario es la correcta.

---

## 5. Colaboración y Comunicación 🤝

Somos un equipo, no un conjunto de individuos. El éxito depende de nuestra capacidad para colaborar eficazmente.

* **Apóyate en Otros Roles:** Si no eres experto en un área (ej. diseño de UI/UX, infraestructura, bases de datos), **busca y colabora** con el especialista correspondiente. No asumas ni intentes adivinar.
* **Respeta las Fuentes de Verdad:** Cada aspecto del proyecto tiene una autoridad final. Ante un problema o duda, acude a la fuente correcta:
    * **Problemas de Arquitectura o Modelo de Datos:** La fuente de verdad es la documentación de arquitectura (`README.md`) mantenida por el **Arquitecto de Software** (`Blueprint Gem 📐`). Él tiene la última palabra sobre la estructura del sistema.
    * **Problemas de Diseño o Flujo de Usuario:** La fuente de verdad son los wireframes y prototipos del **Diseñador de Experiencia** (`Vision Gem 🎨`). Tu trabajo es traducir fielmente esa visión.
    * **Problemas de Lógica de Negocio o Seguridad:** La fuente de verdad son las reglas definidas en archivos como `firestore.rules`, mantenidas por el **Especialista en Seguridad** (`Guardian Gem 🛡️`). Debes implementar y corregir código para cumplir rigurosamente estas reglas.
* **Code Reviews Constructivos:**
    * **Al revisar:** Sé respetuoso y claro. Haz sugerencias, no des órdenes.
    * **Al recibir feedback:** Mantén una mente abierta. El objetivo es mejorar la calidad del producto.
* **Comunicación Proactiva:** Si estás bloqueado o prevés un retraso, comunícalo **inmediatamente**.

---

## 6. Seguridad (Security First) 🔐

La seguridad no es una característica adicional, es una responsabilidad fundamental.

* **Seguridad por Defecto:** Las reglas de acceso deben ser restrictivas por defecto (ej. `allow read, write: if false;`), abriendo permisos solo para casos de uso específicos y validados.
* **Validación y Sanitización de Entradas:** Nunca confíes en los datos que provienen del cliente. Valida y sanitiza toda la información.
* **Gestión de Dependencias:** Mantén las dependencias del proyecto actualizadas para evitar vulnerabilidades conocidas.

---

## 7. Registro de Cambios (Changelog) 🚀

Mantener un registro claro de los cambios es vital para la comunicación con todo el equipo.

* **Changelog Automatizado:** Todos los repositorios deben implementar un sistema para generar un `CHANGELOG.md` de forma automática.
* **Basado en Conventional Commits:** El changelog se generará a partir de mensajes de commit que sigan la especificación de [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).
* **Versiones Semánticas (SemVer):** El versionado del software seguirá el estándar de [Versionado Semántico](https://semver.org/).
