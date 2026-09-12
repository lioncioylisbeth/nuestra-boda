# Registro de confirmaciones en Google Sheets

La invitación prepara el mensaje de WhatsApp e intenta registrar la respuesta en la hoja existente `Confirmaciones`. Solo muestra **Registro verificado** al recibir un JSON legible con `ok: true`. Una respuesta opaca, un error de conexión o una espera agotada **no** prueban el guardado.

El receptor v2 de este repositorio añade validación, protección frente a fórmulas y deduplicación por identificador de envío. **Actualizar GitHub no actualiza Apps Script:** hay que publicar el receptor desde la cuenta autorizada. La conexión disponible durante esta edición no permite administrar despliegues de Apps Script.

Aplicación web activa:
`https://script.google.com/macros/s/AKfycbyaJB2eZqEIr6udAGmWQyleb9RmuE4RrZpKcCC3CCnpuGLzWL9Abd8bkq2X3gKEAsx1/exec`

1. Abre la hoja de Google Sheets **Confirmaciones · Boda Lioncio & Lisbeth**, con la cuenta autorizada para administrarla (`lioncioylisbeth@gmail.com`). No crees otra hoja ni copies las respuestas.
2. Ve a **Extensiones → Apps Script**.
3. Sustituye el contenido por `rsvp-apps-script.gs` y guarda.
4. Guarda y autoriza la secuencia de comandos cuando Google lo solicite.
5. Selecciona **Implementar → Administrar implementaciones**, elige la aplicación web existente y pulsa el lápiz de edición.
6. En **Versión**, elige **Nueva versión**. Mantén **Ejecutar como: Yo** (la cuenta autorizada). El acceso a la aplicación debe permitir a los invitados enviar el formulario sin iniciar sesión. Esto no requiere hacer pública la hoja de cálculo.
7. Pulsa **Implementar**. Al actualizar el despliegue existente se conserva su URL `/exec`; no necesitas cambiar la invitación.
8. Abre la URL de la aplicación: debe mostrar `{"ok":true,"service":"rsvp-lioncio-lisbeth","version":2}`. Este control de salud no crea registros. No utilices la URL `/dev` para invitados.
9. Cuando decidas hacer una prueba real, usa un registro claramente identificado y comprueba tanto el resumen de la invitación como la fila en Sheets. No se enviaron registros reales ni mensajes de WhatsApp durante las pruebas automatizadas.

La tabla usa estas columnas: Fecha y hora, Invitado / Familia, ¿Asistirá?, Pases, Dedicatoria, Origen, Estado, Observaciones, Teléfono, Adultos y Niños.

Los encabezados siguen en A6:K6 y los datos comienzan en la fila 7. No se toca el resumen de la derecha. El identificador de envío se guarda como nota en la celda de fecha, sin agregar columnas. El celular lo declara el invitado: la página no puede leer el número de la cuenta de WhatsApp del remitente.

La aplicación evita reenvíos accidentales del mismo formulario en la misma sesión durante 24 horas. El receptor v2 reconoce un mismo identificador aunque el navegador repita la petición. No intenta fusionar personas distintas por nombre o teléfono. Una respuesta modificada es un envío distinto.

Si aparece **No pudimos verificar el guardado**, el invitado puede enviar el mensaje por WhatsApp. No se reintenta automáticamente, porque el servidor podría haber guardado los datos antes del error de red. El estado **Pendiente** de la hoja sigue siendo el estado de seguimiento de los novios, no un error de registro.

## Pruebas locales

Ejecuta `node --test tests/*.test.cjs`. Las pruebas usan una hoja simulada en memoria y no realizan peticiones de red.

Documentación oficial: [aplicaciones web de Apps Script](https://developers.google.com/apps-script/guides/web), [respuestas JSON y redirecciones](https://developers.google.com/apps-script/guides/content).

No agregues contraseñas, claves API ni otros datos privados al repositorio.
