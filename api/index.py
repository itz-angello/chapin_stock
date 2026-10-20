from fastapi import FastAPI

from app.routes.categorias import router as categorias_router
from app.routes.productos import router as productos_router

app = FastAPI(title="ChapinStock")
app.include_router(categorias_router)
app.include_router(productos_router)


@app.get("/")
def inicio():
    return {"mensaje": "Hola desde ChapinStock"}


@app.get("/salud")
def salud():
    return {"estado": "ok"}
