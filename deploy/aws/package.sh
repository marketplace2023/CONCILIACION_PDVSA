#!/usr/bin/env bash
# Compila y genera el archivo de release. Uso (desde la raíz, Git Bash): bash deploy/aws/package.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
npm run build
out="release-$(date -u +%Y%m%dT%H%M%SZ).tar.gz"
# Fuera del release: datos locales, secretos y los documentos modelo de public/
# (facturas, comprobantes y el Excel con datos reales: no deben quedar públicos en la web).
tar --exclude='server/data' --exclude='.env' --exclude='*.env' \
    --exclude='dist/*.pdf' --exclude='dist/*.xlsx' \
    -czf "$out" dist server package.json package-lock.json deploy/aws
echo "$out"
