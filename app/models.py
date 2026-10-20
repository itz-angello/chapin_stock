from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

NombreNoVacio = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class ProductoNuevo(BaseModel):
    # Rechaza campos no permitidos, como stock_actual.
    model_config = ConfigDict(extra="forbid")

    nombre: NombreNoVacio
    precio: float = Field(ge=0)
    categoria_id: UUID | None = None
    stock_minimo: int = Field(default=5, ge=0)


class ProductoEdicion(BaseModel):
    # Solo se guardan los campos que lleguen en la solicitud.
    model_config = ConfigDict(extra="forbid")

    nombre: NombreNoVacio = None
    precio: float = Field(default=None, ge=0)
    categoria_id: UUID | None = None
    stock_minimo: int = Field(default=None, ge=0)


class MovimientoNuevo(BaseModel):
    # No permite enviar campos adicionales al registrar un movimiento.
    model_config = ConfigDict(extra="forbid")

    producto_id: UUID
    tipo: Literal["entrada", "salida"]
    cantidad: int = Field(gt=0)
    nota: str | None = None

    @field_validator("tipo", mode="before")
    @classmethod
    def validar_tipo(cls, tipo):
        if tipo not in ("entrada", "salida"):
            raise ValueError("El tipo debe ser 'entrada' o 'salida'.")
        return tipo

    @field_validator("cantidad", mode="before")
    @classmethod
    def validar_cantidad(cls, cantidad):
        if type(cantidad) is not int or cantidad <= 0:
            raise ValueError("La cantidad debe ser un entero mayor que 0.")
        return cantidad
