# Alertas por lotes

El servicio `autosqp-alert-worker` evalúa las reglas activas sin depender del
navegador. Las notificaciones y `/rules/run-checks` ya no ejecutan recorridos de
leads dentro de Gunicorn. El endpoint antiguo confirma que existe una revisión
periódica; no crea una segunda ejecución ni adelanta intervalos de repetición.

Cada turno atiende una regla, hasta 100 leads ordenados por ID, y luego cede el
turno a la siguiente regla/empresa. Se hace una pausa de 250 ms entre turnos y de
2 segundos al terminar la vuelta de reglas. Al completar una regla, espera al
menos 60 segundos antes de iniciar su siguiente recorrido. No es un tiempo
garantizado de entrega: depende de la cantidad de reglas y de los lotes pendientes.

`alert_rule_progress` guarda el último ID, fecha de corte del recorrido, contador
procesado y próxima revisión. El cursor, las notificaciones, el historial y las
reasignaciones se confirman en la misma transacción. Un fallo revierte el lote;
el siguiente intento continúa desde el último lote confirmado. Los fallos tienen
una espera de 60 segundos. El historial de alertas existente conserva las reglas
de no repetición o repetición por intervalo. No se borra ni reinicia ese historial.
Las reglas no repetitivas excluyen directamente los leads ya notificados mediante
una consulta de existencia indexada. Las repetitivas excluyen los que todavía no
cumplen su intervalo, evitando recorrer y agregar historiales innecesariamente.

Un bloqueo MySQL compartido por empresa evita concurrencia entre instancias del
worker; los lotes bloquean las filas que modifican y omiten filas temporalmente
bloqueadas por otra operación (se revisan en la siguiente vuelta). Se excluyen
leads eliminados. La consulta de alertas visibles admite 100 IDs como máximo;
el navegador divide el listado en solicitudes secuenciales y cancela consultas
obsoletas al cambiar el tablero.

El proceso tiene CPUQuota=25%, MemoryHigh=256M, MemoryMax=512M y swap máximo
64M. Sus sesiones MySQL usan espera máxima de bloqueo de 3 segundos y límite de
5 segundos para consultas SELECT que admiten MAX_EXECUTION_TIME. Estos límites
no sustituyen los índices. El arranque de la API mantiene los índices existentes
`leads(company_id,deleted_at,status,id)` y
`sent_alert_logs(rule_id,lead_id,sent_at)`. El worker omite empresas restaurándose.
El cursor operativo se excluye de las copias por empresa y no modifica la firma
de esquema de las copias anteriores.
La restauración comparte el bloqueo por empresa y limpia su cursor al terminar,
sin tocar el avance de otras empresas. Los recordatorios de citas y leads también
limitan cada revisión a 100 registros pendientes y bloquean esas filas para
evitar notificaciones duplicadas durante solicitudes concurrentes.

## Instalar o actualizar

Después de actualizar Git y compilar el frontend, instala primero el servicio:
el instalador crea la tabla de progreso antes de reiniciar los workers web,
evitando intentos concurrentes de crear esa tabla. Reinicia después la API para
comprobar los índices y cargar las rutas que ya no ejecutan reglas:

```bash
sudo bash /home/autosqp/apps/autosqp/ops/alerts/install.sh
sudo systemctl restart autosqp
sudo systemctl restart autosqp-alert-worker
sudo systemctl status autosqp-alert-worker --no-pager
sudo journalctl -u autosqp-alert-worker -n 50 --no-pager
```

Es obligatorio instalar el servicio: el navegador ya no sustituye al worker.
No borres el cursor ni el historial para reintentar una operación. Para observar
el avance sin modificarlo:

```sql
SELECT p.rule_id, p.company_id, p.last_lead_id, p.processed_count,
       p.cycle_at, p.next_run_at, p.updated_at
FROM alert_rule_progress p ORDER BY p.company_id, p.rule_id;
```
