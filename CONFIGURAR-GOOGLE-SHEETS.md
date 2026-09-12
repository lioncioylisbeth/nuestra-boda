# Registro de confirmaciones en Google Sheets

La invitación contiene el envío por WhatsApp y el código para registrar cada confirmación en la hoja `Confirmaciones`, incluido el número de celular y el desglose de adultos y niños.

Aplicación web activa:
`https://script.google.com/macros/s/AKfycbyaJB2eZqEIr6udAGmWQyleb9RmuE4RrZpKcCC3CCnpuGLzWL9Abd8bkq2X3gKEAsx1/exec`

1. Abre la hoja de Google Sheets **Confirmaciones · Boda Lioncio & Lisbeth**.
2. Ve a **Extensiones → Apps Script**.
3. Sustituye el contenido por `rsvp-apps-script.gs` y guarda.
4. Guarda y autoriza la secuencia de comandos cuando Google lo solicite.
5. Selecciona **Implementar → Nueva implementación → Aplicación web**.
6. Ejecutar como: **Yo**. Acceso: **Cualquier usuario**.
7. Copia la URL terminada en `/exec` y colócala en la variable `RSVP_ENDPOINT` de `index.html`.
8. Después de modificar `rsvp-apps-script.gs`, actualiza la implementación para publicar la versión nueva.

La tabla usa estas columnas: Fecha y hora, Invitado / Familia, ¿Asistirá?, Pases, Dedicatoria, Origen, Estado, Observaciones, Teléfono, Adultos y Niños.

No agregues contraseñas, claves API ni otros datos privados al repositorio.
