#!/usr/bin/env bash
# Actualización con respaldo y vuelta atrás. Uso: sudo bash update.sh RELEASE.tar.gz ETIQUETA
set -euo pipefail
umask 027
archive=${1:?Indica el archivo de release}
label=${2:?Indica una etiqueta (ej. v2)}
[[ "$label" =~ ^[A-Za-z0-9._-]{1,40}$ ]] || { echo 'Etiqueta inválida'; exit 1; }
release_id="$(date -u +%Y%m%dT%H%M%SZ)-$label"
release="/opt/conciliacion/releases/$release_id"
backup="/var/backups/conciliacion/$release_id"
previous=$(readlink -f /opt/conciliacion/app)
stopped=false

recover() {
  local result=$?
  trap - EXIT
  if [ "$result" -ne 0 ] && [ "$stopped" = true ]; then
    systemctl stop conciliacion || true
    ln -sfn "$previous" /opt/conciliacion/app
    systemctl start conciliacion || true
    echo 'La actualización falló; se restauró la versión anterior. Respaldo conservado.' >&2
  fi
  exit "$result"
}
trap recover EXIT

install -d -o conciliacion -g conciliacion -m 755 "$release"
tar -xzf "$archive" -C "$release"
chown -R conciliacion:conciliacion "$release"
chmod -R a+rX "$release/dist"
cd "$release"
sudo -u conciliacion npm ci --omit=dev --no-audit --no-fund

install -d -m 700 "$backup"
systemctl stop conciliacion   # detenido: la base sql.js queda volcada a disco
stopped=true
tar -czf "$backup/data.tar.gz" -C /var/lib conciliacion
cp -p /etc/conciliacion.env "$backup/environment"
ln -sfn "$release" /opt/conciliacion/app
cp "$release/deploy/aws/conciliacion.service" /etc/systemd/system/conciliacion.service
systemctl daemon-reload
systemctl start conciliacion
for attempt in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3001/api/health >/dev/null; then
    stopped=false
    systemctl reload nginx
    printf 'Release publicado: %s\nRespaldo: %s\n' "$release_id" "$backup"
    exit 0
  fi
  sleep 1
done
echo 'El API no respondió' >&2
exit 1
