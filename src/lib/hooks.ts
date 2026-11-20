import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import type { Estacion } from "./types";

let cache: Estacion[] | null = null;

export function useEstaciones() {
  const [estaciones, setEstaciones] = useState<Estacion[]>(cache ?? []);
  const reload = useCallback(async () => {
    cache = await api<Estacion[]>("/estaciones");
    setEstaciones(cache);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!cache) reload().catch(() => {});
  }, [reload]);
  return { estaciones, reload };
}

export function useOcrStatus() {
  const [claude, setClaude] = useState(false);
  useEffect(() => {
    api<{ claude: boolean }>("/ocr/status")
      .then((r) => setClaude(r.claude))
      .catch(() => {});
  }, []);
  return claude;
}
