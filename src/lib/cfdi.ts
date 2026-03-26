/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface CFDIConcept {
  descripcion: string;
  cantidad: number;
  valorUnitario: number;
  importe: number;
  importeCalculado: number;
  diferencia: number;
  claveProdServ: string;
  impuestos: CFDIImpuesto[];
}

export interface CFDIImpuesto {
  tipo: 'Traslado' | 'Retencion';
  impuesto: string;
  base: number;
  tipoFactor: string;
  tasaOCuota: number;
  importe: number;
  importeCalculado: number;
  diferencia: number;
}

export interface AuditFinding {
  id: string;
  severity: 'critical' | 'warning';
  title: string;
  summary: string;
}

export interface TaxAuditGroup {
  key: string;
  impuesto: string;
  tipoFactor: string;
  tasaOCuota: number;
  importeDetalle: number;
  importeAgrupado: number;
  diferencia: number;
  conceptos: number[];
}

export interface CFDIData {
  version: string;
  fecha: string;
  uuid: string;
  emisor: string;
  receptor: string;
  subtotal: number;
  descuento: number;
  total: number;
  conceptos: CFDIConcept[];
  impuestosGlobales: CFDIImpuesto[];
  subtotalCalculado: number;
  totalCalculado: number;
  hallazgos: string[];
  findings: AuditFinding[];
  impactedConceptIndexes: number[];
  taxAuditGroups: TaxAuditGroup[];
  verdict: {
    status: 'clean' | 'review' | 'critical';
    title: string;
    summary: string;
  };
  supportText: string;
}

function summarizeDifference(xmlValue: number, calcValue: number) {
  return `XML ${xmlValue.toFixed(2)} vs cálculo ${calcValue.toFixed(2)}.`;
}

export function parseCFDI(xmlString: string): CFDIData {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, "text/xml");
  
  const ns = {
    cfdi: "http://www.sat.gob.mx/cfdv4",
    tfd: "http://www.sat.gob.mx/TimbreFiscalDigital"
  };

  const getAttr = (el: Element | null, name: string) => el?.getAttribute(name) || "";
  const getNum = (el: Element | null, name: string) => parseFloat(el?.getAttribute(name) || "0");

  const comprobante = xmlDoc.getElementsByTagNameNS("*", "Comprobante")[0];
  const emisorEl = xmlDoc.getElementsByTagNameNS("*", "Emisor")[0];
  const receptorEl = xmlDoc.getElementsByTagNameNS("*", "Receptor")[0];
  const timbreEl = xmlDoc.getElementsByTagNameNS("*", "TimbreFiscalDigital")[0];

  const data: CFDIData = {
    version: getAttr(comprobante, "Version"),
    fecha: getAttr(comprobante, "Fecha"),
    uuid: getAttr(timbreEl, "UUID"),
    emisor: getAttr(emisorEl, "Nombre") || getAttr(emisorEl, "Rfc"),
    receptor: getAttr(receptorEl, "Nombre") || getAttr(receptorEl, "Rfc"),
    subtotal: getNum(comprobante, "SubTotal"),
    descuento: getNum(comprobante, "Descuento"),
    total: getNum(comprobante, "Total"),
    conceptos: [],
    impuestosGlobales: [],
    subtotalCalculado: 0,
    totalCalculado: 0,
    hallazgos: [],
    findings: [],
    impactedConceptIndexes: [],
    taxAuditGroups: [],
    verdict: {
      status: 'clean',
      title: 'Sin discrepancias detectadas',
      summary: 'Los importes principales cuadran con el cálculo actual.',
    },
    supportText: ''
  };

  // Parse Conceptos
  const conceptosNodes = xmlDoc.getElementsByTagNameNS("*", "Concepto");
  for (let i = 0; i < conceptosNodes.length; i++) {
    const node = conceptosNodes[i];
    const cantidad = getNum(node, "Cantidad");
    const valorUnitario = getNum(node, "ValorUnitario");
    const importe = getNum(node, "Importe");
    
    // Recalcular importe (con precisión de 6 decimales para comparación)
    const importeCalculado = Number((cantidad * valorUnitario).toFixed(6));
    const diff = Math.abs(importe - (cantidad * valorUnitario));

    const concepto: CFDIConcept = {
      descripcion: getAttr(node, "Descripcion"),
      cantidad,
      valorUnitario,
      importe,
      importeCalculado,
      diferencia: diff,
      claveProdServ: getAttr(node, "ClaveProdServ"),
      impuestos: []
    };

    // Impuestos del concepto
    const traslados = node.getElementsByTagNameNS("*", "Traslado");
    for (let j = 0; j < traslados.length; j++) {
      const t = traslados[j];
      const base = getNum(t, "Base");
      const tasa = getNum(t, "TasaOCuota");
      const imp = getNum(t, "Importe");
      const impCalc = Number((base * tasa).toFixed(6));
      
      concepto.impuestos.push({
        tipo: 'Traslado',
        impuesto: getAttr(t, "Impuesto"),
        base,
        tipoFactor: getAttr(t, "TipoFactor"),
        tasaOCuota: tasa,
        importe: imp,
        importeCalculado: impCalc,
        diferencia: Math.abs(imp - (base * tasa))
      });
    }

    data.conceptos.push(concepto);
    data.subtotalCalculado += concepto.importe;
  }

  // Impuestos Globales
  const impuestosGlobalesNodes = xmlDoc.getElementsByTagNameNS("*", "Impuestos");
  // Buscamos el nodo de impuestos que es hijo directo de Comprobante
  for (let i = 0; i < impuestosGlobalesNodes.length; i++) {
    if (impuestosGlobalesNodes[i].parentElement === comprobante) {
      const traslados = impuestosGlobalesNodes[i].getElementsByTagNameNS("*", "Traslado");
      for (let j = 0; j < traslados.length; j++) {
        const t = traslados[j];
        data.impuestosGlobales.push({
          tipo: 'Traslado',
          impuesto: getAttr(t, "Impuesto"),
          base: getNum(t, "Base"),
          tipoFactor: getAttr(t, "TipoFactor"),
          tasaOCuota: getNum(t, "TasaOCuota"),
          importe: getNum(t, "Importe"),
          importeCalculado: 0, // No aplica directo aquí sin sumar conceptos
          diferencia: 0
        });
      }
    }
  }

  // Validaciones Finales
  if (Math.abs(data.subtotalCalculado - data.subtotal) !== 0) {
    const summary = `XML declara ${data.subtotal.toFixed(2)} y la suma de conceptos da ${data.subtotalCalculado.toFixed(2)}.`;
    data.hallazgos.push(`Discrepancia en Subtotal: ${summary}`);
    data.findings.push({
      id: 'subtotal',
      severity: 'critical',
      title: 'Discrepancia en subtotal',
      summary,
    });
  }

  const sumaTraslados = data.impuestosGlobales.reduce((acc, curr) => acc + curr.importe, 0);
  data.totalCalculado = data.subtotal - data.descuento + sumaTraslados;

  if (Math.abs(data.totalCalculado - data.total) !== 0) {
    const summary = `XML declara ${data.total.toFixed(2)} y el cálculo manual da ${data.totalCalculado.toFixed(2)}.`;
    data.hallazgos.push(`Discrepancia en Total: ${summary}`);
    data.findings.push({
      id: 'total',
      severity: 'critical',
      title: 'Discrepancia en total',
      summary,
    });
  }

  const conceptWarnings = data.conceptos
    .map((concepto, index) => ({ concepto, index }))
    .filter(({ concepto }) => concepto.diferencia !== 0)
    .sort((a, b) => b.concepto.diferencia - a.concepto.diferencia)
    .slice(0, 3);

  conceptWarnings.forEach(({ concepto, index }) => {
    const summary = `${concepto.descripcion}: ${summarizeDifference(concepto.importe, concepto.importeCalculado)}`;
    data.findings.push({
      id: `concept-${index}`,
      severity: concepto.diferencia > 0.01 ? 'critical' : 'warning',
      title: `Importe inconsistente en concepto ${index + 1}`,
      summary,
    });
    if (!data.impactedConceptIndexes.includes(index)) {
      data.impactedConceptIndexes.push(index);
    }
  });

  const taxWarnings = data.conceptos
    .flatMap((concepto, conceptIndex) =>
      concepto.impuestos.map((impuesto, taxIndex) => ({ concepto, impuesto, conceptIndex, taxIndex }))
    )
    .filter(({ impuesto }) => impuesto.diferencia !== 0)
    .sort((a, b) => b.impuesto.diferencia - a.impuesto.diferencia)
    .slice(0, 3);

  taxWarnings.forEach(({ concepto, impuesto, conceptIndex, taxIndex }) => {
    const summary = `${concepto.descripcion}: traslado ${impuesto.impuesto} ${summarizeDifference(impuesto.importe, impuesto.importeCalculado)}`;
    data.findings.push({
      id: `tax-${conceptIndex}-${taxIndex}`,
      severity: impuesto.diferencia > 0.01 ? 'critical' : 'warning',
      title: `Traslado inconsistente en concepto ${conceptIndex + 1}`,
      summary,
    });
    if (!data.impactedConceptIndexes.includes(conceptIndex)) {
      data.impactedConceptIndexes.push(conceptIndex);
    }
  });

  data.impactedConceptIndexes.sort((a, b) => a - b);

  const taxGroupMap = new Map<string, TaxAuditGroup>();

  data.conceptos.forEach((concepto, conceptIndex) => {
    concepto.impuestos.forEach((impuesto) => {
      const key = `${impuesto.impuesto}|${impuesto.tipoFactor}|${impuesto.tasaOCuota}`;
      const current = taxGroupMap.get(key) ?? {
        key,
        impuesto: impuesto.impuesto,
        tipoFactor: impuesto.tipoFactor,
        tasaOCuota: impuesto.tasaOCuota,
        importeDetalle: 0,
        importeAgrupado: 0,
        diferencia: 0,
        conceptos: [],
      };

      current.importeDetalle += impuesto.importe;
      if (!current.conceptos.includes(conceptIndex)) {
        current.conceptos.push(conceptIndex);
      }
      taxGroupMap.set(key, current);
    });
  });

  data.impuestosGlobales.forEach((impuesto) => {
    const key = `${impuesto.impuesto}|${impuesto.tipoFactor}|${impuesto.tasaOCuota}`;
    const current = taxGroupMap.get(key) ?? {
      key,
      impuesto: impuesto.impuesto,
      tipoFactor: impuesto.tipoFactor,
      tasaOCuota: impuesto.tasaOCuota,
      importeDetalle: 0,
      importeAgrupado: 0,
      diferencia: 0,
      conceptos: [],
    };

    current.importeAgrupado += impuesto.importe;
    taxGroupMap.set(key, current);
  });

  data.taxAuditGroups = Array.from(taxGroupMap.values())
    .map((group) => ({
      ...group,
      diferencia: group.importeAgrupado - group.importeDetalle,
    }))
    .sort((a, b) => Math.abs(b.diferencia) - Math.abs(a.diferencia));

  data.taxAuditGroups
    .filter((group) => Math.abs(group.diferencia) !== 0)
    .slice(0, 3)
    .forEach((group) => {
      data.findings.push({
        id: `tax-group-${group.key}`,
        severity: Math.abs(group.diferencia) > 0.01 ? 'critical' : 'warning',
        title: `Diferencia en traslado ${group.impuesto} ${(group.tasaOCuota * 100).toFixed(2)}%`,
        summary: `Detalle ${group.importeDetalle.toFixed(2)} vs agrupado ${group.importeAgrupado.toFixed(2)}.`,
      });

      group.conceptos.forEach((index) => {
        if (!data.impactedConceptIndexes.includes(index)) {
          data.impactedConceptIndexes.push(index);
        }
      });
    });

  data.impactedConceptIndexes.sort((a, b) => a - b);

  if (data.findings.length === 0 && data.hallazgos.length === 0) {
    data.hallazgos = [];
  }

  const uniqueFindings = new Map<string, AuditFinding>();
  data.findings.forEach((finding) => {
    const key = `${finding.severity}|${finding.title}|${finding.summary}`;
    if (!uniqueFindings.has(key)) {
      uniqueFindings.set(key, finding);
    }
  });

  data.findings = Array.from(uniqueFindings.values()).sort((a, b) => {
    if (a.severity !== b.severity) {
      return a.severity === 'critical' ? -1 : 1;
    }
    return a.title.localeCompare(b.title, 'es');
  });

  const criticalFindings = data.findings.filter((finding) => finding.severity === 'critical').length;
  const warningFindings = data.findings.filter((finding) => finding.severity === 'warning').length;

  if (criticalFindings > 0) {
    data.verdict = {
      status: 'critical',
      title: 'CFDI con discrepancias críticas',
      summary: `Se detectaron ${criticalFindings} hallazgo(s) críticos que requieren revisión operativa.`,
    };
  } else if (warningFindings > 0) {
    data.verdict = {
      status: 'review',
      title: 'CFDI requiere revisión',
      summary: `Hay ${warningFindings} alerta(s) menores, probablemente asociadas a redondeo o captura.`,
    };
  }

  data.supportText = [
    data.verdict.title,
    data.verdict.summary,
    ...data.findings.slice(0, 5).map((finding) => `${finding.title}: ${finding.summary}`),
  ].join('\n');

  return data;
}
