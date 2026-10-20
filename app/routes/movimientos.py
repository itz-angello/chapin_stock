from uuid import UUID

from fastapi import APIRouter, HTTPException
from postgrest.exceptions import APIError

from app.db import obtener_cliente_supabase
from app.models import MovimientoNuevo

router = APIRouter(prefix="/movimientos", tags=["movimientos"])


def traducir_error_movimiento(error: APIError) -> HTTPException:
    # La función SQL informa estos códigos cuando no puede registrar el movimiento.
    codigo = getattr(error, "message", str(error))
    errores = {
        "PRODUCTO_NO_ENCONTRADO": (404, "Producto no encontrado."),
        "STOCK_INSUFICIENTE": (409, "No hay stock suficiente para esta salida."),
        "TIPO_INVALIDO": (422, "El tipo debe ser 'entrada' o 'salida'."),
        "CANTIDAD_INVALIDA": (422, "La cantidad debe ser un entero mayor que 0."),
    }

    if codigo in errores:
        estado, mensaje = errores[codigo]
        return HTTPException(status_code=estado, detail=mensaje)
    return HTTPException(
        status_code=500,
        detail="No se pudo registrar el movimiento.",
    )


@router.post("", status_code=201)
def crear_movimiento(movimiento: MovimientoNuevo):
    try:
        respuesta = obtener_cliente_supabase().rpc(
            "registrar_movimiento",
            {
                "p_producto_id": str(movimiento.producto_id),
                "p_tipo": movimiento.tipo,
                "p_cantidad": movimiento.cantidad,
                "p_nota": movimiento.nota,
            },
        ).execute()
    except APIError as error:
        raise traducir_error_movimiento(error) from error
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail="No se pudo registrar el movimiento.",
        ) from error

    if not respuesta.data:
        raise HTTPException(
            status_code=500,
            detail="No se pudo registrar el movimiento.",
        )
    if isinstance(respuesta.data, list):
        return respuesta.data[0]
    return respuesta.data


@router.get("")
def listar_movimientos(producto_id: UUID | None = None):
    try:
        consulta = obtener_cliente_supabase().table("movimientos_stock").select("*")
        if producto_id is not None:
            consulta = consulta.eq("producto_id", str(producto_id))
        respuesta = consulta.order("creado_en", desc=True).execute()
        return respuesta.data
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail="No se pudieron consultar los movimientos.",
        ) from error
