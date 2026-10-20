from uuid import UUID

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from postgrest.exceptions import APIError

from app.db import obtener_cliente_supabase

router = APIRouter(prefix="/categorias", tags=["categorías"])


class CategoriaNueva(BaseModel):
    nombre: str


def manejar_error_base_datos(error: APIError) -> HTTPException:
    # Los nombres repetidos chocan con la restricción UNIQUE de la tabla.
    if getattr(error, "code", None) == "23505":
        return HTTPException(status_code=409, detail="Ya existe una categoría con ese nombre.")
    return HTTPException(status_code=400, detail="No se pudo completar la operación.")


@router.get("")
def listar_categorias():
    try:
        respuesta = (
            obtener_cliente_supabase()
            .table("categorias")
            .select("*")
            .order("nombre")
            .execute()
        )
        return respuesta.data
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except APIError as error:
        raise manejar_error_base_datos(error) from error


@router.get("/{categoria_id}")
def obtener_categoria(categoria_id: UUID):
    try:
        respuesta = (
            obtener_cliente_supabase()
            .table("categorias")
            .select("*")
            .eq("id", str(categoria_id))
            .execute()
        )
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except APIError as error:
        raise manejar_error_base_datos(error) from error

    if not respuesta.data:
        raise HTTPException(status_code=404, detail="Categoría no encontrada.")
    return respuesta.data[0]


@router.post("", status_code=201)
def crear_categoria(categoria: CategoriaNueva):
    try:
        respuesta = (
            obtener_cliente_supabase()
            .table("categorias")
            .insert(categoria.model_dump())
            .select("*")
            .execute()
        )
        return respuesta.data[0]
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except APIError as error:
        raise manejar_error_base_datos(error) from error


@router.put("/{categoria_id}")
def actualizar_categoria(categoria_id: UUID, categoria: CategoriaNueva):
    try:
        respuesta = (
            obtener_cliente_supabase()
            .table("categorias")
            .update(categoria.model_dump())
            .eq("id", str(categoria_id))
            .select("*")
            .execute()
        )
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except APIError as error:
        raise manejar_error_base_datos(error) from error

    if not respuesta.data:
        raise HTTPException(status_code=404, detail="Categoría no encontrada.")
    return respuesta.data[0]


@router.delete("/{categoria_id}", status_code=204)
def eliminar_categoria(categoria_id: UUID):
    try:
        respuesta = (
            obtener_cliente_supabase()
            .table("categorias")
            .delete()
            .eq("id", str(categoria_id))
            .select("id")
            .execute()
        )
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except APIError as error:
        raise manejar_error_base_datos(error) from error

    if not respuesta.data:
        raise HTTPException(status_code=404, detail="Categoría no encontrada.")
