# Conciliación PDVSA · CORPOMÉRIDA

App web responsive para cargar facturas PDVSA y sus comprobantes de pago (Banco del Tesoro), leer los datos con OCR, guardarlos en una base de datos y descargar la conciliación en Excel con el formato de `CONCILIACIÓN PDVSA ACTUALIZADO AL 06-11-2026.xlsx`.

## Arranque

```bash
npm install
cp .env.example .env      # opcional: ANTHROPIC_API_KEY para lectura con IA
npm run dev               # API en :3001 + web en :5173
```

Abre http://localhost:5173 y **regístrate: el primer usuario queda como administrador**. Los siguientes se registran como *operador*.

Para usar la cámara desde el teléfono en la misma red, entra con la IP que muestra Vite (`http://192.168.x.x:5173`). El navegador solo permite la cámara en vivo con HTTPS o en `localhost`; por HTTP el botón **Cámara del dispositivo** abre igual la cámara nativa del móvil.

Producción: `npm run build && npm start` (Express sirve `dist/` y el API en el mismo puerto).

## Módulos

| Página | Qué hace |
|---|---|
| **Escanear factura** | Foto o archivo de la factura y del comprobante (cámara en vivo, galería o PDF). Lee los datos al subirlos, marca qué campos vinieron del OCR, avisa si el pago no coincide con el total y lo **guarda automáticamente** cuando factura + pago son válidos (se puede desactivar). |
| **Importar PDF** | Arrastra los PDF de cada estación (`ALBALAGO_MODELO.pdf`, etc.). Empareja cada factura con su comprobante leyendo el texto del PDF (sin errores de OCR), detecta pagos dobles o parciales y guarda todo de una vez con las imágenes de cada página. Si un registro ya existe, lo omite. |
| **Registros** | Búsqueda, filtros (estación, estado, rango de emisión y de pago), edición, ver la foto de la factura y del comprobante, eliminar y **Descargar Excel** con los filtros aplicados. Se muestra como tabla en escritorio y como tarjetas en el móvil. |
| **Administración** (admin) | Crear usuarios, cambiar el rol, activar o desactivar, cambiar la contraseña; gestionar estaciones y las palabras clave que reconoce el OCR; bitácora de actividad. |
| **Mi perfil** | Cambiar el nombre y la contraseña. |

## Lectura de datos (OCR)

1. **PDF con texto** (los comprobantes de Banco del Tesoro): se lee el texto exacto.
2. **IA (Claude, opcional)**: si `ANTHROPIC_API_KEY` está en `.env`, las fotos se envían a `claude-opus-5-5` para extraer los datos. Es mucho más precisa con fotos torcidas, sellos y manchas. Cada lectura consume la API de Anthropic.
3. **Tesseract.js (por defecto, gratis)**: corre en el navegador. La primera vez descarga el modelo de español (~15 MB) desde el CDN de jsDelivr.

Siempre revisa los campos antes de guardar si la foto es de mala calidad.

## Datos

- Base SQLite en `server/data/conciliacion.sqlite` (motor `sql.js`, no requiere compilación en Windows).
- Imágenes en `server/data/uploads/`; solo se sirven a usuarios con sesión iniciada.
- Respalda la carpeta `server/data/` completa.
- Duplicados: no se permite la misma factura con la misma referencia de pago. Una factura con varios pagos genera una fila por pago, igual que en el Excel modelo.

## Excel

Mismo formato que el modelo: título en A1, rango de fechas de pago en A2, encabezados grises con filtro en la fila 4 y datos desde la fila 5 (Fecha de Emisión, Código, Estación, N° Factura, Pago Bs., Fecha de Pago, Referencia, Observaciones), más una fila de TOTAL. Las referencias que empiezan por 0 se exportan como texto para no perder el cero.

## Stack

React 19 + Vite + Tailwind v4 · react-icons · componentes de **Aceternity UI** (Spotlight, File Upload, Sidebar, Background Gradient) y **Magic UI** (Shimmer Button, Number Ticker, Border Beam, Magic Card, Blur Fade, Animated Grid Pattern) en `src/components/` · motion · pdf.js · tesseract.js · Express 5 + JWT + bcrypt + exceljs.
