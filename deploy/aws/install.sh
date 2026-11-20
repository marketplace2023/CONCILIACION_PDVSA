#!/usr/bin/env bash
# Primer despliegue. Uso: sudo bash install.sh HOSTNAME RELEASE.tar.gz
set -euo pipefail
hostname=${1:?Indica el hostname público}
archive=${2:?Indica el archivo de release}
release_id="$(date -u +%Y%m%dT%H%M%SZ)-inicial"
release="/opt/conciliacion/releases/$release_id"

if [ ! -f /etc/conciliacion.env ]; then
  umask 077
  cat > /etc/conciliacion.env <<ENV
NODE_ENV=production
PORT=3001
DATA_DIR=/var/lib/conciliacion
JWT_SECRET=$(openssl rand -hex 48)
# Opcional: lectura de fotos con IA (Claude). Vacío = OCR Tesseract en el navegador.
ANTHROPIC_API_KEY=
ENV
  chown root:conciliacion /etc/conciliacion.env
  chmod 640 /etc/conciliacion.env
fi

install -d -o conciliacion -g conciliacion -m 755 "$release"
tar -xzf "$archive" -C "$release"
chown -R conciliacion:conciliacion "$release"
chmod -R a+rX "$release/dist"
cd "$release"
sudo -u conciliacion npm ci --omit=dev --no-audit --no-fund
ln -sfn "$release" /opt/conciliacion/app

cp "$release/deploy/aws/conciliacion.service" /etc/systemd/system/conciliacion.service
sed "s/HOSTNAME_PLACEHOLDER/$hostname/g" "$release/deploy/aws/nginx.conf" > /etc/nginx/sites-available/conciliacion
ln -sfn /etc/nginx/sites-available/conciliacion /etc/nginx/sites-enabled/conciliacion
if [ -L /etc/nginx/sites-enabled/default ]; then unlink /etc/nginx/sites-enabled/default; fi
nginx -t
systemctl daemon-reload
systemctl enable --now conciliacion
systemctl reload nginx
for attempt in $(seq 1 30); do
  curl -fsS http://127.0.0.1:3001/api/health >/dev/null && break
  sleep 1
done
curl -fsS http://127.0.0.1:3001/api/health
certbot --nginx -d "$hostname" --non-interactive --agree-tos --register-unsafely-without-email --redirect
systemctl enable --now certbot.timer
echo "Publicado: https://$hostname ($release_id)"
