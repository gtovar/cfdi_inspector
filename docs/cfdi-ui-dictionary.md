# CFDI UI Dictionary

## 1. Propósito
Este documento define cómo la app interpreta y muestra campos fiscales del CFDI.
La verdad sale del XML CFDI y de los catálogos SAT, no de inferencia textual.

## 2. Alcance v0
Este diccionario no cubre todo CFDI.
Cubre únicamente:
- Comprobante
- Conceptos
- Impuestos por concepto
- Resumen global de impuestos

## 3. Principios
- No inferir impuestos desde descripción comercial
- Leer siempre desde nodos y atributos fiscales
- Separar detalle por concepto vs resumen global
- Mostrar siempre valor crudo + explicación humana
- El diccionario UI debe corresponder al modelo canónico interno
- El contrato canónico v0 es tolerante a valores SAT inesperados; la validación estricta vive aparte

## 4. Términos operativos

### cfdi:Impuestos
- Qué existe realmente:
  Nodo fiscal que encapsula el detalle de impuestos aplicables a un concepto o el resumen global del comprobante.
- Qué significa en la app:
  Contenedor de líneas fiscales que la UI debe desglosar o agrupar según el nivel donde aparece.
- No confundir con:
  La descripción comercial del concepto ni una etiqueta libre como "IVA" escrita en texto.
- Cómo se muestra en UI:
  Como bloque de impuestos por concepto o como resumen agrupado del comprobante.

### cfdi:Traslado
- Qué existe realmente:
  Nodo que representa un impuesto trasladado, con atributos Base, Impuesto, TipoFactor, TasaOCuota e Importe.
- Qué significa en la app:
  Una línea fiscal positiva asociada a un concepto o al resumen global.
- No confundir con:
  Retenciones ni con el total de impuestos del comprobante.
- Cómo se muestra en UI:
  Como una fila con código, nombre del impuesto, base, tipo, tasa y monto.

### cfdi:Retencion
- Qué existe realmente:
  Nodo que representa un impuesto retenido, también con Base, Impuesto, TipoFactor, TasaOCuota e Importe.
- Qué significa en la app:
  Una línea fiscal retenida que se modela separada de los traslados.
- No confundir con:
  Traslados o descuentos comerciales.
- Cómo se muestra en UI:
  Como línea de retención dentro del concepto o del resumen, en una sección separada.

### Base
- Qué existe realmente:
  Atributo numérico del traslado o retención.
- Qué significa en la app:
  Monto sobre el que se calcula el impuesto.
- No confundir con:
  Importe del concepto completo ni subtotal global.
- Cómo se muestra en UI:
  Como valor monetario base del cálculo fiscal.

### Impuesto
- Qué existe realmente:
  Atributo codificado del SAT en la línea de impuesto.
- Qué significa en la app:
  Código fiscal crudo que debe mapearse a etiqueta humana.
- No confundir con:
  El nombre visual de la UI.
- Cómo se muestra en UI:
  Valor crudo y explicación humana. Ejemplo: `002 -> IVA`.

### TipoFactor
- Qué existe realmente:
  Atributo del SAT que indica cómo se aplica el impuesto.
- Qué significa en la app:
  Regla de cálculo de la línea fiscal.
- No confundir con:
  La tasa en sí misma.
- Cómo se muestra en UI:
  Como `Tasa`, `Cuota` o `Exento`, acompañado de su explicación.

### TasaOCuota
- Qué existe realmente:
  Atributo numérico del SAT que guarda la tasa o cuota aplicable.
- Qué significa en la app:
  Valor técnico de porcentaje o cuota fija.
- No confundir con:
  El importe final del impuesto.
- Cómo se muestra en UI:
  Valor crudo y traducción humana. Ejemplo: `0.160000 -> 16%`.

### Importe
- Qué existe realmente:
  Atributo numérico del traslado o retención.
- Qué significa en la app:
  Resultado monetario del impuesto.
- No confundir con:
  Base ni importe del concepto.
- Cómo se muestra en UI:
  Como monto fiscal calculado o declarado.

### ObjetoImp
- Qué existe realmente:
  Atributo del concepto que indica tratamiento fiscal respecto del impuesto.
- Qué significa en la app:
  Señal operativa para saber si el concepto debe o no traer desglose fiscal.
- No confundir con:
  La presencia automática de un IVA visible en el XML.
- Cómo se muestra en UI:
  Como código SAT y etiqueta explicativa.

### Desglose
- Qué existe realmente:
  Nivel detalle de impuestos dentro de cada concepto.
- Qué significa en la app:
  Vista granular del impuesto por renglón.
- No confundir con:
  El resumen global del comprobante.
- Cómo se muestra en UI:
  Tabla por concepto con una o varias líneas fiscales.

### Agrupado
- Qué existe realmente:
  Resumen global del comprobante agrupado por Impuesto, TipoFactor y TasaOCuota.
- Qué significa en la app:
  Consolidado fiscal para comparación contra el detalle por concepto.
- No confundir con:
  El desglose por concepto.
- Cómo se muestra en UI:
  Tabla resumen de traslados o retenciones agrupadas.

## 5. Reglas de interpretación UI
- `001 = ISR`
- `002 = IVA`
- `003 = IEPS`
- `Tasa = porcentaje aplicado sobre la base`
- `Cuota = cuota fija`
- `Exento = sin impuesto trasladado`

## 6. Separación estructural

### Detalle por concepto
Es el nivel donde la app explica qué impuesto aplica a cada renglón del CFDI.
Aquí viven `ObjetoImp`, `cfdi:Impuestos`, `cfdi:Traslados` y `cfdi:Retenciones` dentro del concepto.

### Resumen global del comprobante
Es el nivel donde la app resume y compara el total fiscal agrupado del comprobante.
Aquí viven los impuestos consolidados por combinación de impuesto, tipo factor y tasa o cuota.

## 7. Fuera de alcance v0
- Complementos complejos
- Nómina completa
- Pagos 2.0 completo
- Validación SAT exhaustiva

## 8. Relación con código
- `normalizeCfdi()`
- `cfdiCatalogs`
- `explainCfdiField()`
- `diagnoseCfdiMath()`

## 9. Decisiones del contrato técnico v0
- `CanonicalCfdi` debe modelar tanto detalle por concepto como `resumenImpuestos`
- El contrato canónico v0 es tolerante: `impuesto` y `tipoFactor` se modelan como `string | null`
- Los catálogos SAT siguen siendo estrictos en la capa de interpretación UI
- Antes de cerrar `diagnoseCfdiMath()`, se debe decidir cómo convivirán valor crudo XML y valor numérico parseado
