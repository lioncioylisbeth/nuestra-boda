# Mejoras de la invitación · 12 de septiembre de 2026

## Estado vigente · 13 de septiembre de 2026 · recuperación del registro

Este bloque sustituye las menciones históricas a una activación de Google pendiente. El propietario confirmó que generó la clave, retiró la copia antigua de código y publicó el receptor v3 en la implementación existente; la captura muestra la versión de despliegue 7 actualizada correctamente. Posteriormente confirmó que el panel lee las confirmaciones de Sheets. No se recibió ni almacenó su clave.

Al informar que una nueva confirmación no se registraba, se revisó `main` y se reprodujo un bloqueo local: los intentos fallidos conservados en `sessionStorage` nunca ofrecían una recuperación, incluso después de activar el receptor. Volver a enviar los mismos datos solo mostraba el resumen anterior, sin petición de red. El diagnóstico se reprodujo con datos simulados; no se afirma que sea la única causa posible de errores de escritura en Google.

Corrección: botón «Volver a intentar el registro» que conserva el identificador y los datos del mismo envío; nunca reintenta automáticamente. Se mantienen los errores explícitos, se ofrecen mensajes para datos rechazados y solo se da por guardado un recibo legible con identificador coincidente y versión compatible. Se amplía a 25 segundos la espera de una respuesta de Google. «Registrar otro invitado» limpia el formulario sin borrar comprobantes previos. El panel añade «Registrar invitado», que abre ese formulario en otra pestaña y conserva abierta la sesión del panel. Esta corrección no cambia Apps Script ni requiere regenerar la clave o volver a desplegar Google.

**Verificación local:** 35 pruebas aprobadas, incluyendo recuperación de un fallo anterior tras recarga, una respuesta perdida después de guardar, doble clic durante el reintento, rechazo de recibos antiguos y registro de otra persona. No se hicieron peticiones ni escrituras de prueba contra Google; no se enviaron mensajes de WhatsApp. La lectura real fue confirmada por el propietario; la escritura real corregida todavía debe verificarse desde su cuenta.

**Publicación completada:** la corrección está en el commit `e2b46585f57cea46546a3274a37d3bfacf17c741`. La ejecución de GitHub Pages `34746793886` terminó con éxito, incluido `deploy`. Los recursos del formulario usan `?v=12` y el panel incluye el acceso a registrar. La comprobación mediante el lector web no estuvo disponible; no se intentó otra vía para eludir esa restricción. La publicación se acredita con Actions; no equivale a una nueva escritura comprobada en Sheets.

## Panel de invitados (continuación posterior)

Se añade `invitados.html` en la misma publicación de GitHub Pages. Apariencia azul noche, marfil y dorado con los anillos; tabla adaptable, búsqueda, filtros de asistencia/seguimiento, orden, totales de adultos/niños/pases, edición con lápiz, retirada con × y confirmación, y vista de impresión horizontal con dedicatorias opcionales.

Usa como única fuente la pestaña `Confirmaciones` de la hoja existente. Sus metadatos y encabezados A6:K6 se volvieron a comprobar. No se copiaron datos de invitados al repositorio ni se hicieron cambios en las filas reales. La función de configuración vincula el archivo desde Google y guarda su identificador en las propiedades privadas; su enlace se entrega solo tras autenticarse.

El receptor pasa a **v3** y contiene el flujo público de RSVP anterior más consulta/edición/archivo autenticados. La clave aleatoria se genera manualmente en el editor y su hash queda en Script Properties; nunca se incluye en el código público. El panel mantiene la sesión solo en memoria. La API vuelve a leer los cambios antes de confirmar y detecta versiones de filas distintas; los identificadores se guardan como notas de A. Las eliminaciones archivan antes de vaciar A:K, sin borrar filas completas ni mover el resumen de la derecha. No se permiten escrituras sobre filas con fórmulas.

**Pendiente en Google:** el propietario debe ejecutar `configurarAccesoInvitados` y publicar v3 en el despliegue existente, siguiendo `CONFIGURAR-GOOGLE-SHEETS.md`. La conexión permite leer Sheets pero no administrar Apps Script. El panel queda protegido hasta activar ese acceso. No se ha verificado consulta ni edición del panel contra el receptor real.

**Publicación, revisión del 13 de septiembre:** el código del panel está en `main` desde el commit `0513de7999657b454494329449bb49fba2de14ad`. En la ejecución de Pages `34723128243`, el trabajo `build` terminó correctamente pero `deploy` seguía en cola. La URL `invitados.html` todavía devolvía 404 en la revisión del navegador. No confundir el código guardado con un despliegue ya activo. Revisar Actions antes de anunciarlo publicado; no repetir cambios de implementación ni enviar registros reales para probarlo.

**Verificación posterior del 13 de septiembre: publicación completada.** La ejecución `34729995730` del commit `99b92efcbb46915bbecf2d7495ba2417c7fcf38e` terminó con éxito. Se volvió a abrir `https://lioncioylisbeth.github.io/nuestra-boda/invitados.html` y ya carga el panel de acceso con sus estilos y anillos. La ejecución anterior quedó cancelada. Se verificó visualmente la pantalla de acceso en escritorio; la tabla y sus operaciones se probaron con datos simulados. Sigue pendiente únicamente la activación y comprobación del receptor v3 en Google. No se introdujeron claves ni datos de invitados durante la revisión en navegador.

Pruebas locales: **31 aprobadas**, incluyendo cinco pruebas del controlador real del panel con DOM/transporte simulados. Se cubren autorización antes de leer Sheets, datos literales, cambios persistidos, conflictos, archivo recuperable, interrupciones, doble clic, cierre de sesión, filtros y recibos legibles. No se enviaron mensajes ni registros reales. Este bloque sustituye la mención de v2 como versión más reciente en el registro histórico siguiente.

## Implementado

- Portada compacta con Lioncio & Lisbeth como protagonistas, nombres completos debajo, fecha y acceso a confirmar.
- Cuatro apariencias en un menú compacto; música en la barra superior y asistente en preguntas frecuentes.
- Se conservan el velo, los anillos y los datos de la boda. El rosario no se restaura.
- Por solicitud posterior del cliente, la miniatura usa los anillos dorados, fondo azul noche y los nombres Lioncio & Lisbeth, en lugar del retrato de los novios. Archivo cuadrado `og-wedding-rings-v1.jpg`, 1254 × 1254 px, con márgenes y frase inferior en dos líneas. Metadatos de imagen y enlace actualizados para compartir la versión `?v=11`.
- Ceremonia y recepción con mapas y descarga de calendario en la hora de Morelos.
- Dedicatorias desplegables dentro del formulario, con textos locales sin dependencia de una clave de IA.
- Celular, adultos, niños y total; resumen de respuesta y mensaje de WhatsApp ordenado.
- Solo se comunica un guardado verificado cuando la respuesta del servidor lo permite. No se reenvían automáticamente peticiones dudosas.
- Receptor Apps Script v2 con validación, prevención de fórmulas y deduplicación por identificador.

## Verificación

`node --test tests/*.test.cjs`: 17 pruebas aprobadas, sin red ni datos reales. Incluyen el controlador real del formulario con DOM y transporte simulados: resumen, errores de red, respuestas opacas, doble clic, repetición tras recarga y cambio de asistencia.

Revisión en navegador el 12 de septiembre: las cuatro apariencias, reproducción al pulsar Abrir invitación, cálculo de adultos/niños, restauración del total después de cambiar asistencia, dedicatorias y regreso del foco al cerrar el asistente funcionan. Las imágenes de ubicaciones cargan correctamente.

Se corrigió un conflicto de prioridad con las utilidades de estilo heredadas: ya no deben imponer altura de pantalla completa, espaciado excesivo ni una cuenta regresiva de dos columnas. Se separaron visualmente los nombres del ampersand y se alinearon las acciones de las tarjetas de eventos.

La revisión interactiva se realizó en escritorio; no equivale a una prueba en dispositivos físicos. La música automática sigue dependiendo de los permisos del navegador: la entrada permite activarla con un toque o entrar sin sonido.

Se verificaron los encabezados de la hoja existente: A6:K6. No se cambiaron las respuestas ni el resumen de la derecha.

## Pendiente de la cuenta autorizada

Publicar la nueva versión de `rsvp-apps-script.gs` en el despliegue de Apps Script existente. La conexión de trabajo no ofrece administración de ese despliegue. Tampoco se pudo verificar su versión mediante la consulta de salud disponible. Véase `CONFIGURAR-GOOGLE-SHEETS.md`.

No confundir el código subido a GitHub con la versión que ejecuta Google. La protección de duplicados del servidor requiere desplegar v2. La aplicación web reconoce respuestas válidas del receptor anterior, pero no toma una respuesta de red opaca como evidencia de guardado.

No se enviaron confirmaciones reales ni mensajes de WhatsApp durante las pruebas.

## Si se retoma el trabajo

Leer primero este registro y el estado actual de la rama `main`. No repetir cambios terminados ni restaurar el rosario. Conservar los cambios posteriores del propietario. Cualquier prueba real de registro debe coordinarse con el propietario; no crear invitados ficticios en la hoja de producción por iniciativa propia.
