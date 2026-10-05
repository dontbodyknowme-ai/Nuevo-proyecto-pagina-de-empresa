---
name: Git
description: Git workflow (branching, semantic commits, rebasing, conflict resolution)
---

# Git — Flujo de Trabajo con Git

## Descripción
Flujo de trabajo de git: branching, commits semánticos, rebasing y resolución de conflictos.

## Branching Strategy

### Git Flow (recomendado para proyectos con releases)
```
main        ← Producción (siempre estable)
  ↑
develop     ← Integración de features
  ↑
feature/*   ← Ramas de funcionalidades
  ↑
hotfix/*    ← Fixes urgentes de producción
  ↑
release/*   ← Preparación de releases
```

### GitHub Flow (simple, para despliegues continuos)
```
main        ← Producción (siempre desplegable)
  ↑
feature/*   ← Ramas de funcionalidades (PR → main)
```

## Crear una rama

```bash
# Desde la rama base (main o develop)
git checkout -b feature/nombre-descriptivo

# Ejemplos de nombres
git checkout -b feature/user-authentication
git checkout -b bugfix/login-redirect
git checkout -b refactor/extract-payment-service
git checkout -b hotfix/security-patch
```

## Commits Semánticos (Conventional Commits)

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Tipos

| Tipo | Descripción | Ejemplo |
|------|-------------|---------|
| `feat` | Nueva funcionalidad | `feat(auth): add JWT token refresh` |
| `fix` | Corrección de bug | `fix(api): handle null response` |
| `docs` | Documentación | `docs: update API endpoints` |
| `style` | Formato (sin cambio de lógica) | `style: fix indentation` |
| `refactor` | Refactorización | `refactor(user): extract validation` |
| `perf` | Mejora de rendimiento | `perf(query): add index on email` |
| `test` | Tests | `test(auth): add login tests` |
| `chore` | Mantenimiento | `chore: update dependencies` |
| `build` | Build system | `build: upgrade to vite 5` |
| `ci` | CI/CD | `ci: add deploy workflow` |
| `revert` | Revertir commit | `revert: feat(auth): add JWT` |

### Reglas
- Usa imperativo: "add" no "added" ni "adds"
- Primera letra minúscula
- Sin punto final
- Máximo 50 caracteres en el título
- Usa el body para explicar el "por qué", no el "qué"

## Sincronizar con remoto

```bash
# Traer cambios de la rama base
git fetch origin
git rebase origin/main

# O si prefieres merge
git merge origin/main

# Subir tu rama
git push origin feature/nombre-descriptivo

# Si ya existe y hiciste rebase (force push seguro)
git push --force-with-lease origin feature/nombre-descriptivo
```

## Resolución de conflictos

### Cuando ocurre un conflicto
```bash
# 1. Git te marca los archivos en conflicto
git status

# 2. Abre los archivos y busca los marcadores:
# <<<<<<< HEAD
# Tu código
# =======
# Código de la otra rama
# >>>>>>> origin/main

# 3. Decide: ¿qué código se queda? ¿Una combinación?

# 4. Edita el archivo, elimina los marcadores

# 5. Marca como resuelto
git add <archivo>

# 6. Continúa el rebase
git rebase --continue

# O si quieres abortar
git rebase --abort
```

### Estrategias para evitar conflictos
- Ramas pequeñas y de corta duración
- Sincroniza frecuentemente con la rama base
- Comunica con tu equipo quién toca qué archivos
- Haz rebase, no merge, para mantener historial limpio

## Pull Requests

### Crear un PR
1. Sincroniza tu rama con `main`
2. Asegura que los tests pasen
3. Crea el PR con título descriptivo
4. Incluye en la descripción:
   - Qué hace y por qué
   - Cómo probarlo
   - Screenshots si aplica
   - Issues relacionados

### Revisar un PR
1. Lee la descripción
2. Revisa los cambios archivo por archivo
3. Verifica tests
4. Deja comentarios constructivos
5. Aprueba o pide cambios

## Comandos útiles

```bash
# Ver historial de forma legible
git log --oneline --graph --decorate

# Ver qué archivos cambiaron
git diff --name-only main...HEAD

# Último commit (para amend)
git commit --amend --no-edit

# Stash temporal
git stash push -m "WIP: feature X"
git stash list
git stash pop

# Encontrar un commit que introdujo un bug
git bisect start
git bisect bad
git bisect good <commit-hash>
git bisect reset

# Limpiar ramas locales mergeadas
git branch --merged | grep -v "main\|develop" | xargs git branch -d
```

## Reglas
- Nunca hagas push directo a `main`
- Commits pequeños y atómicos
- Un commit = un cambio lógico
- Mensajes de commit claros y descriptivos
- Rebase para mantener historial lineal
- `--force-with-lease` en lugar de `--force`
