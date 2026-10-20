/**
 * ChapinStock — Lógica de la Interfaz (Frontend puro en JavaScript)
 *
 * Manejo de estado, llamadas a la API mediante fetch con rutas relativas,
 * renderizado dinámico responsivo (tabla en PC, tarjetas en celular),
 * modales y notificaciones toast.
 */

// ============================================================================
// 1. ESTADO GLOBAL DE LA APLICACIÓN
// ============================================================================

let productos = [];
let categorias = [];
let movimientos = [];

// Filtros actuales para la sección de productos
let filtroBusqueda = "";
let filtroCategoria = "";

// Callback temporal para el modal de confirmación
let accionConfirmar = null;

// ============================================================================
// 2. UTILIDADES: COMUNICACIÓN CON LA API (FETCH RELATIVO)
// ============================================================================

/**
 * Función central para interactuar con la API de FastAPI.
 * Usa rutas relativas (ej. "/productos") para funcionar en local y en Vercel.
 *
 * @param {string} url - Ruta relativa del endpoint
 * @param {object} opciones - Opciones de fetch (method, body, headers, etc.)
 * @returns {Promise<any>} - Datos de respuesta en formato JSON o null
 */
async function apiFetch(url, opciones = {}) {
  const configuracion = {
    headers: {
      "Content-Type": "application/json",
      ...(opciones.headers || {}),
    },
    ...opciones,
  };

  try {
    const respuesta = await fetch(url, configuracion);

    // Respuesta 204 No Content (habitual en DELETE exitoso)
    if (respuesta.status === 204) {
      return null;
    }

    // Intentamos leer el cuerpo de la respuesta si es JSON
    const contentType = respuesta.headers.get("content-type") || "";
    let datos = null;
    if (contentType.includes("application/json")) {
      datos = await respuesta.json();
    }

    // Si la respuesta no fue exitosa (código 400, 404, 409, 422, 500, etc.)
    if (!respuesta.ok) {
      let mensajeError = "Ocurrió un error inesperado en el servidor.";

      if (datos && datos.detail) {
        if (typeof datos.detail === "string") {
          // Mensaje directo del backend en español
          mensajeError = datos.detail;
        } else if (Array.isArray(datos.detail)) {
          // Error 422 de validación de Pydantic (llega como lista)
          mensajeError = "Los datos ingresados no son válidos. Por favor revisa los campos.";
        }
      }

      throw new Error(mensajeError);
    }

    return datos;
  } catch (error) {
    // Si fue un fallo de red o el error que acabamos de lanzar
    throw error;
  }
}

// ============================================================================
// 3. UTILIDADES: FORMATO Y TOASTS
// ============================================================================

/**
 * Formatea un número al estilo de moneda guatemalteca: Q 8.50
 */
function formatearQuetzales(valor) {
  const numero = parseFloat(valor);
  if (isNaN(numero)) return "Q 0.00";
  return `Q ${numero.toFixed(2)}`;
}

/**
 * Convierte una fecha ISO (de Supabase/FastAPI) a texto legible en español.
 * Ejemplo: "20 oct 2026, 14:30"
 */
function formatearFecha(fechaIso) {
  if (!fechaIso) return "-";
  try {
    const fecha = new Date(fechaIso);
    if (isNaN(fecha.getTime())) return fechaIso;

    return fecha.toLocaleDateString("es-GT", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (e) {
    return fechaIso;
  }
}

/**
 * Muestra una notificación temporal flotante (Toast)
 * @param {string} mensaje - Texto a mostrar
 * @param {"error" | "exito" | "info"} tipo - Tipo de notificación
 */
function mostrarToast(mensaje, tipo = "info") {
  const contenedor = document.getElementById("toast-contenedor");
  if (!contenedor) return;

  const toast = document.createElement("div");
  toast.className = `toast toast-${tipo}`;

  // Icono según el tipo
  let icono = "ℹ️";
  if (tipo === "error") icono = "⚠️";
  if (tipo === "exito") icono = "✅";

  toast.innerHTML = `
    <span class="toast-icono">${icono}</span>
    <div class="toast-contenido">
      <div class="toast-mensaje">${escaparHTML(mensaje)}</div>
    </div>
    <button type="button" class="toast-cerrar" aria-label="Cerrar">&times;</button>
  `;

  // Cerrar al hacer clic en la X
  const btnCerrar = toast.querySelector(".toast-cerrar");
  btnCerrar.addEventListener("click", () => removerToast(toast));

  contenedor.appendChild(toast);

  // Auto-cerrar después de 4 segundos
  setTimeout(() => {
    removerToast(toast);
  }, 4000);
}

function removerToast(toast) {
  if (!toast || toast.classList.contains("toast-saliendo")) return;
  toast.classList.add("toast-saliendo");
  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 200);
}

/**
 * Evita inyección de código al mostrar texto ingresado por el usuario
 */
function escaparHTML(texto) {
  if (texto === null || texto === undefined) return "";
  return String(texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ============================================================================
// 4. NAVEGACIÓN POR PESTAÑAS (TABS)
// ============================================================================

function inicializarPestanas() {
  const botonesPestana = document.querySelectorAll(".pestana-btn");
  const secciones = {
    productos: document.getElementById("seccion-productos"),
    categorias: document.getElementById("seccion-categorias"),
    historial: document.getElementById("seccion-historial"),
  };

  botonesPestana.forEach((boton) => {
    boton.addEventListener("click", () => {
      const tabSeleccionada = boton.getAttribute("data-tab");

      // Actualizar estilo visual activo de botones
      botonesPestana.forEach((b) => b.classList.remove("activa"));
      boton.classList.add("activa");

      // Ocultar todas las secciones y mostrar la elegida
      Object.entries(secciones).forEach(([clave, seccion]) => {
        if (clave === tabSeleccionada) {
          seccion.classList.remove("oculto");
        } else {
          seccion.classList.add("oculto");
        }
      });

      // Si se pasa a historial, refrescamos movimientos para tener lo último
      if (tabSeleccionada === "historial") {
        cargarMovimientos();
      }
    });
  });
}

// ============================================================================
// 5. GESTIÓN DE PRODUCTOS
// ============================================================================

/**
 * Carga la lista de productos desde la API
 */
async function cargarProductos() {
  const cargando = document.getElementById("productos-cargando");
  const vacio = document.getElementById("productos-vacio");
  const tablaWrapper = document.getElementById("productos-tabla-wrapper");
  const tarjetasWrapper = document.getElementById("productos-tarjetas");

  try {
    cargando.classList.remove("oculto");
    vacio.classList.add("oculto");
    tablaWrapper.classList.add("oculto");
    tarjetasWrapper.classList.add("oculto");

    productos = await apiFetch("/productos");

    // Actualizamos el contador numérico de la pestaña
    const badgeContador = document.getElementById("badge-contador-productos");
    if (badgeContador) badgeContador.textContent = productos.length;

    renderizarProductos();
  } catch (error) {
    mostrarToast(error.message, "error");
  } finally {
    cargando.classList.add("oculto");
  }
}

/**
 * Renderiza los productos aplicando filtros de búsqueda y categoría
 */
function renderizarProductos() {
  const vacio = document.getElementById("productos-vacio");
  const tablaWrapper = document.getElementById("productos-tabla-wrapper");
  const tablaCuerpo = document.getElementById("productos-tabla-cuerpo");
  const tarjetasWrapper = document.getElementById("productos-tarjetas");

  // Filtrado reactivo (comparando ID de categoría como texto)
  const productosFiltrados = productos.filter((prod) => {
    const coincideTexto = prod.nombre.toLowerCase().includes(filtroBusqueda.toLowerCase());
    const coincideCategoria = filtroCategoria
      ? String(prod.categoria_id || "").trim().toLowerCase() === String(filtroCategoria).trim().toLowerCase()
      : true;
    return coincideTexto && coincideCategoria;
  });

  if (productosFiltrados.length === 0) {
    tablaWrapper.classList.add("oculto");
    tarjetasWrapper.classList.add("oculto");
    vacio.classList.remove("oculto");
    return;
  }

  vacio.classList.add("oculto");
  tablaWrapper.classList.remove("oculto");
  tarjetasWrapper.classList.remove("oculto");

  // Mapa rápido de ID categoría (como texto normalizado) -> Nombre categoría
  const categoriasMap = new Map(
    categorias.map((c) => [String(c.id).trim().toLowerCase(), c.nombre])
  );

  // 1. Renderizado en TABLA (Vista Computadora / Desktop)
  tablaCuerpo.innerHTML = productosFiltrados
    .map((prod) => {
      const catIdTexto = prod.categoria_id ? String(prod.categoria_id).trim().toLowerCase() : "";
      const nombreCat = (catIdTexto && categoriasMap.has(catIdTexto))
        ? categoriasMap.get(catIdTexto)
        : "Sin categoría";
      const estadoHTML = obtenerBadgeEstado(prod.stock_actual, prod.stock_minimo);

      return `
        <tr data-id="${prod.id}">
          <td>
            <strong>${escaparHTML(prod.nombre)}</strong>
          </td>
          <td>
            <span class="badge badge-neutro">${escaparHTML(nombreCat)}</span>
          </td>
          <td class="texto-derecha precio-texto">
            ${formatearQuetzales(prod.precio)}
          </td>
          <td class="texto-centro">
            <strong>${prod.stock_actual}</strong>
            <span class="texto-secundario" style="font-size: 0.75rem;">(mín: ${prod.stock_minimo})</span>
          </td>
          <td class="texto-centro">
            ${estadoHTML}
          </td>
          <td class="texto-centro">
            <div class="acciones-grupo">
              <button class="btn btn-sm btn-entrada" onclick="abrirModalMovimiento('entrada', '${prod.id}')" title="Registrar compra o entrada">
                + Entrada
              </button>
              <button class="btn btn-sm btn-salida" onclick="abrirModalMovimiento('salida', '${prod.id}')" title="Registrar venta o salida">
                - Salida
              </button>
            </div>
          </td>
          <td class="texto-derecha">
            <div class="acciones-grupo">
              <button class="btn btn-sm btn-editar" onclick="prepararEdicionProducto('${prod.id}')" title="Editar datos">
                Editar
              </button>
              <button class="btn btn-sm btn-eliminar" onclick="solicitarEliminarProducto('${prod.id}')" title="Eliminar producto">
                Eliminar
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  // 2. Renderizado en TARJETAS (Vista Celular / Móvil)
  tarjetasWrapper.innerHTML = productosFiltrados
    .map((prod) => {
      const catIdTexto = prod.categoria_id ? String(prod.categoria_id).trim().toLowerCase() : "";
      const nombreCat = (catIdTexto && categoriasMap.has(catIdTexto))
        ? categoriasMap.get(catIdTexto)
        : "Sin categoría";
      const estadoHTML = obtenerBadgeEstado(prod.stock_actual, prod.stock_minimo);

      return `
        <div class="producto-card" data-id="${prod.id}">
          <div class="producto-card-cabecera">
            <div>
              <h3 class="producto-card-titulo">${escaparHTML(prod.nombre)}</h3>
              <p class="producto-card-categoria">🏷️ ${escaparHTML(nombreCat)}</p>
            </div>
            <div>
              ${estadoHTML}
            </div>
          </div>

          <div class="producto-card-info">
            <div class="info-item">
              <span class="info-item-etiqueta">Precio</span>
              <span class="info-item-valor">${formatearQuetzales(prod.precio)}</span>
            </div>
            <div class="info-item">
              <span class="info-item-etiqueta">Stock actual</span>
              <span class="info-item-valor">${prod.stock_actual} <small style="font-size: 0.7rem; color: var(--color-texto-secundario); font-weight: normal;">(mín: ${prod.stock_minimo})</small></span>
            </div>
          </div>

          <div class="producto-card-acciones">
            <button class="btn btn-entrada" onclick="abrirModalMovimiento('entrada', '${prod.id}')">
              + Entrada
            </button>
            <button class="btn btn-salida" onclick="abrirModalMovimiento('salida', '${prod.id}')">
              - Salida
            </button>
          </div>

          <div class="producto-card-acciones-secundarias">
            <button class="btn btn-editar" onclick="prepararEdicionProducto('${prod.id}')">
              ✏️ Editar
            </button>
            <button class="btn btn-eliminar" onclick="solicitarEliminarProducto('${prod.id}')">
              🗑️ Eliminar
            </button>
          </div>
        </div>
      `;
    })
    .join("");
}

/**
 * Retorna el Badge de estado según la regla de negocio:
 * - stock_actual == 0 -> Etiqueta roja "Agotado"
 * - stock_actual <= stock_minimo -> Etiqueta roja "Poco stock"
 * - En caso contrario -> Etiqueta verde "Disponible"
 */
function obtenerBadgeEstado(stockActual, stockMinimo) {
  if (stockActual === 0) {
    return `<span class="badge badge-agotado">Agotado</span>`;
  }
  if (stockActual <= stockMinimo) {
    return `<span class="badge badge-alerta">Poco stock</span>`;
  }
  return `<span class="badge badge-disponible">Disponible</span>`;
}

// ============================================================================
// 6. FORMULARIO: CREAR Y EDITAR PRODUCTO
// ============================================================================

function inicializarFormularioProducto() {
  const btnNuevo = document.getElementById("btn-nuevo-producto");
  const modal = document.getElementById("modal-producto");
  const btnCerrar = document.getElementById("btn-cerrar-modal-producto");
  const btnCancelar = document.getElementById("btn-cancelar-producto");
  const form = document.getElementById("form-producto");

  // Abrir modal para crear
  btnNuevo.addEventListener("click", () => {
    abrirModalProductoCrear();
  });

  // Cerrar modal
  const cerrar = () => modal.classList.add("oculto");
  btnCerrar.addEventListener("click", cerrar);
  btnCancelar.addEventListener("click", cerrar);

  // Enviar formulario (Crear o Editar)
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const id = document.getElementById("producto-id").value;
    const nombre = document.getElementById("producto-nombre").value.trim();
    const precio = parseFloat(document.getElementById("producto-precio").value);
    const categoriaId = document.getElementById("producto-categoria").value || null;
    const stockMinimoValor = document.getElementById("producto-stock-minimo").value;
    const stockMinimo = stockMinimoValor !== "" ? parseInt(stockMinimoValor, 10) : 5;

    if (!nombre) {
      mostrarToast("El nombre del producto no puede estar vacío.", "error");
      return;
    }

    if (isNaN(precio) || precio < 0) {
      mostrarToast("Ingresa un precio válido mayor o igual a 0.", "error");
      return;
    }

    const btnGuardar = document.getElementById("btn-guardar-producto");
    btnGuardar.disabled = true;

    try {
      if (id) {
        // MODO EDICIÓN (PUT /productos/{id})
        // OJO: NUNCA enviar stock_actual, según el acuerdo con el backend
        const cargaEdicion = {
          nombre,
          precio,
          categoria_id: categoriaId,
          stock_minimo: stockMinimo,
        };

        await apiFetch(`/productos/${id}`, {
          method: "PUT",
          body: JSON.stringify(cargaEdicion),
        });

        mostrarToast("Producto actualizado exitosamente.", "exito");
      } else {
        // MODO CREACIÓN (POST /productos)
        const cargaNuevo = {
          nombre,
          precio,
          categoria_id: categoriaId,
          stock_minimo: stockMinimo,
        };

        await apiFetch("/productos", {
          method: "POST",
          body: JSON.stringify(cargaNuevo),
        });

        mostrarToast("Producto creado exitosamente.", "exito");
      }

      modal.classList.add("oculto");
      await cargarProductos();
    } catch (error) {
      mostrarToast(error.message, "error");
    } finally {
      btnGuardar.disabled = false;
    }
  });
}

function abrirModalProductoCrear() {
  const modal = document.getElementById("modal-producto");
  const titulo = document.getElementById("modal-producto-titulo");
  const form = document.getElementById("form-producto");

  titulo.textContent = "Nuevo producto";
  form.reset();
  document.getElementById("producto-id").value = "";
  document.getElementById("producto-stock-minimo").value = "5";

  // Asegurar lista de categorías actualizada en el desplegable
  poblarSelectCategorias("producto-categoria");

  modal.classList.remove("oculto");
  document.getElementById("producto-nombre").focus();
}

function prepararEdicionProducto(id) {
  const prod = productos.find((p) => String(p.id).trim().toLowerCase() === String(id).trim().toLowerCase());
  if (!prod) return;

  const modal = document.getElementById("modal-producto");
  const titulo = document.getElementById("modal-producto-titulo");

  titulo.textContent = "Editar producto";
  document.getElementById("producto-id").value = prod.id;
  document.getElementById("producto-nombre").value = prod.nombre;
  document.getElementById("producto-precio").value = prod.precio;
  document.getElementById("producto-stock-minimo").value = prod.stock_minimo;

  poblarSelectCategorias("producto-categoria", prod.categoria_id);

  modal.classList.remove("oculto");
  document.getElementById("producto-nombre").focus();
}

function solicitarEliminarProducto(id) {
  const prod = productos.find((p) => String(p.id).trim().toLowerCase() === String(id).trim().toLowerCase());
  const nombre = prod ? prod.nombre : "este producto";

  abrirModalConfirmar(
    `¿Estás seguro de que deseas eliminar "${escaparHTML(nombre)}"? Esta acción no se puede deshacer.`,
    async () => {
      try {
        await apiFetch(`/productos/${id}`, { method: "DELETE" });
        mostrarToast("Producto eliminado.", "exito");
        await cargarProductos();
      } catch (error) {
        mostrarToast(error.message, "error");
      }
    }
  );
}

// ============================================================================
// 7. REGISTRO DE MOVIMIENTOS (ENTRADAS Y SALIDAS)
// ============================================================================

function inicializarModalMovimiento() {
  const modal = document.getElementById("modal-movimiento");
  const btnCerrar = document.getElementById("btn-cerrar-modal-movimiento");
  const btnCancelar = document.getElementById("btn-cancelar-movimiento");
  const form = document.getElementById("form-movimiento");

  const cerrar = () => modal.classList.add("oculto");
  btnCerrar.addEventListener("click", cerrar);
  btnCancelar.addEventListener("click", cerrar);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const productoId = document.getElementById("movimiento-producto-id").value;
    const tipo = document.getElementById("movimiento-tipo").value; // "entrada" o "salida"
    const cantidad = parseInt(document.getElementById("movimiento-cantidad").value, 10);
    const nota = document.getElementById("movimiento-nota").value.trim() || null;

    if (isNaN(cantidad) || cantidad <= 0) {
      mostrarToast("La cantidad debe ser un número entero mayor que 0.", "error");
      return;
    }

    const btnConfirmar = document.getElementById("btn-confirmar-movimiento");
    btnConfirmar.disabled = true;

    try {
      const cargaMovimiento = {
        producto_id: productoId,
        tipo: tipo,
        cantidad: cantidad,
        nota: nota,
      };

      await apiFetch("/movimientos", {
        method: "POST",
        body: JSON.stringify(cargaMovimiento),
      });

      mostrarToast(
        tipo === "entrada"
          ? "Entrada de stock registrada correctamente."
          : "Salida de stock registrada correctamente.",
        "exito"
      );

      modal.classList.add("oculto");

      // Actualizamos productos (el stock_actual cambió) y movimientos
      await cargarProductos();
      await cargarMovimientos();
    } catch (error) {
      mostrarToast(error.message, "error");
    } finally {
      btnConfirmar.disabled = false;
    }
  });
}

function abrirModalMovimiento(tipo, productoId) {
  const prod = productos.find((p) => String(p.id).trim().toLowerCase() === String(productoId).trim().toLowerCase());
  if (!prod) return;

  const modal = document.getElementById("modal-movimiento");
  const titulo = document.getElementById("modal-movimiento-titulo");
  const btnConfirmar = document.getElementById("btn-confirmar-movimiento");

  document.getElementById("movimiento-producto-id").value = prod.id;
  document.getElementById("movimiento-tipo").value = tipo;
  document.getElementById("movimiento-producto-nombre").textContent = prod.nombre;

  const stockBadge = document.getElementById("movimiento-producto-stock");
  stockBadge.textContent = `${prod.stock_actual} unidades`;
  stockBadge.className = prod.stock_actual <= prod.stock_minimo ? "badge badge-alerta" : "badge badge-disponible";

  document.getElementById("movimiento-cantidad").value = "";
  document.getElementById("movimiento-nota").value = "";

  if (tipo === "entrada") {
    titulo.textContent = "Registrar Entrada de Stock (Compra)";
    btnConfirmar.className = "btn btn-exito";
    btnConfirmar.textContent = "Registrar Entrada";
  } else {
    titulo.textContent = "Registrar Salida de Stock (Venta)";
    btnConfirmar.className = "btn btn-peligro";
    btnConfirmar.textContent = "Registrar Salida";
  }

  modal.classList.remove("oculto");
  document.getElementById("movimiento-cantidad").focus();
}

// ============================================================================
// 8. GESTIÓN DE CATEGORÍAS
// ============================================================================

/**
 * Carga las categorías desde la API
 */
async function cargarCategorias() {
  const cargando = document.getElementById("categorias-cargando");
  const vacio = document.getElementById("categorias-vacio");
  const lista = document.getElementById("categorias-lista");

  try {
    cargando.classList.remove("oculto");
    vacio.classList.add("oculto");
    lista.classList.add("oculto");

    categorias = await apiFetch("/categorias");

    // Actualizamos el contador numérico de la pestaña
    const badgeContador = document.getElementById("badge-contador-categorias");
    if (badgeContador) badgeContador.textContent = categorias.length;

    renderizarCategorias();
    poblarFiltroCategorias();

    // Si ya existen productos cargados en memoria, los volvemos a dibujar
    // para que muestren los nombres de las categorías recién cargadas.
    if (productos && productos.length > 0) {
      renderizarProductos();
    }
  } catch (error) {
    mostrarToast(error.message, "error");
  } finally {
    cargando.classList.add("oculto");
  }
}

/**
 * Renderiza la lista de categorías
 */
function renderizarCategorias() {
  const vacio = document.getElementById("categorias-vacio");
  const lista = document.getElementById("categorias-lista");

  if (categorias.length === 0) {
    lista.classList.add("oculto");
    vacio.classList.remove("oculto");
    return;
  }

  vacio.classList.add("oculto");
  lista.classList.remove("oculto");

  lista.innerHTML = categorias
    .map((cat) => {
      return `
        <div class="categoria-card" data-id="${cat.id}">
          <div class="categoria-card-info">
            <div class="categoria-icono">🏷️</div>
            <span class="categoria-nombre">${escaparHTML(cat.nombre)}</span>
          </div>
          <button class="btn btn-sm btn-eliminar" onclick="solicitarEliminarCategoria('${cat.id}')" title="Eliminar categoría">
            Eliminar
          </button>
        </div>
      `;
    })
    .join("");
}

function inicializarFormularioCategoria() {
  const form = document.getElementById("form-crear-categoria");
  const input = document.getElementById("input-nombre-categoria");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nombre = input.value.trim();

    if (!nombre) {
      mostrarToast("Ingresa un nombre para la categoría.", "error");
      return;
    }

    try {
      await apiFetch("/categorias", {
        method: "POST",
        body: JSON.stringify({ nombre }),
      });

      mostrarToast(`Categoría "${nombre}" agregada.`, "exito");
      input.value = "";
      await cargarCategorias();
      // Refrescamos productos si cambiaron o para mantener selectores sincronizados
      renderizarProductos();
    } catch (error) {
      mostrarToast(error.message, "error");
    }
  });
}

function solicitarEliminarCategoria(id) {
  const cat = categorias.find((c) => String(c.id).trim().toLowerCase() === String(id).trim().toLowerCase());
  const nombre = cat ? cat.nombre : "esta categoría";

  abrirModalConfirmar(
    `¿Estás seguro de que deseas eliminar la categoría "${escaparHTML(nombre)}"?`,
    async () => {
      try {
        await apiFetch(`/categorias/${id}`, { method: "DELETE" });
        mostrarToast("Categoría eliminada.", "exito");
        await cargarCategorias();
        await cargarProductos();
      } catch (error) {
        mostrarToast(error.message, "error");
      }
    }
  );
}

/**
 * Rellena un elemento <select> con las categorías disponibles
 */
function poblarSelectCategorias(selectId, seleccionadaId = null) {
  const select = document.getElementById(selectId);
  if (!select) return;

  const idSeleccionadaTexto = seleccionadaId ? String(seleccionadaId).trim().toLowerCase() : null;

  select.innerHTML = '<option value="">-- Sin categoría --</option>';
  categorias.forEach((cat) => {
    const opt = document.createElement("option");
    opt.value = cat.id;
    opt.textContent = cat.nombre;
    if (idSeleccionadaTexto && String(cat.id).trim().toLowerCase() === idSeleccionadaTexto) {
      opt.selected = true;
    }
    select.appendChild(opt);
  });
}

/**
 * Llena el selector de filtro por categoría en la barra de productos
 */
function poblarFiltroCategorias() {
  const select = document.getElementById("filtro-categoria-producto");
  if (!select) return;

  const valorActual = select.value;
  select.innerHTML = '<option value="">Todas las categorías</option>';

  categorias.forEach((cat) => {
    const opt = document.createElement("option");
    opt.value = cat.id;
    opt.textContent = cat.nombre;
    if (valorActual && cat.id === valorActual) {
      opt.selected = true;
    }
    select.appendChild(opt);
  });
}

// ============================================================================
// 9. HISTORIAL DE MOVIMIENTOS
// ============================================================================

/**
 * Carga el historial de movimientos de inventario
 */
async function cargarMovimientos() {
  const cargando = document.getElementById("historial-cargando");
  const vacio = document.getElementById("historial-vacio");
  const tablaWrapper = document.getElementById("historial-tabla-wrapper");
  const tarjetasWrapper = document.getElementById("historial-tarjetas");

  try {
    cargando.classList.remove("oculto");
    vacio.classList.add("oculto");
    tablaWrapper.classList.add("oculto");
    tarjetasWrapper.classList.add("oculto");

    movimientos = await apiFetch("/movimientos");
    renderizarHistorial();
  } catch (error) {
    mostrarToast(error.message, "error");
  } finally {
    cargando.classList.add("oculto");
  }
}

/**
 * Renderiza los movimientos del más reciente al más antiguo
 */
function renderizarHistorial() {
  const vacio = document.getElementById("historial-vacio");
  const tablaWrapper = document.getElementById("historial-tabla-wrapper");
  const tablaCuerpo = document.getElementById("historial-tabla-cuerpo");
  const tarjetasWrapper = document.getElementById("historial-tarjetas");

  if (movimientos.length === 0) {
    tablaWrapper.classList.add("oculto");
    tarjetasWrapper.classList.add("oculto");
    vacio.classList.remove("oculto");
    return;
  }

  vacio.classList.add("oculto");
  tablaWrapper.classList.remove("oculto");
  tarjetasWrapper.classList.remove("oculto");

  // Mapa rápido de ID producto (como texto normalizado) -> Nombre producto
  const productosMap = new Map(
    productos.map((p) => [String(p.id).trim().toLowerCase(), p.nombre])
  );

  // 1. Vista TABLA (Escritorio)
  tablaCuerpo.innerHTML = movimientos
    .map((mov) => {
      const prodIdTexto = mov.producto_id ? String(mov.producto_id).trim().toLowerCase() : "";
      const nombreProducto = (prodIdTexto && productosMap.has(prodIdTexto))
        ? productosMap.get(prodIdTexto)
        : "Producto no encontrado";
      const esEntrada = mov.tipo === "entrada";
      const badgeTipo = esEntrada
        ? `<span class="badge badge-entrada">Entrada</span>`
        : `<span class="badge badge-salida">Salida</span>`;

      const cantidadHTML = esEntrada
        ? `<span class="cantidad-positiva">+${mov.cantidad}</span>`
        : `<span class="cantidad-negativa">-${mov.cantidad}</span>`;

      const notaHTML = mov.nota
        ? escaparHTML(mov.nota)
        : `<span class="texto-secundario" style="font-style: italic;">Sin nota</span>`;

      return `
        <tr>
          <td>${formatearFecha(mov.creado_en)}</td>
          <td><strong>${escaparHTML(nombreProducto)}</strong></td>
          <td class="texto-centro">${badgeTipo}</td>
          <td class="texto-centro">${cantidadHTML}</td>
          <td>${notaHTML}</td>
        </tr>
      `;
    })
    .join("");

  // 2. Vista TARJETAS (Móvil)
  tarjetasWrapper.innerHTML = movimientos
    .map((mov) => {
      const prodIdTexto = mov.producto_id ? String(mov.producto_id).trim().toLowerCase() : "";
      const nombreProducto = (prodIdTexto && productosMap.has(prodIdTexto))
        ? productosMap.get(prodIdTexto)
        : "Producto no encontrado";
      const esEntrada = mov.tipo === "entrada";
      const badgeTipo = esEntrada
        ? `<span class="badge badge-entrada">Entrada</span>`
        : `<span class="badge badge-salida">Salida</span>`;

      const cantidadHTML = esEntrada
        ? `<span class="cantidad-positiva">+${mov.cantidad} unidades</span>`
        : `<span class="cantidad-negativa">-${mov.cantidad} unidades</span>`;

      const notaHTML = mov.nota
        ? `<span class="movimiento-nota-texto">"${escaparHTML(mov.nota)}"</span>`
        : `<span class="movimiento-nota-texto">Sin nota</span>`;

      return `
        <div class="movimiento-card">
          <div class="movimiento-card-fila-sup">
            <div>
              <div class="movimiento-card-producto">${escaparHTML(nombreProducto)}</div>
              <div class="movimiento-card-fecha">${formatearFecha(mov.creado_en)}</div>
            </div>
            <div>
              ${badgeTipo}
            </div>
          </div>
          <div class="movimiento-card-fila-inf">
            <div>${notaHTML}</div>
            <div>${cantidadHTML}</div>
          </div>
        </div>
      `;
    })
    .join("");
}

// ============================================================================
// 10. MODAL DE CONFIRMACIÓN
// ============================================================================

function inicializarModalConfirmar() {
  const modal = document.getElementById("modal-confirmar");
  const btnCancelar = document.getElementById("btn-cancelar-confirmar");
  const btnCerrar = document.getElementById("btn-cerrar-modal-confirmar");
  const btnAceptar = document.getElementById("btn-aceptar-confirmar");

  const cerrar = () => {
    modal.classList.add("oculto");
    accionConfirmar = null;
  };

  btnCancelar.addEventListener("click", cerrar);
  btnCerrar.addEventListener("click", cerrar);

  btnAceptar.addEventListener("click", async () => {
    if (typeof accionConfirmar === "function") {
      const fn = accionConfirmar;
      cerrar();
      await fn();
    } else {
      cerrar();
    }
  });
}

function abrirModalConfirmar(mensaje, callbackConfirmar) {
  const modal = document.getElementById("modal-confirmar");
  const mensajeEl = document.getElementById("modal-confirmar-mensaje");

  mensajeEl.innerHTML = mensaje;
  accionConfirmar = callbackConfirmar;
  modal.classList.remove("oculto");
}

// ============================================================================
// 11. FILTROS Y BÚSQUEDA
// ============================================================================

function inicializarFiltros() {
  const inputBusqueda = document.getElementById("filtro-buscar-producto");
  const selectCategoria = document.getElementById("filtro-categoria-producto");

  inputBusqueda.addEventListener("input", (e) => {
    filtroBusqueda = e.target.value.trim();
    renderizarProductos();
  });

  selectCategoria.addEventListener("change", (e) => {
    filtroCategoria = e.target.value;
    renderizarProductos();
  });
}

// ============================================================================
// 12. INICIALIZACIÓN GLOBAL DE LA APLICACIÓN
// ============================================================================

document.addEventListener("DOMContentLoaded", async () => {
  // Configurar listeners de interfaz
  inicializarPestanas();
  inicializarFormularioProducto();
  inicializarModalMovimiento();
  inicializarFormularioCategoria();
  inicializarModalConfirmar();
  inicializarFiltros();

  // Cerrar modales con la tecla Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      document.querySelectorAll(".modal-fondo").forEach((modal) => {
        modal.classList.add("oculto");
      });
    }
  });

  // Carga inicial secuencial: cargamos primero las categorías para que los
  // productos puedan resolver sus nombres de categoría al renderizarse.
  try {
    await cargarCategorias();
    await cargarProductos();
  } catch (error) {
    console.error("Error en la carga inicial:", error);
  }
});

