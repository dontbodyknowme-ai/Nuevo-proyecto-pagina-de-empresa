---
description: SDD · Entrevista y genera la spec (uso - /sdd-spec 002-nombre idea inicial)
agent: planner
---
No escribas codigo en ningun momento. Lee docs/constitucion.md y MEMORY.md, y usa la skill sdd.

Carpeta de la spec: specs/$1/
Idea inicial (el texto que va despues del nombre de la carpeta): $ARGUMENTS

Tu trabajo: 
1. Hazme preguntas de UNA en UNA para eliminar ambiguedades (casos limite,
errores, que queda fuera de esta version). Maximo 5 preguntas.
2. Con mis respuestas, genera specs/$1/spec.md siguiendo la plantilla de la 
skil sdd, con los requisitos en EARS y "Estado: borrador"
3. Solo el QUE y el POR QUE: nada de stack, arquitectura ni nombres de archivos.
