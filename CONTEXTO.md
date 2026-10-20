# ChapinStock — Contexto del proyecto

> Este archivo es la fuente de verdad del proyecto. Cualquier IA (Claude, Codex, Antigravity) debe leerlo ANTES de escribir código.

## 1. Qué es ChapinStock

Aplicación web sencilla para llevar el **inventario de una tiendita**: registrar productos, controlar cuánto stock hay y anotar entradas (compras) y salidas (ventas).

Objetivo real del proyecto: **aprender** Python, Supabase, despliegue en Vercel y flujo de trabajo con Git/GitHub (ramas, pull requests, revisión). El código debe ser simple y entendible, no "elegante a toda costa".

## 2. Stack

| Parte | Tecnología |
|---|---|
| Backend | Python + FastAPI |
| Base de datos y autenticación | Supabase (PostgreSQL) |
| Frontend | HTML + CSS + JavaScript simple (sin frameworks al inicio) |
| Despliegue | Vercel |
| Control de versiones | Git + GitHub (pull requests) |

## 3. Funcionalidades mínimas (MVP)

1. Iniciar sesión / registrarse (Supabase Auth).
2. Crear, listar, editar y eliminar **productos**.
3. Asignar cada producto a una **categoría**.
4. Registrar **movimientos de stock** (entrada o salida) y que el stock se actualice.
5. Ver una lista con el stock actual y avisar cuando un producto tenga **poco stock**.

Fuera del MVP (para después): reportes, exportar a Excel, varios usuarios con roles, escáner de códigos de barras.

## 4. Tablas de la base de datos (borrador)

**categorias**
- id (uuid, PK)
- nombre (texto, único)

**productos**
- id (uuid, PK)
- nombre (texto)
- categoria_id (FK → categorias.id)
- precio (numérico)
- stock_actual (entero, por defecto 0)
- stock_minimo (entero, por defecto 5)
- creado_en (fecha y hora)

**movimientos_stock**
- id (uuid, PK)
- producto_id (FK → productos.id)
- tipo ("entrada" o "salida")
- cantidad (entero, mayor que 0)
- nota (texto, opcional)
- creado_en (fecha y hora)

Regla de negocio: una **salida** no puede dejar el stock en negativo.

## 5. Estructura de carpetas sugerida

```
chapin_stock/
├── api/
│   └── index.py          # punto de entrada FastAPI (Vercel lo usa)
├── app/
│   ├── routes/           # rutas: productos, categorias, movimientos
│   ├── db.py             # conexión a Supabase
│   └── models.py         # modelos de datos
├── public/               # frontend (HTML, CSS, JS)
├── requirements.txt
├── vercel.json
├── .env.example          # ejemplo de variables (SIN valores reales)
├── .gitignore
├── CONTEXTO.md
└── README.md
```

## 6. Reglas de trabajo con Git

1. **Nunca** se sube directo a `main`. Todo entra por pull request.
2. Una rama por tarea, saliendo de `main` actualizado:
   ```bash
   git checkout main
   git pull
   git checkout -b feature/nombre-de-la-tarea
   ```
3. Nombres de rama: `feature/...` para funciones nuevas, `fix/...` para arreglos, `docs/...` para documentación.
4. Commits pequeños y con mensaje claro en español, por ejemplo: `Agrega ruta para crear producto`.
5. **Una IA por rama.** No mezclar dos IAs trabajando a la vez en la misma rama.
6. Hacer commit **antes** de pedirle un cambio grande a una IA, para poder ver `git diff`.
7. Cada pull request se lee y se revisa antes de fusionar (aunque sea uno mismo el revisor).

## 7. Reglas para las IAs

- Leer este archivo antes de empezar.
- Mantener el código **simple**, con nombres claros y comentarios breves en español donde ayuden.
- **Explicar** lo que se escribió cuando la persona lo pida, asumiendo que es su primera vez con Python.
- No agregar librerías ni cambiar el stack sin consultar.
- No hacer cambios fuera de la tarea de la rama actual.
- **Nunca** escribir claves, tokens ni contraseñas en el código. Usar variables de entorno (`.env`, que está en `.gitignore`).
- Por ahora **no escribir pruebas automáticas** (decisión actual del proyecto).

## 8. Reparto sugerido de las IAs

- **Claude**: planificar, diseñar tablas, explicar código, revisar.
- **Codex**: funciones concretas y repetitivas (rutas CRUD, validaciones).
- **Antigravity**: tareas grandes de varios pasos (pantallas completas, configuración de despliegue).

## 9. Hoja de ruta

1. [ ] Repo creado, `.gitignore`, `README.md` y este `CONTEXTO.md` en `main`.
2. [ ] Proyecto creado en Supabase y tablas montadas.
3. [ ] Primera ruta FastAPI (`/` que responda "hola") y **despliegue en Vercel**.
4. [ ] Conexión a Supabase desde Python.
5. [ ] CRUD de categorías.
6. [ ] CRUD de productos.
7. [ ] Movimientos de stock (entradas y salidas).
8. [ ] Login con Supabase Auth.
9. [ ] Frontend básico conectado a la API.
10. [ ] Alertas de poco stock.

Cada punto de la lista = una rama = un pull request.