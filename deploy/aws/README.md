# Despliegue en AWS Lightsail

Mismo esquema que Lotería Mérida: una instancia Lightsail Ubuntu 24.04, Nginx sirve `dist/` y pasa `/api/` al
servicio systemd `conciliacion` (Node 22 + tsx, usuario sin privilegios `conciliacion`), HTTPS con Let's Encrypt.

| Recurso | Valor |
|---|---|
| Región | `us-east-1` |
| Instancia | `conciliacion-pdvsa`, bundle `micro_3_0` (1 GB RAM, ~USD 7/mes) |
| IP estática | `conciliacion-pdvsa-ip` (`23.20.67.0`) |
| URL | `https://23.20.67.0.sslip.io` (DNS externo sslip.io; reemplázalo por un dominio propio cuando lo tengas) |
| Clave SSH | `%USERPROFILE%\.ssh\conciliacion-pdvsa-lightsail-rsa` (solo en el equipo de despliegue) |
| Entorno | `/etc/conciliacion.env` (JWT_SECRET generado en el servidor; `ANTHROPIC_API_KEY` opcional) |
| Datos | `/var/lib/conciliacion` (SQLite + `uploads/` con fotos de facturas y comprobantes) |
| Releases | `/opt/conciliacion/releases/*`, `/opt/conciliacion/app` apunta al activo |
| Respaldos | `/var/backups/conciliacion/<release>` (en el mismo servidor; no sustituyen un respaldo externo) |

El puerto 22 queda restringido en el firewall de Lightsail a la IP pública del equipo de despliegue.

## Generar un release

```bash
bash deploy/aws/package.sh      # en Git Bash, desde la raíz → release-<fecha>.tar.gz
```

El paquete excluye `server/data`, archivos `.env` y los documentos modelo de `public/` (PDF y Excel con datos
reales), que de otro modo quedarían públicos en la web.

## Primer despliegue

```bash
scp -i KEY deploy/aws/bootstrap.sh deploy/aws/install.sh release-*.tar.gz ubuntu@IP:/tmp/
ssh -i KEY ubuntu@IP 'sudo bash /tmp/bootstrap.sh && sudo bash /tmp/install.sh IP.sslip.io /tmp/release-XXXX.tar.gz'
```

Luego entra a `https://IP.sslip.io/registro`: **la primera cuenta registrada es la de administrador**.

## Actualizar

```bash
bash deploy/aws/package.sh
scp -i KEY deploy/aws/update.sh release-*.tar.gz ubuntu@IP:/tmp/
ssh -i KEY ubuntu@IP 'sudo bash /tmp/update.sh /tmp/release-XXXX.tar.gz v2'
```

`update.sh` instala dependencias en un directorio nuevo, detiene el servicio, respalda datos y entorno, cambia el
enlace `app`, arranca y verifica `/api/health`. Si falla, vuelve a la versión anterior.

## Operación

```bash
ssh -i "$env:USERPROFILE/.ssh/conciliacion-pdvsa-lightsail-rsa" ubuntu@23.20.67.0
sudo systemctl status conciliacion nginx
sudo journalctl -u conciliacion -n 80 --no-pager
sudo nano /etc/conciliacion.env && sudo systemctl restart conciliacion   # p. ej. activar ANTHROPIC_API_KEY
sudo certbot renew --dry-run
```

## Costos

Detener una instancia Lightsail no detiene el cobro del bundle. Para dejar de pagar, respalda
`/var/lib/conciliacion`, elimina la instancia y libera la IP estática.

## Historial

- 2026-11-20: primer despliegue, release `20261120T201657Z-inicial`. Base de datos vacía (solo las 7 estaciones
  iniciales); no se subieron datos locales ni los documentos modelo. SSH permitido solo desde la IP pública del equipo de despliegue;
  si cambia tu IP pública, actualiza la regla del puerto 22 en Lightsail.
