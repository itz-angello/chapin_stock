from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

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
