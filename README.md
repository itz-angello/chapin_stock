# ChapinStock

ChapinStock es una aplicación web sencilla para llevar el inventario de una tiendita.

## Ejecutar en local

1. Crear el entorno virtual:

   ```bash
   python -m venv .venv
   ```

2. Activarlo en Linux o macOS:

   ```bash
   source .venv/bin/activate
   ```

3. Instalar las dependencias:

   ```bash
   pip install -r requirements.txt
   ```

4. Iniciar el servidor:

   ```bash
   uvicorn api.index:app --reload
   ```
