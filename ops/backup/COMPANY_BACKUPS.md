# Copias independientes por empresa

Las copias globales anteriores siguen existiendo como recuperación del servidor.
No se pueden restaurar como si fueran de una sola empresa. El nuevo catálogo
empieza vacío hasta crear la primera copia de cada empresa.

## Despliegue en el servidor actual

```bash
cd /home/autosqp/apps/autosqp &&
git pull --ff-only origin main &&
cd frontend &&
npm ci && npm run build &&
sudo systemctl restart autosqp &&
sudo bash /home/autosqp/apps/autosqp/ops/backup/install-company-backups.sh &&
sudo nginx -t && sudo systemctl reload nginx
```

El instalador usa las rutas actuales y el usuario `autosqp`. No modifica el timer
ni los archivos de las copias globales. El servicio utiliza el entorno Python y
la conexión de la aplicación, no las credenciales MySQL de root.

1. Administrador global: Empresas Globales → Editar empresa → Copias de seguridad.
2. Configurar primero la contraseña de Cuentas en Seguridad financiera si falta.
3. Activar las copias de la empresa. La configuración se guarda inmediatamente.
4. Ingresar esa contraseña y seleccionar Crear copia ahora.
5. En la empresa: Configuración / Integraciones y API → Copias de seguridad.
   También se exige la misma contraseña al entrar. Permite descargar ZIP y restaurar.

```bash
systemctl list-timers autosqp-company-backup.timer --all
sudo systemctl start --no-block autosqp-company-backup.service
sudo journalctl -u autosqp-company-backup.service -n 50 --no-pager
```

Se ejecuta a las 03:45 de Bogotá, con hasta cinco minutos de variación, solo para
empresas habilitadas. Conserva siete días. Los ZIP son privados en
`/var/lib/autosqp-company-backups/ID_EMPRESA/`. No publiques ese directorio en Nginx.
Las descargas requieren un enlace firmado de dos minutos, después de validar la
contraseña; la descarga no carga todo el archivo en memoria del navegador.

## Alcance y protección

- Incluye registros con `company_id` y sus descendientes (usuarios, leads,
  conversaciones, créditos, compras, ventas, cuentas, recibos, documentos, etc.).
- Incluye archivos locales referenciados por esos datos, también enlaces
  absolutos cuyo camino es `/api/static/...`. No descarga recursos externos.
- No reemplaza la fila de la empresa: conserva su licencia, dominios, colores,
  contraseña de Cuentas y activación actual de copias.
- No restaura tablas compartidas sin vínculo de pertenencia ni modifica otra empresa.
- Valida empresa, claves foráneas, colisiones de ID, esquema y hashes. Si detecta
  referencias cruzadas, no intenta corregirlas automáticamente: bloquea la operación.
- Una copia con archivos locales faltantes puede descargarse para diagnóstico,
  pero no se permite restaurarla desde la interfaz.
- Antes de restaurar se crea otra copia preventiva. Se exige escribir
  `RESTAURAR EMPRESA` y volver a introducir la contraseña de Cuentas.
- Durante la restauración se bloquea el acceso normal autenticado de esa empresa;
  otras empresas pueden seguir trabajando. Evitar operaciones programadas externas
  sobre esa empresa durante la restauración. Puede ser necesario iniciar sesión otra vez.
- Se rechazan copias cuyo esquema no coincide con la versión actual. Requieren
  una migración supervisada, no desactivar la verificación.
- Cada operación conserva un estado consultable. Los trabajos se ejecutan en
  segundo plano y no dependen del tiempo de espera de Nginx.

## Capacidad y recuperación

Los archivos ZIP por empresa son copias completas. Conviven con las copias globales
y pueden consumir bastante disco. Se exige un margen libre de 2 GB, además del
espacio estimado; la restauración exige espacio adicional para temporales y la copia
preventiva. Revisa `df -h` y el registro del servicio. Si no hay espacio, la operación
falla sin intentar llenar el disco. No borres las copias globales automáticamente.

No es una protección frente a pérdida del disco/servidor: las copias están en el mismo
servidor. Descarga y guarda periódicamente ZIP fuera del servidor.

Si el proceso del servidor se interrumpe a mitad de una restauración, el estado de
la operación advertirá del fallo al volver a consultarlo. Revisa la copia preventiva
y los archivos antes de repetirla: la base de datos se revierte por transacción, pero
una interrupción del proceso puede dejar una sustitución de archivos incompleta.
No elimines manualmente marcadores `restoring` o `active-job` mientras haya un trabajo
real en curso. Los archivos temporales de restauración son privados y no se sirven
por HTTP.
