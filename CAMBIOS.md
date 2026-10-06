# Cambios: escenarios independientes, alergias e impresión A4

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
