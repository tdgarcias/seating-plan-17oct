# Seating Plan · Boda en Mallorca 🌿

Constructor visual, funcional y sin backend para diseñar el seating plan de una boda: coloca mesas en un plano de la sala a escala real, asigna invitados por arrastrar y soltar, prueba varios escenarios y exporta el resultado.

Diseñado para funcionar como aplicación estática (React + Vite + TypeScript), lista para desplegarse en **Cloudflare Pages** y sin depender de ningún servidor propio ni de Google Apps Script.

---

## Índice

1. [Qué hace la aplicación](#qué-hace-la-aplicación)
2. [Novedades de esta versión](#novedades-de-esta-versión)
3. [Análisis del seating con IA](#análisis-del-seating-con-ia-claude)
4. [Tecnologías](#tecnologías)
3. [Instalación](#instalación)
4. [Ejecución en local](#ejecución-en-local)
5. [Estructura del proyecto](#estructura-del-proyecto)
6. [Configuración de Google Sheets](#configuración-de-google-sheets)
7. [Despliegue en Cloudflare Pages](#despliegue-en-cloudflare-pages)
8. [Subir el proyecto a GitHub](#subir-el-proyecto-a-github)
9. [Uso de la aplicación](#uso-de-la-aplicación)
10. [Exportación e importación](#exportación-e-importación)
11. [Limitaciones conocidas](#limitaciones-conocidas)
12. [Próximas mejoras posibles](#próximas-mejoras-posibles)

---

## Qué hace la aplicación
- Define una sala a escala real (metros) y coloca dentro mesas redondas o rectangulares.
- Genera automáticamente los asientos alrededor de cada mesa según su capacidad.
- Importa invitados desde una Google Sheet pública (sin Apps Script, sin API key) o carga datos de ejemplo para probar sin conexión.
- Asigna invitados a mesas/asientos por arrastrar y soltar, por selección múltiple o desde la vista "Organizar invitados".
- Permite crear varios **escenarios** (p. ej. "Distribución inicial", "Plan lluvia") y duplicarlos para comparar alternativas.
- Detecta automáticamente problemas: mesas por encima de su capacidad, mesas solapadas o fuera de la sala, invitados duplicados, invitados sin asignar.
- Guarda automáticamente en el navegador (localStorage) y permite exportar/importar el proyecto completo como `.json`.
- Exporta el listado de invitados a CSV, el escenario a JSON, el plano a PNG y permite imprimirlo.
- Tres modos de vista: **Mapa** (edición visual), **Organizar invitados** (foco en la lista) y **Presentación** (vista limpia para enseñar el resultado).
- Roles de invitado, resaltado visual de los novios, incompatibilidades entre invitados y elementos de sala (DJ, baños, puertas...).
- Análisis del seating con IA (Claude) y exportación a PDF vectorial / PNG en alta resolución.

## Novedades de esta versión

- **Sala sin mínimo de metros**: los campos de anchura/longitud aceptan cualquier valor, incluido 0, y se pueden borrar mientras se escribe.
- **Paneles más anchos y sin campos cortados**: los campos numéricos usan un componente propio (`NumberField`) que evita el desbordamiento de los spinners nativos.
- **Arrastrar invitados ya sentados**: puedes mover a un invitado de una silla a otra directamente en el plano, o reordenar asientos por arrastre en la vista ampliada de cada mesa.
- **Roles de invitado y resaltado de los novios**: cada invitado puede tener un rol (familiar, amigo/a, compañero/a de trabajo...) y marcarse como uno de los novios — se detecta automáticamente si la columna "Notas" de tu Google Sheet contiene "novio"/"novia", y se resalta en rojo tanto en la lista como en el plano.
- **Incompatibilidades entre invitados**: desde la ficha de cada invitado puedes marcar con quién no debe compartir mesa. Se avisa automáticamente si ocurre y la distribución automática las tiene en cuenta.
- **Elementos de la sala** (DJ, baños, puertas, barra, pista de baile): se colocan y arrastran igual que las mesas, y se incluyen en el análisis de IA.
- **Análisis del seating con IA**: botón "🤖 Analizar con IA" en el cabecero. Usa tu propia clave de API de Anthropic (ver más abajo).
- **Historial persistente**: deshacer/rehacer ya no se pierde al recargar la página.
- **Exportación a PDF vectorial** (jsPDF + svg2pdf.js) además de PNG en alta resolución, con opción de mostrar nombre completo o iniciales en los asientos.

## Análisis del seating con IA (Claude)

Como la aplicación no tiene backend, no hay ningún sitio seguro del lado del servidor donde guardar una clave de API compartida por todos los usuarios. Por eso, cada persona que quiera usar el análisis de IA introduce **su propia clave de la API de Anthropic** directamente en la aplicación:

1. Pulsa "🤖 Analizar con IA" en el cabecero.
2. Pega tu clave (consíguela en [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)).
3. Pulsa "Analizar seating".

La clave se guarda **únicamente en tu navegador** (localStorage) y la llamada a `api.anthropic.com` se hace directamente desde tu navegador — nunca se guarda en el proyecto exportado ni en el código fuente del repositorio. El análisis tiene en cuenta las mesas, los roles de los invitados, quién son los novios, y los elementos de la sala (DJ, baños, puertas...) que hayas marcado.

## Tecnologías


- [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Vite 5](https://vitejs.dev/) como bundler
- [Zustand](https://github.com/pmndrs/zustand) + [Immer](https://immerjs.github.io/immer/) para el estado global y el histórico de deshacer/rehacer
- SVG nativo para el plano de la sala (sin librerías de canvas de terceros)
- `localStorage` para autoguardado — sin backend, sin base de datos

No hay dependencias de pago ni claves de API necesarias.

## Instalación

Requiere [Node.js](https://nodejs.org/) 18 o superior.

```bash
npm install
```

## Ejecución en local

```bash
npm run dev
```

Abre la URL que indique la terminal (normalmente `http://localhost:5173`).

Para generar la build de producción y previsualizarla:

```bash
npm run build
npm run preview
```

## Estructura del proyecto

```
seating-plan/
├── public/
├── src/
│   ├── components/
│   │   ├── common/          Modal, ConfirmDialog, ToastStack
│   │   ├── guests/           Lista, tarjeta y detalle de invitados
│   │   ├── layout/            Header
│   │   ├── onboarding/        Guía inicial
│   │   ├── presentation/      Modo presentación
│   │   ├── room/              Canvas SVG de la sala y las mesas
│   │   ├── scenarios/         Selector de escenarios
│   │   └── tables/            Panel de propiedades, editor de mesa, tablero "Organizar"
│   ├── pages/                 EditorPage (combina los 3 modos de vista)
│   ├── services/
│   │   ├── guestService.ts    Único punto de acceso a la fuente de invitados (Google Sheets CSV)
│   │   ├── storageService.ts  Autoguardado, exportar/importar proyecto
│   │   └── exportService.ts   Exportar CSV / JSON / PNG / imprimir
│   ├── store/
│   │   ├── useProjectStore.ts Estado global de la aplicación (Zustand)
│   │   └── history.ts         Pila de deshacer/rehacer
│   ├── styles/                 theme.css (paleta y tipografía), layout.css, global.css
│   ├── types/                  Modelos de datos (Guest, TableItem, Scenario, Project…)
│   ├── utils/                  Geometría de asientos, validaciones, ids
│   ├── App.tsx
│   └── main.tsx
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
└── README.md
```

La fuente de los invitados está completamente abstraída en `src/services/guestService.ts`. Si en el futuro quieres cambiar Google Sheets por otra fuente de datos, solo necesitas modificar ese archivo: el resto de la aplicación únicamente consume `Guest[]`.

## Configuración de Google Sheets

**No se necesita ninguna API key ni Google Apps Script.** La aplicación lee la hoja como CSV público.

1. Abre tu Google Sheet.
2. Ve a **Archivo → Compartir → Compartir con otros** y selecciona **"Cualquier persona con el enlace" → Lector**.
   *(Alternativa equivalente: Archivo → Compartir → Publicar en la Web → elige la hoja → formato CSV → Publicar.)*
3. Copia la URL de la hoja (la de tu navegador, tal cual) y pégala en la app desde el icono ⚙ del panel de invitados.
4. Pulsa "Actualizar invitados".

La app detecta automáticamente columnas con nombres habituales en español o inglés: `Nombre`, `Apellidos`, `Nombre completo`, `Grupo`/`Familia`, `Acompañantes`, `Confirmado`/`Estado`, `Notas`, `Restricciones alimentarias`. No es necesario que la hoja tenga una estructura exacta; basta con que las cabeceras sean reconocibles.

Al volver a importar, la aplicación conserva las mesas/asientos ya asignados a los invitados que coincidan por nombre completo.

La hoja configurada por defecto en el proyecto es la indicada en el encargo original:
`https://docs.google.com/spreadsheets/d/17JddBH3Hp6IPow7tyCG3XGoUp9NXImiGKTZBBCeQAnY/edit`
— recuerda compartirla como "Cualquier persona con el enlace" para que la app pueda leerla.

## Despliegue en Cloudflare Pages

1. Sube el proyecto a un repositorio de GitHub (ver siguiente sección).
2. En el panel de Cloudflare, ve a **Workers & Pages → Create → Pages → Connect to Git** y selecciona el repositorio.
3. Configura:
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Framework preset:** Vite (opcional, Cloudflare lo detecta solo)
4. No hace falta configurar ninguna variable de entorno: la aplicación no usa claves ni secretos.
5. Despliega. Cloudflare te dará una URL tipo `https://tu-proyecto.pages.dev`.

**Nota sobre `wrangler.jsonc`:** el proyecto incluye este archivo para que, si Cloudflare despliega a través de su sistema moderno de *Workers Builds* (`wrangler deploy` en vez del Pages clásico), sirva directamente los activos estáticos de `dist` sin intentar auto-configurar un plugin de Vite para Workers (que requiere Vite 6+). Si ves un error del tipo *"The version of Vite used in the project (...) cannot be automatically configured"*, confirma que `wrangler.jsonc` está presente en la raíz del repositorio y vuelve a lanzar el despliegue.

## Subir el proyecto a GitHub

```bash
git init
git add .
git commit -m "Seating plan boda Mallorca"
git branch -M main
git remote add origin https://github.com/tu-usuario/tu-repositorio.git
git push -u origin main
```

El `.gitignore` incluido excluye `node_modules`, `dist` y cualquier archivo `.env`, por lo que el repositorio es seguro para hacerse público: no contiene credenciales.

## Uso de la aplicación

1. **Configura la sala**: en el panel derecho (sin ninguna mesa seleccionada), define anchura y longitud reales en metros.
2. **Importa invitados**: desde el panel izquierdo, pulsa "Actualizar invitados" (Google Sheets) o "Cargar datos de ejemplo" para probar sin conexión.
3. **Crea mesas**: botones "Redonda" / "Rectangular" en el panel derecho. Se colocan en el centro de la sala.
4. **Colócalas**: arrastra cada mesa directamente sobre el plano. Doble clic abre su vista ampliada con todos los asientos.
5. **Asigna invitados**: arrastra un invitado de la lista hasta una mesa (o hasta un asiento concreto), o selecciona varios con Ctrl/Cmd+clic y usa "Asignar a mesa" en la barra que aparece.
6. **Revisa avisos**: el panel derecho muestra automáticamente mesas con exceso de aforo, solapamientos, mesas fuera de la sala, invitados duplicados o incompatibilidades entre invitados sentados juntos.
7. **Prueba variantes**: duplica el escenario actual desde el selector superior y modifica la copia libremente.
8. **Presenta, analiza o exporta**: cambia a modo "Presentación" para una vista limpia, pulsa "🤖 Analizar con IA" para una valoración profesional del escenario, o usa el menú "Exportar" del cabecero.

Atajos de teclado: `Ctrl/Cmd+Z` deshacer, `Ctrl/Cmd+Shift+Z` (o `Ctrl+Y`) rehacer, `Supr`/`Backspace` elimina la mesa o el elemento de sala seleccionado.

## Exportación e importación

- **Imagen / PDF del plano**: diálogo con vista previa, elección de resolución (estándar/alta/máxima) para el PNG, exportación a **PDF vectorial** real (texto nítido a cualquier zoom), y casilla para mostrar el nombre completo del invitado en vez de iniciales.
- **Invitados (CSV)**: listado completo con su mesa, asiento, rol y notas.
- **Escenario (JSON)**: sala, mesas, elementos de sala e invitados asignados del escenario activo.
- **Imprimir plano**: abre el diálogo de impresión del navegador con un CSS específico que oculta los paneles de edición.
- **Proyecto completo (.json)**: descarga todo el proyecto (todos los escenarios, invitados, grupos, incompatibilidades) para guardarlo como copia de seguridad. Nunca incluye tu clave de API de IA, que se guarda aparte solo en tu navegador.
- **Importar proyecto**: recupera un archivo `.json` exportado previamente, sustituyendo el proyecto actual.

## Limitaciones conocidas

- El **modo oscuro** no está implementado intencionadamente: la estética de cal y piedra mallorquina está pensada para tema claro.
- La **distribución automática** evita incompatibilidades cuando es posible, pero es intencionadamente sencilla (aleatoria, por grupo, equilibrada); no resuelve casos imposibles (más incompatibilidades que mesas disponibles) ni optimiza más allá de eso.
- El **análisis con IA** requiere que cada persona aporte su propia clave de API de Anthropic (ver sección correspondiente); no hay ninguna clave compartida incluida en la aplicación.
- El guardado y el historial de deshacer/rehacer son **locales al navegador** (localStorage): si cambias de navegador o de dispositivo, usa "Exportar proyecto" / "Importar proyecto" para trasladar tu trabajo.
- En **móvil**, el editor de plano es usable pero la experiencia está optimizada primero para escritorio y tablet, como se priorizó en el encargo.

## Próximas mejoras posibles

- Reglas de incompatibilidad entre invitados (p. ej. "no sentar juntos") consideradas en la distribución automática.
- Historial de cambios persistente entre sesiones (actualmente el deshacer/rehacer se reinicia al recargar la página).
- Exportación a PDF vectorial real mediante una librería dedicada, si se asume el coste adicional en tamaño de bundle.
- Vista cenital detallada por mesa con edición de orden de asientos por arrastre dentro de la propia mesa.
