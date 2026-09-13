# Activar confirmaciones y la página de invitados

La página **[invitados.html](https://lioncioylisbeth.github.io/nuestra-boda/invitados.html)** usa la misma hoja **Confirmaciones · Boda Lioncio & Lisbeth**. No crea una segunda lista independiente: consulta y modifica las filas de la pestaña `Confirmaciones`.

**Estado actualizado, 13 de septiembre de 2026:** el propietario tiene activa la versión de despliegue 7 (receptor v3) y confirmó que el panel lee Sheets. Las nuevas confirmaciones siguen fallando. Se preparó el **receptor v4**, pendiente de publicar en la implementación de Google existente. Guardarlo en GitHub no actualiza Apps Script.

## Actualización del receptor que ya tienes activo

Desde el celular abre **[Copiar el código completo](https://lioncioylisbeth.github.io/nuestra-boda/actualizar-receptor.html)**. El botón conserva todos los saltos de línea; también permite descargar `Codigo.gs` para abrirlo en tu editor de texto.

1. Copia el código v4 y sustituye el contenido de `Código.gs` en el proyecto de Apps Script que ya administra la hoja. Conserva el respaldo fuera del proyecto y guarda.
2. **Conserva la clave actual. No ejecutes de nuevo `configurarAccesoInvitados`**: volvería a generar otra clave.
3. Abre **Implementar → Gestionar implementaciones** (o Administrar implementaciones), elige la aplicación activa y pulsa el lápiz. En Versión selecciona **Nueva versión** y pulsa Implementar. Conserva la cuenta, el acceso y la URL existentes.
4. La URL de aplicación web `/exec` debe devolver `"version":4`. Ese número corresponde al receptor, no al número de implementación que asigna Google. Esta lectura no crea invitados ni demuestra que una escritura funcione.
5. Vuelve al resumen pendiente y reintenta una sola vez con el mismo identificador. Comprueba el registro completo en Sheets y actualiza el panel. No borres las notas de las filas reservadas: evitan duplicados.

**Qué se corrigió:** se elimina `setNumberFormat('@')` de las escrituras de teléfono en la tabla existente. El valor sigue siendo texto literal mediante `sheetText_`. El guardado público vuelve a leer la fecha, nombre, asistencia, pases, mensaje, origen, teléfono y desglose; comprueba que no haya fórmulas antes de responder con éxito. Una fila incompleta o modificada se remite a revisión en lugar de sobrescribirla durante un reintento. Los errores indican la etapa y el detalle de la excepción queda en el registro privado de ejecución de Apps Script.

**Límite del diagnóstico:** la lectura autorizada de Sheets encontró notas de reserva de RSVP en filas sin nombre ni teléfono, y una columna de teléfono nativa de tipo TEXT. Esto localiza el fallo después de reservar y antes de terminar la escritura. El cambio de formato es una causa posible, no una excepción confirmada: v3 oculta la excepción. La conexión disponible no permite ejecutar ni desplegar Apps Script; la corrección debe verificarse en Google después de activarla. No se ha enviado ningún RSVP real durante las pruebas.

Si v4 vuelve a fallar, la referencia de la invitación distingue lectura, reserva, escritura o verificación. En Apps Script → Ejecuciones, abre la ejecución reciente de `doPost` y revisa el mensaje `RSVP v4, etapa …`. No compartas claves ni datos de invitados del registro. No vuelvas a regenerar la clave ni a crear otro despliegue como intento de solución.

## Activación desde la cuenta autorizada

1. Abre la hoja existente con la cuenta autorizada que administra su aplicación web. Ve a **Extensiones → Apps Script**. Conserva una copia del código anterior por si necesitas volver a él.
2. Sustituye el receptor anterior por todo el contenido de **[rsvp-apps-script.gs](https://github.com/lioncioylisbeth/nuestra-boda/blob/main/rsvp-apps-script.gs)** y guarda. No dejes dos funciones `doPost` ni dos `doGet` en archivos distintos. Este único archivo atiende tanto el formulario público como el panel de organizadores.
3. En el selector de funciones del editor, elige **`configurarAccesoInvitados`** y pulsa **Ejecutar**. Autoriza los permisos de Google si los solicita. En **Registro de ejecución** aparecerá una clave privada de 64 caracteres. Cópiala a tu gestor de contraseñas. **No es la contraseña de Gmail. No la pegues en GitHub, en la invitación ni en esta conversación.** La función vincula la hoja desde la que abriste el editor y guarda su identificador y el hash de la clave en las propiedades privadas del proyecto. Si la ejecutas otra vez, la clave anterior deja de funcionar.
4. Ve a **Implementar → Administrar implementaciones**, elige la aplicación web existente y pulsa el lápiz. Selecciona **Nueva versión**. Mantén **Ejecutar como: Yo**, con la cuenta autorizada. El acceso a la aplicación debe permitir que los invitados envíen su formulario sin iniciar sesión; el receptor comprueba la clave privada antes de permitir cualquier consulta o gestión. **No hagas pública la hoja de cálculo.**
5. Pulsa **Implementar**. Actualiza el despliegue existente para conservar la URL que ya utiliza la invitación.

6. Abre esa URL `/exec`. Debe devolver `{"ok":true,"service":"rsvp-lioncio-lisbeth","version":4}`. Esta consulta solo informa de la versión y no devuelve ni crea invitados. No uses `/dev` para producción.
7. Abre **[invitados.html](https://lioncioylisbeth.github.io/nuestra-boda/invitados.html)**, pega la clave privada y pulsa **Abrir lista de invitados**. Comprueba que aparecen los mismos registros que en Sheets. Una consulta autenticada asigna identificadores estables mediante notas en las celdas de fecha de registros anteriores; no cambia sus datos.

Si creas otro despliegue con una URL distinta, tendrás que actualizar el endpoint tanto en `index.html` (`RSVP_ENDPOINT`) como en `invitados.js` (`endpoint`). Guardar en el editor sin publicar una **nueva versión** no activa los cambios.

## Cómo se relacionan ambas tablas

| Acción | Resultado en Google Sheets y en la página |
| --- | --- |
| El invitado confirma desde la invitación | Se registra en `Confirmaciones`; el panel lo muestra al actualizar. |
| Pulsas «Registrar invitado» en el panel | Abre el formulario de la invitación en otra pestaña. Tras registrar, vuelve al panel y pulsa «Actualizar». |
| Pulsas el lápiz y guardas | Se actualiza el mismo registro en Sheets; el servidor lo vuelve a leer antes de confirmar el resultado. |
| Editas directamente en Sheets | La página consulta los cambios al pulsar **Actualizar** o en la siguiente actualización automática. |
| Pulsas × y confirmas | Se copia el registro a `Archivo de invitados` del mismo archivo y se vacían sus celdas A:K en `Confirmaciones`. No se elimina la fila completa ni se desplaza el resumen lateral. |
| Imprimes | Se prepara la lista filtrada, con totales y fecha de actualización; los botones y filtros no se imprimen. Las dedicatorias son opcionales. No modifica Sheets. |

La consulta automática ocurre cada minuto mientras la pestaña está visible y no hay un diálogo de edición abierto. La edición no es simultánea en tiempo real: si se detecta una versión distinta de la fila, se pide actualizar antes de guardar. Conviene evitar editar la misma fila desde dos lugares al mismo tiempo.

Los datos siguen en **A6:K6**, con registros a partir de la fila 7:

| Columna | Dato |
| --- | --- |
| A | Fecha y hora |
| B | Invitado / Familia |
| C | ¿Asistirá? |
| D | Pases (adultos + niños) |
| E | Dedicatoria |
| F | Origen |
| G | Estado: Pendiente, Confirmado o Contactado |
| H | Observaciones |
| I | Teléfono |
| J | Adultos |
| K | Niños |

La página conserva la fecha y el origen al editar. Acepta celular vacío para registros antiguos; si se escribe uno, debe ser válido. El desglose admite hasta 10 personas por registro, como la invitación. Si no asistirán, los tres conteos quedan en cero. Los registros antiguos sin desglose se marcan para revisión; no se inventa cuántos adultos o niños contienen.

Los identificadores se guardan como notas en A, sin añadir columnas a la tabla principal. Conserva estas notas al ordenar o mover registros. Las filas que contengan fórmulas se consultan, pero deben editarse directamente en Sheets para no reemplazar las fórmulas.

## Acceso privado

La URL de la página puede abrirse públicamente, pero **la lista y las operaciones requieren la clave privada validada por Google**. La página no incluye invitados en el HTML ni guarda la clave o la lista en el almacenamiento del navegador. La clave viaja mediante HTTPS dentro del cuerpo de la petición, nunca en el enlace. La sesión se cierra al salir, recargar o tras 30 minutos sin interacción.

Entrega la clave solo a las personas autorizadas para administrar a los invitados. El acceso mediante esta clave es compartido, no identifica por separado a cada organizador. Para revocarla, ejecuta otra vez `configurarAccesoInvitados` desde el editor y conserva la nueva. Esto no requiere volver a publicar si v3 ya está activo. La hoja mantiene sus permisos de Google originales.

## Recuperar un registro archivado

En la pestaña `Archivo de invitados`, las columnas **E:O** contienen las 11 celdas originales y **D** su nota original. Desde Sheets, copia **solo los valores** E:O a una fila vacía de `Confirmaciones`, a partir de A. Copia también el texto de D a la nota de la celda A; no copies un marcador `GUEST-DELETED` de la fila vaciada. Revisa el registro y actualiza el panel. No borres el archivo de respaldo si todavía lo necesitas.

## Confirmaciones y mensajes de error

La invitación prepara un mensaje de WhatsApp e intenta guardar en Sheets. Solo comunica **Registro verificado** tras recibir un JSON legible con `ok: true`, el identificador del mismo envío y una versión compatible del receptor. Una respuesta opaca, un error de conexión o una espera agotada **no** prueban el guardado. El celular lo declara el invitado: el navegador no puede leer el número de su cuenta de WhatsApp.

Si un intento falló antes de activar Google o se perdió su respuesta, el formulario conserva ese intento. **«Volver a intentar el registro»** reenvía los mismos datos con el mismo identificador, únicamente al pulsarlo. El receptor v3 reutiliza una reserva o devuelve el comprobante existente: no crea otra fila por repetir ese identificador. No se reenvía automáticamente al recargar ni al volver al resumen. Ante datos inválidos se pide corregirlos; ante un registro archivado o un recibo antiguo sin identificador se pide revisar la respuesta con los organizadores.

**«Registrar otro invitado»** abre un formulario limpio con un adulto y cero niños. Conserva los identificadores de los intentos previos en la sesión para que volver a escribir la misma respuesta no duplique un registro. Los datos personales y las dedicatorias no se guardan en el almacenamiento del navegador.

El receptor conserva la validación y deduplicación por identificador de envío de v2. Si se repite una petición, reutiliza el registro reservado. No fusiona personas por nombre ni por teléfono. Una respuesta modificada se considera un nuevo envío. Un envío archivado no vuelve a aparecer por repetir su petición antigua.

Si una operación del panel termina con un error de conexión, **actualiza la lista antes de repetirla**: Google puede haber guardado antes de cortarse la respuesta. El panel no reintenta escrituras automáticamente ni considera que abrir WhatsApp demuestre el guardado.

## Verificación

`node --test tests/*.test.cjs` ejecuta pruebas sin red, con una hoja y un navegador simulados. Se verifican acceso privado, lista, edición, conflictos, archivo, fallos parciales, prevención de fórmulas, respuestas opacas, filtros, totales, doble envío y cierre de sesión. No se enviaron confirmaciones reales ni mensajes de WhatsApp durante estas pruebas.

El propietario ya comprobó la lectura de la lista existente. La corrección v4 pasa 40 pruebas locales. Incluyen una hoja simulada que rechaza cambios de formato en columnas tipadas, respuesta perdida después de guardar, fallo al vaciar la caché de escritura, fila incompleta y reintento de un registro modificado por los organizadores. La simulación comprueba esos casos y no demuestra cuál fue la excepción real de Google. Falta activar v4 y comprobar una escritura desde la cuenta del propietario y su fila correspondiente en Sheets.

Referencias oficiales: [publicar aplicaciones web de Apps Script](https://developers.google.com/apps-script/guides/web), [propiedades del proyecto](https://developers.google.com/apps-script/guides/properties), [respuestas JSON y redirecciones](https://developers.google.com/apps-script/guides/content), [vaciar contenido sin borrar el formato](https://developers.google.com/apps-script/reference/spreadsheet/range#clearcontent).
