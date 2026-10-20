import os

from dotenv import load_dotenv
from supabase import Client, create_client

cliente_supabase = None


def obtener_cliente_supabase() -> Client:
    """Crea el cliente cuando una ruta lo necesita por primera vez."""
    global cliente_supabase

    if cliente_supabase is None:
        load_dotenv()
        url = os.getenv("SUPABASE_URL")
        clave = os.getenv("SUPABASE_KEY")

        if not url or not clave:
            raise RuntimeError(
                "Configura SUPABASE_URL y SUPABASE_KEY en el archivo .env."
            )

        cliente_supabase = create_client(url, clave)

    return cliente_supabase
