from fastapi import FastAPI

app = FastAPI(title="ChapinStock")


@app.get("/")
def inicio():
    return {"mensaje": "Hola desde ChapinStock"}


@app.get("/salud")
def salud():
    return {"estado": "ok"}
