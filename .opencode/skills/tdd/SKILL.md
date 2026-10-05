---
name: TDD
description: Test-Driven Development workflow (Red-Green-Refactor)
---

# TDD - Desarrollo Guiado por Pruebas

## Descripción
Flujo de trabajo de desarrollo guiado por pruebas (Red-Green-Refactor).

## Flujo

### 1. RED — Escribir una prueba que falla
- Escribe el caso de prueba más pequeño que describa el comportamiento deseado
- Ejecuta la prueba y verifica que FALLE (y que falle por la razón correcta)
- No implementes nada todavía

### 2. GREEN — Hacer pasar la prueba
- Escribe la cantidad mínima de código para que la prueba pase
- No te preocupes por la elegancia, solo haz que pase
- Ejecuta la prueba y verifica que PASA

### 3. REFACTOR — Limpiar el código
- Elimina duplicación
- Mejora nombres
- Extrae funciones/clases si es necesario
- Ejecuta las pruebas después de cada cambio para verificar que siguen pasando

### 4. REPETIR
- Vuelve al paso 1 con el siguiente comportamiento

## Reglas
- Nunca escribas código de producción sin una prueba que falle primero
- Una sola prueba a la vez
- Pasos pequeños y verificables
- Si la prueba no falla, no estás haciendo TDD

## Comandos útiles
```bash
# Ejecutar todas las pruebas
npm test

# Ejecutar en modo watch
npm test -- --watch

# Ejecutar un archivo específico
npm test -- path/to/test

# Con cobertura
npm test -- --coverage
```
