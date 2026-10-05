---
name: Security Review
description: Systematic code review to identify vulnerabilities before production (OWASP Top 10, auth, XSS, secrets)
---

# Security Review — Revisión de Seguridad

## Descripción
Revisión sistemática de código para identificar vulnerabilidades antes de que lleguen a producción.

## Proceso

### 1. OWASP Top 10

#### Inyección
- **SQL/NoSQL:** ¿Se usan consultas parametrizadas? ¿Nunca string concatenation?
- **Command injection:** ¿Se valida antes de pasar a `exec()` o `eval()`?
- **LDAP:** ¿Se sanitizan las entradas en queries LDAP?

#### Autenticación rota
- ¿Las contraseñas se hashean con bcrypt/argon2 (no MD5/SHA1)?
- ¿Hay rate limiting en endpoints de login?
- ¿Las sesiones tienen expiración?
- ¿Se puede forzar la URL de reset de contraseña?

#### Exposición de datos sensibles
- ¿Los datos sensibles se cifran en tránsito y en reposo?
- ¿No hay secrets en el código (API keys, passwords)?
- ¿Los errores no revelan información interna?

#### Control de acceso roto
- ¿Se verifica autorización en CADA endpoint?
- ¿No hay IDOR (Insecure Direct Object Reference)?
- ¿El admin está protegido por rol, no solo por UI?

#### XSS (Cross-Site Scripting)
- ¿Se sanitiza toda salida al DOM?
- ¿Se usa `textContent` en lugar de `innerHTML`?
- ¿Hay Content-Security-Policy configurado?

#### Deserialización insegura
- ¿Se deserializa datos de fuentes no confiables?
- ¿Se valida el schema antes de deserializar?

#### Componentes vulnerables
- ¿Se ejecuta `npm audit` / `pip audit` regularmente?
- ¿Las dependencias están actualizadas?

#### Logging insuficiente
- ¿Se loguean intentos de login fallidos?
- ¿Se detectan patrones de ataque?
- ¿Los logs no contienen datos sensibles?

### 2. Autenticación y Autorización

```javascript
// ❌ INSEGURO - Sin rate limiting
app.post('/login', async (req, res) => {
  const user = await User.findOne({ email: req.body.email })
  if (user && bcrypt.compareSync(req.body.password, user.password)) {
    res.json({ token: generateToken(user) })
  }
})

// ✅ SEGURO - Con rate limiting y manejo de errores
app.post('/login', rateLimit({ max: 5, windowMs: 15 * 60 * 1000 }), async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email })
    if (!user || !bcrypt.compareSync(req.body.password, user.password)) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }
    res.json({ token: generateToken(user) })
  } catch (error) {
    logger.error('Login error', { error: error.message })
    res.status(500).json({ error: 'Internal server error' })
  }
})
```

### 3. Validación de Entrada

```javascript
// ❌ INSEGURO - Sin validación
app.get('/users', async (req, res) => {
  const users = await User.find({ name: req.query.name })
  res.json(users)
})

// ✅ SEGURO - Con validación y sanitización
app.get('/users', async (req, res) => {
  const schema = z.object({
    name: z.string().min(1).max(100).optional(),
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(100).default(20),
  })
  
  const parsed = schema.safeParse(req.query)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid query parameters' })
  }
  
  const users = await User.find({ name: parsed.data.name })
    .skip((parsed.data.page - 1) * parsed.data.limit)
    .limit(parsed.data.limit)
  
  res.json(users)
})
```

### 4. Secrets y Configuración

```bash
# ❌ NUNCA hagas esto
echo "API_KEY=sk-1234567890" > .env
git add .env
git commit -m "add env"

# ✅ Correcto
echo ".env" >> .gitignore
cp .env.example .env
# Llena .env manualmente, nunca lo commitees
```

```javascript
// ❌ INSEGURO - Secret en código
const apiKey = "sk-1234567890"

// ✅ SEGURO - Variable de entorno
const apiKey = process.env.API_KEY
if (!apiKey) {
  throw new Error('API_KEY environment variable is required')
}
```

### 5. Headers de Seguridad

```javascript
// Express con helmet
import helmet from 'helmet'

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Evita unsafe-inline si es posible
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  frameguard: { action: 'deny' },
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}))
```

### 6. Dependencias

```bash
# Node.js
npm audit
npm audit fix

# Python
pip-audit
pip install --upgrade <package>

# Rust
cargo audit

# Go
govulncheck ./...
```

## Checklist rápido

- [ ] Consultas parametrizadas (no SQL string concatenation)
- [ ] Passwords hasheados con bcrypt/argon2
- [ ] Rate limiting en auth endpoints
- [ ] Validación de entrada en todos los endpoints
- [ ] Secrets en variables de entorno, no en código
- [ ] Headers de seguridad (CSP, HSTS, X-Frame-Options)
- [ ] Dependencias auditadas y actualizadas
- [ ] Logging de eventos de seguridad
- [ ] Manejo de errores sin revelar información interna
- [ ] CSRF protection para mutaciones
- [ ] CORS configurado correctamente (no wildcard en producción)

## Severidad

| Nivel | Ejemplo | Acción |
|-------|---------|--------|
| **Crítica** | SQL injection, RCE, secret expuesto | Bloquear merge inmediatamente |
| **Alta** | XSS, IDOR, auth rota | Debe arreglarse antes de mergear |
| **Media** | Sin rate limiting, headers faltantes | Arreglar en este sprint |
| **Baja** | Dependencia desactualizada, warning menor | Planificar corrección |

## Herramientas recomendadas

| Herramienta | Lenguaje | Uso |
|-------------|----------|-----|
| `semgrep` | Multi | Análisis estático de seguridad |
| `bandit` | Python | Análisis estático |
| `npm audit` | Node.js | Vulnerabilidades en dependencias |
| `snyk` | Multi | Monitoreo continuo |
| `owasp-zap` | Web | Escaneo dinámico |
| `trivy` | Contenedores | Escaneo de imágenes Docker |
