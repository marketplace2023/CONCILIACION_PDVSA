const TOKEN_KEY = "conciliacion.token";

export const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};
export const setToken = (t: string | null) => {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* almacenamiento no disponible */
  }
};

export class ApiError extends Error {
  status: number;
  data: Record<string, unknown>;
  constructor(status: number, data: Record<string, unknown>) {
    super(typeof data.error === "string" ? data.error : `Error ${status}`);
    this.status = status;
    this.data = data;
  }
}

let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: () => void) => {
  onUnauthorized = fn;
};

export async function api<T = unknown>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let body = init.body;
  if (init.json !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(init.json);
  }
  const res = await fetch(`/api${path}`, { ...init, headers, body });
  if (res.status === 401 && !path.startsWith("/auth/")) onUnauthorized?.();
  const ct = res.headers.get("content-type") ?? "";
  if (!res.ok) {
    const data = ct.includes("json") ? await res.json() : { error: await res.text() };
    throw new ApiError(res.status, data);
  }
  return (ct.includes("json") ? res.json() : res.blob()) as Promise<T>;
}

/** URL protegida para <img src> de archivos subidos */
export const fileUrl = (name: string | null | undefined) =>
  name ? `/api/files/${encodeURIComponent(name)}?t=${encodeURIComponent(getToken() ?? "")}` : null;

export async function download(path: string, fallbackName: string) {
  const res = await fetch(`/api${path}`, { headers: { Authorization: `Bearer ${getToken()}` } });
  if (!res.ok) throw new ApiError(res.status, { error: "No se pudo descargar el archivo" });
  const cd = res.headers.get("content-disposition") ?? "";
  const m = /filename\*=UTF-8''([^;]+)/.exec(cd) ?? /filename="([^"]+)"/.exec(cd);
  const name = m ? decodeURIComponent(m[1]) : fallbackName;
  const url = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
