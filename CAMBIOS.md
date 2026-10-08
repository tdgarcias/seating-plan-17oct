# Cambios: submesas, idioma CAT/ESP y exportación a Google Sheets

> Este zip es **acumulativo**: incluye también los cambios de las entregas anteriores. Puedes aplicarlo tanto sobre el repositorio original como sobre la versión ya actualizada.

## Novedades de esta versión (v4)

### Submesas (dividir una mesa imperial en varias "mesas")
- En la ficha de una mesa rectangular (panel derecho o vista ampliada ⤢), sección **Submesas**:
  - "✂ Dividir en N submesas" crea N tramos iguales a lo largo de la mesa.
  - Cada tramo incluye los asientos de arriba y de abajo que quedan enfrentados (p. ej. asientos 1–6 y 33–38).
  - Para cada tramo se puede editar el **nº o nombre** y los **asientos por lado**. El tramo vecino compensa la diferencia, así que el total siempre cuadra.
  - Botones: **+ Tramo**, **⇹ Igualar**, **✕** (une el tramo con su vecino) y **Quitar submesas**.
- **Numeración global**: las submesas nuevas continúan la numeración de la sala (mesa A → 1–5, mesa B → 6–10). "**1…N Renumerar sala**" vuelve a numerar todas de izquierda a derecha.
- El nº de submesa **se deduce del asiento**: mover a alguien de silla cambia su submesa automáticamente. No hay que asignar nada a mano.
- **En pantalla**:
  - bandas alternas suaves, separadores discontinuos y nº difuminado;
  - el nombre de la mesa y la ocupación pasan a una sola línea;
  - la lista de invitados y la ficha muestran "Mesa 3" (y la mesa física entre paréntesis);
  - en la vista ampliada cada asiento lleva su nº de submesa.
- **Avisos**:
  - números de submesa repetidos;
  - invitados en una mesa con submesas pero sin asiento (no tienen nº de mesa).
  - Si dos incompatibles comparten mesa imperial pero están en submesas distintas, el aviso baja de error a advertencia.
- Si cambias los asientos por lado, las submesas se reajustan solas. Al duplicar una mesa, la copia recibe números nuevos.

### Idioma del detalle (CAT / ESP)
- **Ficha del invitado**: "Idioma del detalle" (CAT · Català / ESP · Español / Sin definir).
- **En bloque desde la lista**:
  - nuevo filtro de idioma y botón "Seleccionar N", que selecciona los invitados filtrados (por ejemplo, toda una familia);
  - en la barra de selección, botones **CAT / ESP / —**.
- **Contador** en la lista: "🗣 CAT x · ESP y · N sin idioma". Pulsar "sin idioma" filtra a quienes faltan.
- Etiqueta CAT/ESP junto al nombre en la lista, en la vista ampliada de mesa y, muy pequeña, bajo cada asiento del plano.
- **Sincronizar con Google Sheets no borra el idioma.** Si la hoja tiene una columna "Idioma", solo rellena a quien no tenga idioma en la app.

### Impresión A4
- **Submesas difuminadas** sobre las mesas: bandas grises muy claras, separadores discontinuos que cruzan la fila de asientos y el nº en gris claro.
- Si una mesa no cabe en una página, se parte **por el límite entre submesas**. La cabecera indica, por ejemplo, "Mesa imperial A · Mesas 1-2 (asientos 1-14, 33-46)".
- **CAT/ESP muy pequeño en gris** al final del nombre de cada invitado, en el plano y en las páginas por mesa. La leyenda añade "CAT / ESP = idioma del detalle".
- **Hoja de catering**:
  - la columna "Mesa" muestra la submesa ("Mesa 3");
  - el resumen va por submesa;
  - el orden es por submesa y asiento;
  - CAT/ESP en pequeño junto al nombre.
- La **hoja de regalos** pasa a llamarse "Regalos y detalles en la mesa":
  - cuenta los detalles **por idioma y submesa** (CAT 8 · ESP 4…), contando a todos los sentados;
  - la tabla de regalos incluye la columna Idioma.
- Opciones nuevas en el diálogo: "Idioma del detalle (CAT/ESP)" y "Submesas difuminadas".

### Exportar el idioma a la Google Sheet (columna H)
- Se abre desde **Exportar → Idioma CAT/ESP → Google Sheet (columna H)…** o desde el enlace "→ Sheet (col. H)" de la lista.
- La app **lee la hoja en ese momento** y empareja cada fila con su invitado por el nombre completo, igual que la sincronización.
- Genera una columna con "Idioma" en la primera línea y un valor por fila, en el orden exacto de la hoja.
- **📋 Copiar columna H**: en Google Sheets, haz clic en **H1** y pega.
- Antes de copiar ves una vista previa (fila, nombre, valor) y los avisos: invitados sin idioma (celda vacía) y filas de la hoja que no están en la app.
- **⬇ Descargar CSV** con fila, nombre e idioma, por si prefieres revisarlo aparte.
- Si la hoja no se puede leer (sin conexión), se usa el orden de la última sincronización y se avisa.
- Después de pegar, la columna "Idioma" se reconoce al sincronizar, así que los datos van y vuelven sin perderse.

### Otros
- El CSV de invitados añade las columnas **Idioma** y **Submesa**. El JSON del escenario incluye `submesa` e `idioma`.
- Migración automática: en los proyectos guardados, los invitados quedan "sin idioma" y las mesas sin submesas. No se pierde nada.

**Archivos nuevos en v4:**
- `src/utils/sections.ts`
- `src/utils/language.ts`
- `src/components/tables/SectionEditor.tsx`
- `src/components/export/LanguageExportModal.tsx`

**Modificados en v4:**
- `src/types/index.ts`
- `src/store/useProjectStore.ts`
- `src/store/scenarioAssignments.ts`
- `src/services/guestService.ts`
- `src/services/exportService.ts`
- `src/services/printA4Service.ts`
- `src/services/demoData.ts`
- `src/utils/validation.ts`
- `src/components/room/TableShape.tsx`
- `src/components/tables/PropertiesPanel.tsx`
- `src/components/tables/TableEditorModal.tsx`
- `src/components/guests/GuestList.tsx`
- `src/components/guests/GuestCard.tsx`
- `src/components/guests/GuestDetailModal.tsx`
- `src/components/layout/Header.tsx`
- `src/components/export/PrintA4Modal.tsx`
- `src/styles/layout.css`

---

## Versión anterior (v3)


- **Datos de la boda:**
  - "Cati & Tomeu" sustituye a "Nuestra boda".
  - Pulsando el nombre bajo "Seating Plan" se editan los novios, el lugar y la fecha.
  - Los proyectos que tenían "Nuestra boda" se actualizan solos (Cati & Tomeu · Els Calderers · 17/10/2026).
- **Pie de página de la impresión:** "Els Calderers · 17/10/2026" y el número de página. Se eliminan la frase "Plano con números de asiento…", la nota de las páginas por mesa y "Impreso el…".
- **Novios en rojo** en todas las páginas: plano, páginas por mesa, catering y regalos. En el plano también llevan un aro rojo en el asiento.
- **Un color fijo por categoría:**
  - Todos los invitados con gluten se marcan en el mismo color, todos los vegetarianos en otro, etc.
  - Junto al nombre aparece una píldora del color de la categoría, con la miniatura del mismo emoji de la app y su abreviatura.
  - Si un invitado tiene varias restricciones, el **asiento se divide en sectores** con el color de cada una.
  - La leyenda muestra miniatura, color y nombre.
  - Las abreviaturas y el "(!)" se mantienen por si alguien imprime en blanco y negro.
  - Las miniaturas se generan en el navegador con la fuente de emojis del sistema.
- **Nuevas dietas:**
  - Pescetariano.
  - Bebé: ocupa plaza, pero en el plano su asiento se dibuja como **trona** (cuadrado) y no cuenta como menú en la hoja de catering. Se resume aparte por mesa ("2 bebés en trona, sin menú").
- **Regalos en la mesa:**
  - En la ficha del invitado: casilla "Tiene un regalo o detalle" y descripción.
  - En la lista: 🎁 junto al nombre, filtro 🎁 y contador.
  - En el plano: 🎁 junto al asiento.
  - En la impresión: 🎁 junto al nombre y nueva **hoja de regalos** (mesa, asiento, invitado, regalo), con totales por mesa.
  - El regalo solo se gestiona en la app: sincronizar con Google Sheets no lo borra.
- Los CSV y JSON exportados incluyen el regalo.

**Archivos nuevos en v3:** `src/components/settings/WeddingSettingsModal.tsx`, `src/components/guests/GiftEditor.tsx`, `src/utils/emojiIcons.ts`.

---


Copia el contenido de este zip en la raíz del repositorio, sobrescribiendo los archivos existentes, y haz commit. No hay dependencias nuevas, así que no hace falta `npm install`.

## 1. Escenarios independientes (bug corregido)

**Causa:** el reparto (mesa y asiento) se guardaba en el invitado, que es común a todos los escenarios. Además, al duplicar un escenario las mesas conservaban el mismo ID, y cambiar de escenario no guardaba nada. Por eso todos los escenarios acababan mostrando el último reparto.

**Solución:**
- Cada escenario guarda ahora su propio reparto en `scenario.assignments` (`guestId → { tableId, seatIndex }`).
- `guest.tableId` y `guest.seatIndex` se mantienen como espejo del escenario activo. Así el lienzo, las listas y las validaciones siguen funcionando sin cambios. Al cambiar de escenario se guarda el reparto del que sale y se carga el del que entra. Tras cada edición, el espejo se vuelca al escenario activo.
- Nuevo escenario: vacío o "duplicar desde…" cualquier otro, siempre como copia independiente.
- Barra de escenarios: muestra el nº de sentados y la fecha de última modificación de cada escenario, y no permite borrar el último que queda.
- Nueva vista **⇄ Comparar**: elige dos escenarios y ve qué invitados cambian de mesa (o de asiento).
- **Sincronizar con Google Sheets ya no cambia los IDs de los invitados.** Antes los regeneraba, lo que habría roto los repartos por escenario.

**Migración automática (schemaVersion 2):**
- Al abrir la app, el proyecto guardado se convierte solo. Antes se hace una copia del original en `localStorage` con la clave `seating-plan-boda:project:backup-before-v2`.
- Al importar un JSON antiguo pasa lo mismo.
- El reparto que existía se copia a todos los escenarios, porque no hay otra información disponible. A partir de ahí cada escenario evoluciona por separado.
- Si alguna asignación apunta a una mesa o asiento inexistente, se libera y se avisa; nunca se pierde en silencio.
- El histórico de deshacer antiguo se reinicia una sola vez, porque su formato es incompatible.

## 2. Alergias e intolerancias

`guest.dietary` pasa de texto libre a una estructura:
`{ allergens[], diets[], severity, notes, sheetText? }`

- **Alérgenos:** los 14 de declaración obligatoria UE, cada uno con abreviatura para impresión: GLU, CRU, HUE, PES, CAC, SOJ, LAC, FCA, API, MOS, SES, SUL, ALT, MOL.
- **Dietas:** vegetariano, vegano, sin cerdo, halal, kosher, embarazada, menú infantil.
- **Gravedad:** alergia (grave), intolerancia o preferencia.
- **Ficha del invitado:** chips seleccionables, gravedad y nota para cocina o camareros.
- **Lista de invitados:**
  - distintivo junto al nombre (⚠ rojo si es alergia grave);
  - filtro **Alergias**;
  - enlace al **resumen** con totales y desglose por mesa.
- **Plano en pantalla:** marca "!" en el asiento y detalle al pasar el ratón.
- **Google Sheets:** se reconoce una columna "Alergias" o "Restricciones alimentarias" y se autodetectan los alérgenos ("celíaca", "lactosa", "frutos secos"…). Lo editado a mano en la app no se sobrescribe. Si la hoja trae un texto distinto, se avisa y la ficha ofrece "Usar texto de la hoja".
- Si un proyecto antiguo tenía `dietary` como texto, ese texto pasa a `notes`.
- Las exportaciones CSV y JSON y el análisis con IA incluyen las alergias.

## 3. Impresión A4 (wedding planner y catering)

Para abrirla: botón **🖨 Imprimir A4** en la cabecera, en *Exportar* o en *Presentación*.

- PDF vectorial en A4 real con texto seleccionable, generado con jsPDF (`src/services/printA4Service.ts`).
- **Nombre completo, nunca iniciales.** En pantalla, el modo "Nombres completos" también deja de anteponer las iniciales.
- **Opciones:**
  - escenario (cualquiera, no solo el activo) y orientación (automática, vertical u horizontal);
  - alergias junto al nombre, leyenda de abreviaturas y números de asiento;
  - páginas por mesa, hoja de catering y lista de invitados sin mesa.
- **Legibilidad garantizada (mínimo 6,5 pt):**
  - Se prueba de 10 pt a 6,5 pt, primero en una línea y después partiendo el nombre en dos, comprobando que ningún texto se solape con otro, con una mesa o con un asiento.
  - Si en el plano general no cabe, este muestra los números de asiento y se añade una página por mesa con los nombres en grande. La orientación de esas páginas es la misma que en el plano general.
  - Si una mesa aún no cabe, se reparte en varias páginas con el rango de asientos indicado.
- **Blanco y negro:**
  - las alergias van en texto (GLU·LAC);
  - las graves llevan "(!)";
  - el asiento con restricción va relleno de negro.
- **Hoja de catering:** resumen por mesa y una tabla Mesa / Asiento / Invitado / Alergias / Gravedad / Notas, ordenada por mesa y asiento. Las alergias graves llevan una barra lateral.
- **Vista previa:** se ve dentro del diálogo en Chrome, Edge y Firefox de escritorio. En el móvil, usa "Abrir para imprimir" o "Descargar".

Probado con el proyecto real (127 sentados, 2 mesas imperiales de 64). Resultado:
- plano general con números de asiento;
- 1 página por mesa con los 64 nombres a 10 pt;
- hoja de catering.

Con mesas redondas, los nombres caben directamente en el plano general.

## Archivos

**Nuevos**
- `src/store/scenarioAssignments.ts`: reparto por escenario, cambio de escenario y migración
- `src/utils/dietary.ts`: alérgenos, dietas, autodetección y formato
- `src/services/printA4Service.ts`: generador del PDF A4
- `src/components/export/PrintA4Modal.tsx`
- `src/components/scenarios/ScenarioCompareModal.tsx`
- `src/components/dietary/DietaryEditor.tsx`
- `src/components/dietary/DietaryBadge.tsx`
- `src/components/dietary/DietarySummaryModal.tsx`

**Modificados**

`src/types/index.ts`, `src/store/useProjectStore.ts`, `src/services/guestService.ts`, `src/services/storageService.ts`, `src/services/exportService.ts`, `src/services/aiAnalysisService.ts`, `src/services/demoData.ts`, `src/components/scenarios/ScenarioBar.tsx`, `src/components/guests/GuestList.tsx`, `src/components/guests/GuestCard.tsx`, `src/components/guests/GuestDetailModal.tsx`, `src/components/room/TableShape.tsx`, `src/components/room/RoomCanvas.tsx`, `src/components/layout/Header.tsx`, `src/components/presentation/PresentationView.tsx`, `src/components/export/ExportModal.tsx`, `src/styles/layout.css`

## Cómo comprobarlo

1. Abre la app: aparece el aviso "Proyecto actualizado…".
2. En «Distribución inicial», quita a alguien de su mesa. Cambia a «Proposta 2»: esa persona sigue sentada. Vuelve: sigue sin mesa.
3. Escenario → *+ Nuevo escenario* → "Duplicar desde «Proposta 2»". Mueve a 3 personas. Abre *⇄ Comparar*: aparecen esas 3.
4. Exporta el *Proyecto completo (.json)*, recarga e impórtalo: cada escenario conserva su reparto.
5. En la ficha de un invitado, marca Gluten y la gravedad "Alergia" → *Imprimir A4*. En su asiento aparece "(!) GLU", y también en la hoja de catering.
