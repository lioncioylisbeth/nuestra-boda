# Dependencias del PDF local

No se envían datos de invitados a CDN ni a servicios de conversión.

- `jspdf-4.2.1.umd.min.js`: https://github.com/parallax/jsPDF/tree/v4.2.1/dist — MIT, `jspdf-LICENSE.txt`.
- `jspdf-autotable-5.0.8.min.js`: https://github.com/simonbengtsson/jsPDF-AutoTable/tree/v5.0.8/dist — MIT, `jspdf-autotable-LICENSE.txt`.
- `pdf-fonts.js`: subconjuntos Base64 de DejaVu Sans Regular/Bold y Serif Regular, creados con fontTools a partir de DejaVu 2.37. Incluyen U+0020–024F y U+2000–206F. Licencia en `dejavu-LICENSE.txt`. Las fuentes se incrustan en cada PDF, sin depender de las fuentes instaladas en el lector.

Para verificar el exportador: `node --test tests/pdf-export.test.cjs`. Requiere Node 18+ y Poppler (`pdftotext`, `pdfinfo`). El resto de las pruebas se ejecuta con `node --test tests/*.test.cjs`.
