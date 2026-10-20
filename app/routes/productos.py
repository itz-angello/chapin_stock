from uuid import UUID

from fastapi import APIRouter, HTTPException
from postgrest.exceptions import APIError

from app.db import obtener_cliente_supabase
from app.models import ProductoEdicion, ProductoNuevo

router = APIRouter(prefix="/productos", tags=["productos"])


def verificar_categoria(categoria_id: UUID | None) -> None:
    """Confirma que la categoría exista antes de guardar el producto."""
    if categoria_id is None:
        return

    respuesta = (
        obtener_cliente_supabase()
        .table("categorias")
        .select("id")
        .eq("id", str(categoria_id))
        .execute()
    )
    if not respuesta.data:
        raise HTTPException(status_code=404, detail="Categoría no encontrada.")


def manejar_error_base_datos(error: APIError) -> HTTPException:
    # La llave foránea impide borrar un producto con movimientos asociados.
    if getattr(error, "code", None) == "23503":
        return HTTPException(
            status_code=409,
            detail="No se puede eliminar el producto porque tiene movimientos de stock asociados.",
        )
    return HTTPException(status_code=400, detail="No se pudo completar la operación.")


@router.get("")
def listar_productos(categoria_id: UUID | None = None):
    try:
        consulta = obtener_cliente_supabase().table("productos").select("*")
        if categoria_id is not None:
            consulta = consulta.eq("categoria_id", str(categoria_id))
        respuesta = consulta.order("nombre").execute()
        return respuesta.data
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except APIError as error:
        raise manejar_error_base_datos(error) from error


@router.get("/{producto_id}")
def obtener_producto(producto_id: UUID):
    try:
        respuesta = (
            obtener_cliente_supabase()
            .table("productos")
            .select("*")
            .eq("id", str(producto_id))
            .execute()
        )
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except APIError as error:
        raise manejar_error_base_datos(error) from error

    if not respuesta.data:
        raise HTTPException(status_code=404, detail="Producto no encontrado.")
    return respuesta.data[0]


@router.post("", status_code=201)
def crear_producto(producto: ProductoNuevo):
    try:
        verificar_categoria(producto.categoria_id)
        respuesta = (
            obtener_cliente_supabase()
            .table("productos")
            .insert(producto.model_dump(mode="json"))
            .select("*")
            .execute()
        )
        return respuesta.data[0]
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except APIError as error:
        raise manejar_error_base_datos(error) from error


@router.put("/{producto_id}")
def actualizar_producto(producto_id: UUID, producto: ProductoEdicion):
    cambios = producto.model_dump(exclude_unset=True, mode="json")
    if not cambios:
        raise HTTPException(status_code=400, detail="Envía al menos un campo para editar.")

    try:
        verificar_categoria(producto.categoria_id)
        respuesta = (
            obtener_cliente_supabase()
            .table("productos")
            .update(cambios)
            .eq("id", str(producto_id))
            .select("*")
            .execute()
        )
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except APIError as error:
        raise manejar_error_base_datos(error) from error

    if not respuesta.data:
        raise HTTPException(status_code=404, detail="Producto no encontrado.")
    return respuesta.data[0]


@router.delete("/{producto_id}", status_code=204)
def eliminar_producto(producto_id: UUID):
    try:
        respuesta = (
            obtener_cliente_supabase()
            .table("productos")
            .delete()
            .eq("id", str(producto_id))
            .select("id")
            .execute()
        )
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except APIError as error:
        raise manejar_error_base_datos(error) from error

    if not respuesta.data:
        raise HTTPException(status_code=404, detail="Producto no encontrado.")
