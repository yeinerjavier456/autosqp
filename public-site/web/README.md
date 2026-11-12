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
- Crédito: enlaza al formulario existente `/crm/credito?website=1`, con estilo
  oscuro/verde y tipografía del sitio, conservando todos los pasos, validaciones,
  documentos, firma y correo. El parámetro `return` solo admite `/` o `/preview/`.
  Las entradas normales al formulario conservan el tema configurado de la empresa.
- Captación: Comprar vehículo, Financiamiento, Seguros, Garantía opcional y Otro
  se registran como leads comerciales nuevos. Vender mi vehículo crea una solicitud
  de compra identificada con `[PURCHASE_REQUEST]`, enlazada al contacto y asignada
  aleatoriamente al personal activo de Compras disponible. El formulario Vender mi
  auto utiliza el mismo recorrido y guarda los datos del vehículo.
- Reactivación: ambos formularios registran un lead en estado `new` asignado
  aleatoriamente a personal activo de Reactivación Financiera de la empresa.
  Si no hay personal de ese rol, se informa el error y no se confirma un caso
  invisible. No se modifican leads con venta cerrada para trasladarlos de tablero.
- Los contactos existentes se detectan por teléfono mediante la lógica compartida
  de recontacto, sin duplicar el lead. Cada envío queda en notas con su identificador.
  Si cambia el flujo entre Comercial y Reactivación, se conserva el historial del
  contacto, se registra el traslado y se elimina la supervisión del recorrido previo.
- Contacto y boletín: `/api/public/website/contact`, con el SMTP de la empresa.
  Destinatarios: `smtp_always_recipients`, o remitente SMTP si no se configuraron.
  El correo del visitante solo se utiliza como Reply-To, nunca como destinatario.
  El envío tiene protección frente a clics repetidos, registro
  por empresa, máximo 5 mensajes por IP/hora y hasta 3 intentos por mensaje fallido.
  El registro en CRM y la solicitud de contacto se confirman en una sola transacción
  antes del SMTP. Si el correo falla, la solicitud comercial ya recibida se conserva
  y la respuesta distingue `received: true` de `sent: false`. Reintentar el correo
  no duplica leads ni solicitudes. El boletín sigue requiriendo envío SMTP correcto.
  Un envío interrumpido cuyo estado es pending no se reenvía automáticamente:
  SMTP no garantiza exactamente una entrega. Revisarlo antes de repetir.
- Los enlaces telefónicos, sociales y de WhatsApp de las demás secciones
  conservan la información del material compartido.

El boletín registra y notifica al equipo la solicitud de suscripción; no realiza
envíos automáticos semanales. No se envían correos de prueba durante el desarrollo.

## Edición por empresa

Desde **Empresas Globales > Editar empresa > Página web**, únicamente el
administrador global puede modificar textos por sección, enlaces, imágenes y
testimonios (crear, editar, ordenar o quitar). Cada empresa guarda su propio
contenido; la web obtiene el de la empresa asociada al dominio, sin aceptar un ID
de empresa enviado por el visitante. El inventario continúa viniendo del CRM.

Guardar publica los cambios sin recompilar: recargar la web los muestra al momento;
una página abierta también consulta cambios cada minuto. Hay control de versión
para rechazar guardados que sobrescribirían una edición más reciente.

Las imágenes admiten PNG, JPG y WEBP, hasta 8 MB y 16 megapíxeles. El servidor
las convierte a WEBP (máximo 2400 × 2400), sin metadatos. El contenido y las
imágenes locales referenciadas se incluyen en las copias de cada empresa.
Los textos son texto plano: no se aceptan plantillas HTML ni código ejecutable.

`public-site/content-defaults.json` mantiene el catálogo versionado. Al agregar
campos de presentación en código puede ejecutarse
`node scripts/register-website-content.cjs` desde la raíz (requiere las
dependencias del frontend). Revisar el catálogo y el resultado antes de publicar:
los identificadores de negocio y valores enviados a la API no deben convertirse
en contenido editable.

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
