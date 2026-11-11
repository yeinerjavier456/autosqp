# Web pública Autos QP

Diseño y contenido adaptados del proyecto compartido por el usuario. Se conserva
la navegación Inicio, Inventario, Financiamiento, Reactivación Financiera,
Nosotros, Contacto y FAQ. No existe la sección Carros y Camionetas ni se publican
los ZIP de código fuente/producción que incluía el prototipo.

## Integraciones

- Inventario: `/api/public/website/inventory`, paginado por clave en grupos de 100.
  Solo vehículos disponibles de la empresa resuelta por dominio. Se publican
  campos explícitos, sin costos de compra, datos financieros ni placa completa.
  Las marcas y el contador salen del inventario real. No hay vehículos de ejemplo.
- Chat: se reutiliza `frontend/src/components/PublicSalesChatbot.jsx`, incluidos
  sus endpoints y sesión existente. Asesoría inmediata, Chatea con nosotros y la
  consulta de cada vehículo abren ese bot (el último con su ID).
- Crédito: enlaza al formulario existente `/crm/credito`.
- Contacto y boletín: `/api/public/website/contact`, con el SMTP de la empresa.
  Destinatarios: `smtp_always_recipients`, o remitente SMTP si no se configuraron.
  El correo del visitante solo se utiliza como Reply-To, nunca como destinatario.
  El envío tiene confirmación real, protección frente a clics repetidos, registro
  por empresa, máximo 5 mensajes por IP/hora y hasta 3 intentos por mensaje fallido.
  Un envío interrumpido cuyo estado es pending no se reenvía automáticamente:
  SMTP no garantiza exactamente una entrega. Revisarlo antes de repetir.
- Los enlaces telefónicos, sociales y de WhatsApp de las demás secciones
  conservan la información del material compartido.

El boletín registra y notifica al equipo la solicitud de suscripción; no realiza
envíos automáticos semanales. No se envían correos de prueba durante el desarrollo.

## Compilación y publicación

Se requiere Node 20.19+ o 22.12+ y las dependencias del frontend del CRM,
porque el bot se comparte entre ambos proyectos. Se recomienda Node 22 LTS.

```bash
cd /home/autosqp/apps/autosqp/frontend
npm ci
cd ../public-site/web
npm ci
npm run check
npm run build
cd ../..
bash public-site/prepare-backend.sh
bash public-site/deploy-preview.sh
```

`deploy-preview.sh` copia únicamente `web/dist` a
`/var/www/html/autosqp-preview`, nunca src, node_modules ni credenciales. Publica
en `/preview/` sin modificar la portada de producción ni el CRM. Si el include
de preview no existe, indica dónde agregarlo sin editar automáticamente un bloque
Nginx potencialmente incorrecto.

Para publicar la portada, ejecutar `bash public-site/deploy-static-site.sh` y
comprobar que el server HTTPS utiliza `/var/www/html/autosqp-site` como root,
sin cambiar `/api/`, `/crm/api/` ni `/crm/`. La compilación usa rutas relativas
y navegación hash, compatible tanto con `/` como con `/preview/`.

El SMTP y la asociación de dominio deben configurarse desde el CRM. No se
incluyen contraseñas, claves de IA ni correos de destino suministrados por el navegador.

La tabla nueva de contacto se incluye en las copias de cada empresa. La
restauración admite explícitamente la firma del esquema inmediatamente anterior
sin esa tabla, sin desactivar la validación de otras diferencias de esquema.
