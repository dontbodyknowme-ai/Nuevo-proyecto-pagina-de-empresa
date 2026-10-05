---
name: Debugging
description: Systematic approach to finding and fixing bugs
---

# Debugging - Depuración Sistemática

## Descripción
Enfoque sistemático para encontrar y corregir bugs.

## Proceso

### 1. REPRODUCIR
- Identifica los pasos exactos para reproducir el bug
- Determina qué debería pasar vs qué pasa realmente
- Encuentra el caso más simple que lo reproduzca

### 2. ALCANCE
- ¿Es un bug de frontend, backend, datos, o integración?
- ¿Cuándo empezó a ocurrir?
- ¿Qué cambió recientemente?
- ¿Es determinístico o intermitente?

### 3. INVESTIGAR
- Lee los mensajes de error completamente
- Revisa logs y stack traces
- Usa breakpoints o logging para rastrear el flujo
- Hipótesis: ¿qué está causando el problema?

### 4. HIPÓTESIS Y PRUEBA
- Formula una hipótesis específica
- Diseña un experimento para probarla
- Cambia una sola cosa a la vez
- Documenta lo que aprendiste

### 5. CORREGIR
- Implementa la corrección más simple posible
- Verifica que el bug desaparece
- Verifica que no introdujo nuevos problemas

### 6. PREVENIR
- ¿Cómo podemos evitar este tipo de bug en el futuro?
- ¿Necesitamos más pruebas, validación, o documentación?

## Técnicas comunes

### Binary Search Debugging
- Comenta la mitad del código
- ¿El bug persiste?
- Repite con la mitad correcta

### Rubber Duck Debugging
- Explica el problema línea por línea a un pato de goma (o a ti mismo)
- El acto de explicar a menudo revela la solución

### Git Bisect
```bash
git bisect start
git bisect bad
git bisect good <commit-known-good>
# Git automáticamente revisa el punto medio
# Prueba y marca: git bisect good o git bisect bad
git bisect reset
```

## Reglas
- No adivines — investiga
- Una sola variable a la vez
- Si no entiendes el bug, no lo arregles
- El mejor bug fix es el que previene la clase entera de bugs
