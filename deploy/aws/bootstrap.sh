#!/usr/bin/env bash
# Preparación inicial de un Ubuntu 24.04 limpio (Lightsail). Ejecutar con: sudo bash bootstrap.sh
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
apt-get update
apt-get install -y nginx curl ca-certificates xz-utils sqlite3 certbot python3-certbot-nginx
mkdir -p /tmp/conciliacion-node
cd /tmp/conciliacion-node
curl -fsSLO https://nodejs.org/dist/latest-v22.x/SHASUMS256.txt
archive=$(awk '$2 ~ /linux-x64.tar.xz$/ {print $2}' SHASUMS256.txt)
curl -fsSLO "https://nodejs.org/dist/latest-v22.x/$archive"
grep " $archive$" SHASUMS256.txt | sha256sum -c -
tar -xJf "$archive" -C /usr/local --strip-components=1
id conciliacion >/dev/null 2>&1 || useradd --system --create-home --home-dir /opt/conciliacion --shell /usr/sbin/nologin conciliacion
# Nginx necesita atravesar /opt/conciliacion para servir dist/ (useradd lo crea con 750)
chmod 755 /opt/conciliacion
install -d -o conciliacion -g conciliacion -m 755 /opt/conciliacion/releases
install -d -o conciliacion -g conciliacion -m 750 /var/lib/conciliacion /var/lib/conciliacion/uploads
install -d -m 700 /var/backups/conciliacion
systemctl enable --now nginx
touch /var/lib/conciliacion/bootstrap-ready
