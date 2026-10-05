---
name: Code Review
description: Systematic code review for quality, readability, and maintainability
---

# Code Review — Revisión de Código

## Descripción
Revisión sistemática de código para garantizar calidad, legibilidad y mantenibilidad.

## Proceso

### 1. VISTA GENERAL
- ¿Qué cambia este PR/commit?
- ¿Por qué se hace este cambio?
- ¿Está relacionado con un issue o requerimiento?

### 2. CORRECTITUD
- ¿El código hace lo que se espera?
- ¿Maneja casos edge (null, undefined, vacío, errores)?
- ¿Hay race conditions o problemas de concurrencia?
- ¿Los tests cubren los cambios?

### 3. LEGIBILIDAD
- ¿Los nombres de variables y funciones son claros?
- ¿El código es fácil de seguir?
- ¿Hay comentarios donde se necesita (y solo donde se necesita)?
- ¿Se sigue el estilo del proyecto?

### 4. ARQUITECTURA
- ¿Respeta las capas de la aplicación?
- ¿Hay acoplamiento innecesario?
- ¿Se pueden extraer componentes reutilizables?
- ¿Los principios SOLID se respetan?

### 5. SEGURIDAD
- ¿Hay vulnerabilidades (inyección, XSS, secrets)?
- ¿Se valida toda entrada del usuario?
- ¿Se manejan errores sin revelar información sensible?

### 6. PERFORMANCE
- ¿Hay consultas N+1?
- ¿Se pueden evitar renders innecesarios?
- ¿Hay memory leaks potenciales?
- ¿Se usan estructuras de datos apropiadas?

### 7. TESTS
- ¿Los tests son significativos (no solo para cubrir líneas)?
- ¿Prueban comportamiento, no implementación?
- ¿Son determinísticos?
- ¿Cubren casos de error?

## Severidad de hallazgos

| Nivel | Descripción | Acción |
|-------|-------------|--------|
| **Blocker** | Bug crítico, vulnerabilidad, data loss | Debe arreglarse antes de mergear |
| **Major** | Problema importante de diseño o rendimiento | Debe arreglarse o justificarse |
| **Minor** | Mejora de legibilidad o estilo | Recomendado |
| **Nit** | Preferencia personal | Opcional |

## Formato de reporte

```markdown
## Resumen
[2-3 frases sobre el estado general]

## Hallazgos

### [Severidad] Título del hallazgo
**Archivo:** `path/to/file.js:42`
**Problema:** [Descripción]
**Sugerencia:** [Cómo arreglarlo]

## Aprobación
- [ ] Listo para mergear
- [ ] Necesita cambios
- [ ] Discusión necesaria
```

## Reglas
- Sé específico y constructivo
- Explica el "por qué" detrás de cada sugerencia
- Reconoce lo que está bien, no solo lo que está mal
- Si no entiendes algo, pregunta antes de criticar
- El objetivo es mejorar el código, no juzgar al autor
