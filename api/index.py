from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.routes.categorias import router as categorias_router
from app.routes.movimientos import router as movimientos_router
from app.routes.productos import router as productos_router

app = FastAPI(title="ChapinStock")
app.include_router(categorias_router)
app.include_router(movimientos_router)
app.include_router(productos_router)


@app.get("/salud")
def salud():
    return {"estado": "ok"}


ruta_public = Path(__file__).resolve().parent.parent / "public"
app.mount("/", StaticFiles(directory=ruta_public, html=True, check_dir=False), name="public")

