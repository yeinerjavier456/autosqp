# Respaldos de producción de AutosQP

La solución respalda diariamente la base MySQL y `backend/static` y valida ambos archivos. Puede funcionar únicamente con almacenamiento local o enviar además una copia cifrada a Amazon S3.

## Modalidad local, sin S3

Configura `S3_URI=""` en `/etc/autosqp-backup.conf`. En esta modalidad los archivos estáticos se guardan como instantáneas incrementales con enlaces duros: la primera copia ocupa el tamaño completo y las siguientes solo agregan el espacio de archivos nuevos o modificados. La base MySQL siempre se exporta completa.

Recomendamos adjuntar un segundo volumen EBS a la instancia, montarlo permanentemente en `/mnt/autosqp-backups` y configurar ese directorio como `BACKUP_ROOT`. Así, una falla del volumen principal no destruye al mismo tiempo la aplicación y sus copias.

Si usas `/var/backups/autosqp` en el mismo volumen raíz, podrás recuperarte de eliminaciones accidentales o daños lógicos de la base, pero no de la pérdida de la instancia o del volumen. La configuración actual conserva los últimos 7 días; vigila el espacio disponible con `df -h`.

Para listar las copias locales:

```bash
sudo ls -lah /mnt/autosqp-backups
```

La restauración local usa el mismo comando indicado más adelante. No necesita AWS CLI.

## Copia externa opcional en S3

1. Crea un bucket privado exclusivo para respaldos, con bloqueo de acceso público, versionado y cifrado habilitados.
2. Asigna a la instancia EC2 un IAM Role con permisos limitados al prefijo del respaldo: `s3:PutObject`, `s3:GetObject`, `s3:ListBucket` y `s3:HeadObject`.
3. Configura una regla de ciclo de vida en S3. Recomendado: conservar 30 respaldos diarios y 12 mensuales. Para protección adicional activa Object Lock en modo Governance.

No guardes claves de AWS en el repositorio; el IAM Role de EC2 suministra credenciales temporales automáticamente.
Si habilitas esta modalidad, instala también `awscli` y escribe el destino en `S3_URI`.

## Instalación en Ubuntu

Instala las herramientas y los archivos:

```bash
sudo apt update
sudo apt install -y mysql-client rsync
cd /home/autosqp/apps/autosqp/ops/backup
sudo bash install.sh
sudo nano /etc/autosqp-backup.conf
```

Crea un usuario MySQL dedicado y concédele acceso de lectura a la base:

```sql
CREATE USER 'autosqp_backup'@'localhost' IDENTIFIED BY 'UNA_CLAVE_LARGA_Y_UNICA';
GRANT SELECT, SHOW VIEW, TRIGGER, EVENT, LOCK TABLES ON autosqp.* TO 'autosqp_backup'@'localhost';
FLUSH PRIVILEGES;
```

Después crea `/root/.autosqp-backup.cnf`:

```ini
[client]
host=localhost
user=autosqp_backup
password=UNA_CLAVE_LARGA_Y_UNICA
```

Protege el archivo:

```bash
sudo chmod 600 /root/.autosqp-backup.cnf /etc/autosqp-backup.conf
```

Para restaurar, crea además `/root/.autosqp-restore.cnf` con un usuario MySQL autorizado para crear y escribir la base. Este archivo solo se usa al ejecutar manualmente la restauración y también debe tener permisos `600`. No reutilices el usuario de solo lectura del respaldo.

## Primera prueba obligatoria

```bash
sudo systemctl start autosqp-backup.service
sudo systemctl status autosqp-backup.service --no-pager
sudo journalctl -u autosqp-backup.service -n 100 --no-pager
sudo ls -lah /mnt/autosqp-backups
```

Activa el respaldo diario solamente después de comprobar la primera copia:

```bash
sudo systemctl enable --now autosqp-backup.timer
systemctl list-timers autosqp-backup.timer
```

El timer corre cada día alrededor de las 03:15, hora de Bogotá, y recupera una ejecución omitida si el servidor estaba apagado.

## Restauración

Lista las copias disponibles y restaura una específica:

```bash
sudo ls -1 /mnt/autosqp-backups
sudo autosqp-restore 2026-11-10_03-18-42 RESTAURAR-autosqp
```

La restauración verifica las sumas SHA-256, crea una copia preventiva del estado actual, detiene el backend, restaura MySQL y los archivos, ajusta permisos y vuelve a iniciar el servicio. Prueba una restauración en una instancia separada al menos una vez al mes; un respaldo no se considera confiable hasta comprobar que restaura correctamente.

