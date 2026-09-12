# Mejoras de la invitación · 12 de septiembre de 2026

## Implementado

- Portada compacta con Lioncio & Lisbeth como protagonistas, nombres completos debajo, fecha y acceso a confirmar.
- Cuatro apariencias en un menú compacto; música en la barra superior y asistente en preguntas frecuentes.
- Se conservan el velo, los anillos, la miniatura vigente y los datos de la boda. El rosario no se restaura.
- Ceremonia y recepción con mapas y descarga de calendario en la hora de Morelos.
- Dedicatorias desplegables dentro del formulario, con textos locales sin dependencia de una clave de IA.
- Celular, adultos, niños y total; resumen de respuesta y mensaje de WhatsApp ordenado.
- Solo se comunica un guardado verificado cuando la respuesta del servidor lo permite. No se reenvían automáticamente peticiones dudosas.
- Receptor Apps Script v2 con validación, prevención de fórmulas y deduplicación por identificador.

## Verificación

`node --test tests/invitation.test.cjs`: 12 pruebas aprobadas, sin red ni datos reales.

Se verificaron los encabezados de la hoja existente: A6:K6. No se cambiaron las respuestas ni el resumen de la derecha.

## Pendiente de la cuenta autorizada

Publicar la nueva versión de `rsvp-apps-script.gs` en el despliegue de Apps Script existente. La conexión de trabajo no ofrece administración de ese despliegue. Véase `CONFIGURAR-GOOGLE-SHEETS.md`.

No confundir el código subido a GitHub con la versión que ejecuta Google. La protección de duplicados del servidor requiere desplegar v2. La aplicación web reconoce respuestas válidas del receptor anterior, pero no toma una respuesta de red opaca como evidencia de guardado.

No se enviaron confirmaciones reales ni mensajes de WhatsApp durante las pruebas.

## Si se retoma el trabajo

Leer primero este registro y el estado actual de la rama `main`. No repetir cambios terminados ni restaurar el rosario. Conservar los cambios posteriores del propietario. Cualquier prueba real de registro debe coordinarse con el propietario; no crear invitados ficticios en la hoja de producción por iniciativa propia.
