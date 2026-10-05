---
description: SDD · Genera el spec tecnico de una spect aprobada
agent: planner
---
Lee docs/constitucion.md, AGENTS.md y specs/$1/spec.md usa la skil sdd
No escribas codigo.

Genera specs/$1/plan.md con: archivos que se crean o modifican y la
responsabilidad de cada uno, funciones puras de logica (con "hoy" como
parametro), algoritmo de pseudocodigo, como se pinta la interfaz, 
decisiones tecnicas justificadas (con su alternativa descartada) y estrategia
de test con node --test

Todo debe respetar la constitucion y cubrir todos los RF. Marca que RF cubre 
cada parte. Si la spec no esta aprobada o tiene dudas abiertas, para y avisame.