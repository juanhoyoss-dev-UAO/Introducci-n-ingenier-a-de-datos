import {
  MAX_RECEPTION_XLSX_BYTES,
} from "./excel-reception-parser";
import { ApiError } from "./errors";

const ALLOWED_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/octet-stream",
]);

export async function readReceptionUpload(request: Request) {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_RECEPTION_XLSX_BYTES + 65_536) {
    throw new ApiError(413, "FILE_TOO_LARGE", "El archivo supera el máximo permitido de 1 MB.");
  }
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new ApiError(400, "INVALID_FORM_DATA", "No se pudo leer el archivo enviado.");
  }
  const entry = form.get("archivo");
  if (!(entry instanceof File)) {
    throw new ApiError(400, "MISSING_FILE", "Selecciona un archivo XLSX.");
  }
  if (!entry.name.toLowerCase().endsWith(".xlsx")) {
    throw new ApiError(400, "INVALID_FILE_EXTENSION", "El archivo debe tener extensión .xlsx.");
  }
  if (entry.type && !ALLOWED_MIME_TYPES.has(entry.type)) {
    throw new ApiError(400, "INVALID_FILE_TYPE", "El tipo de archivo no corresponde a XLSX.");
  }
  if (entry.size <= 0 || entry.size > MAX_RECEPTION_XLSX_BYTES) {
    throw new ApiError(413, "FILE_TOO_LARGE", "El archivo debe tener contenido y no superar 1 MB.");
  }
  return { fileName: entry.name, bytes: Buffer.from(await entry.arrayBuffer()) };
}
