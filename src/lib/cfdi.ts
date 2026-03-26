/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { enrichCfdiWithMathDiagnosis } from './cfdi-domain-adapter';

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

export interface CFDIIngresoRow {
  uuid: string;
  fecha: string;
  serie: string;
  folio: string;
  rfcEmisor: string;
  nombreEmisor: string;
  rfcReceptor: string;
  nombreReceptor: string;
  usoCfdi: string;
  metodoPago: string;
  formaPago: string;
  moneda: string;
  tipoCambio: string;
  subtotal: string;
  descuento: string;
  total: string;
  claveProdServ: string;
  cantidad: string;
  descripcion: string;
  valorUnitario: string;
  importe: string;
  objetoImp: string;
  tipoImp: string;
  baseImp: string;
  impuesto: string;
  tipoFactor: string;
  tasaCuota: string;
  importeImp: string;
}

export interface CFDIPagoRow {
  uuidCFDI: string;
  fechaCFDI: string;
  rfcEmisor: string;
  rfcReceptor: string;
  fechaPago: string;
  formaPago: string;
  monedaP: string;
  monto: string;
  uuidDR: string;
  serieFolio: string;
  parcialidad: string;
  impPagado: string;
  saldoInsoluto: string;
  baseDR: string;
  impuestoDR: string;
  tipoFactorDR: string;
  tasaCuotaDR: string;
  importeDR: string;
}

export type CFDIProfile = 'ingreso' | 'pagos' | 'unknown';

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

export interface CFDIAnalysisBundle {
  profile: CFDIProfile;
  cfdi: CFDIData;
  ingresoRows: CFDIIngresoRow[];
  pagoRows: CFDIPagoRow[];
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

  const sumaTraslados = data.impuestosGlobales.reduce((acc, curr) => acc + curr.importe, 0);
  data.totalCalculado = data.subtotal - data.descuento + sumaTraslados;
  enrichCfdiWithMathDiagnosis(data);

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

export function extractIngresoRows(xmlString: string): CFDIIngresoRow[] {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
  const parseError = xmlDoc.querySelector('parsererror');

  if (parseError) {
    throw new Error('XML inválido');
  }

  const getAttr = (el: Element | null, name: string) => el?.getAttribute(name) || '';
  const getNodes = (parent: Document | Element, localName: string) =>
    Array.from(parent.getElementsByTagNameNS('*', localName));

  const root = xmlDoc.documentElement;
  const timbre = getNodes(root, 'TimbreFiscalDigital')[0] ?? null;
  const emisor = getNodes(root, 'Emisor')[0] ?? null;
  const receptor = getNodes(root, 'Receptor')[0] ?? null;
  const conceptos = getNodes(root, 'Concepto');

  if (conceptos.length === 0) {
    throw new Error('No se encontraron conceptos');
  }

  const baseRow = {
    uuid: getAttr(timbre, 'UUID'),
    fecha: getAttr(root, 'Fecha'),
    serie: getAttr(root, 'Serie'),
    folio: getAttr(root, 'Folio'),
    rfcEmisor: getAttr(emisor, 'Rfc'),
    nombreEmisor: getAttr(emisor, 'Nombre'),
    rfcReceptor: getAttr(receptor, 'Rfc'),
    nombreReceptor: getAttr(receptor, 'Nombre'),
    usoCfdi: getAttr(receptor, 'UsoCFDI'),
    metodoPago: getAttr(root, 'MetodoPago'),
    formaPago: getAttr(root, 'FormaPago'),
    moneda: getAttr(root, 'Moneda'),
    tipoCambio: getAttr(root, 'TipoCambio'),
    subtotal: getAttr(root, 'SubTotal'),
    descuento: getAttr(root, 'Descuento'),
    total: getAttr(root, 'Total'),
  };

  const rows: CFDIIngresoRow[] = [];

  for (const concepto of conceptos) {
    const conceptBase = {
      ...baseRow,
      claveProdServ: getAttr(concepto, 'ClaveProdServ'),
      cantidad: getAttr(concepto, 'Cantidad'),
      descripcion: getAttr(concepto, 'Descripcion'),
      valorUnitario: getAttr(concepto, 'ValorUnitario'),
      importe: getAttr(concepto, 'Importe'),
      objetoImp: getAttr(concepto, 'ObjetoImp'),
    };

    const traslados = getNodes(concepto, 'Traslado');
    const retenciones = getNodes(concepto, 'Retencion');

    if (traslados.length === 0 && retenciones.length === 0) {
      rows.push({
        ...conceptBase,
        tipoImp: '',
        baseImp: '',
        impuesto: '',
        tipoFactor: '',
        tasaCuota: '',
        importeImp: '',
      });
      continue;
    }

    traslados.forEach((tax) => {
      rows.push({
        ...conceptBase,
        tipoImp: 'Traslado',
        baseImp: getAttr(tax, 'Base'),
        impuesto: getAttr(tax, 'Impuesto'),
        tipoFactor: getAttr(tax, 'TipoFactor'),
        tasaCuota: getAttr(tax, 'TasaOCuota'),
        importeImp: getAttr(tax, 'Importe'),
      });
    });

    retenciones.forEach((tax) => {
      rows.push({
        ...conceptBase,
        tipoImp: 'Retención',
        baseImp: getAttr(tax, 'Base'),
        impuesto: getAttr(tax, 'Impuesto'),
        tipoFactor: getAttr(tax, 'TipoFactor'),
        tasaCuota: getAttr(tax, 'TasaOCuota'),
        importeImp: getAttr(tax, 'Importe'),
      });
    });
  }

  return rows;
}

export function extractPagoRows(xmlString: string): CFDIPagoRow[] {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
  const parseError = xmlDoc.querySelector('parsererror');

  if (parseError) {
    throw new Error('XML inválido');
  }

  const getAttr = (el: Element | null, name: string) => el?.getAttribute(name) || '';
  const getElementsByLocalName = (parent: Document | Element, localName: string) => {
    const result: Element[] = [];
    const traverse = (node: Element | Document) => {
      const children = node instanceof Document ? [node.documentElement] : Array.from(node.children);
      children.forEach((child) => {
        if (!child) return;
        const nodeName = child.localName || child.nodeName.split(':').pop();
        if (nodeName === localName) {
          result.push(child);
        }
        traverse(child);
      });
    };
    traverse(parent);
    return result;
  };

  const root = xmlDoc.documentElement;
  const timbres = getElementsByLocalName(root, 'TimbreFiscalDigital');
  const emisores = getElementsByLocalName(root, 'Emisor');
  const receptores = getElementsByLocalName(root, 'Receptor');
  const complementos = getElementsByLocalName(root, 'Complemento');

  const uuidCFDI = timbres.length > 0 ? getAttr(timbres[0], 'UUID') : '';
  const fechaCFDI = getAttr(root, 'Fecha');
  const rfcEmisor = emisores.length > 0 ? getAttr(emisores[0], 'Rfc') : '';
  const rfcReceptor = receptores.length > 0 ? getAttr(receptores[0], 'Rfc') : '';

  const registros: CFDIPagoRow[] = [];

  complementos.forEach((complemento) => {
    Array.from(complemento.children).forEach((child) => {
      const childName = child.localName || child.nodeName.split(':').pop();
      if (!childName.includes('Pagos')) return;

      const pagos = getElementsByLocalName(child, 'Pago');

      pagos.forEach((pago) => {
        const fechaPago = getAttr(pago, 'FechaPago');
        const formaPago = getAttr(pago, 'FormaDePagoP') || getAttr(pago, 'FormaPagoP');
        const monedaP = getAttr(pago, 'MonedaP');
        const monto = getAttr(pago, 'Monto');
        const doctos = getElementsByLocalName(pago, 'DoctoRelacionado');

        if (doctos.length === 0) {
          registros.push({
            uuidCFDI,
            fechaCFDI,
            rfcEmisor,
            rfcReceptor,
            fechaPago,
            formaPago,
            monedaP,
            monto,
            uuidDR: '',
            serieFolio: '',
            parcialidad: '',
            impPagado: '',
            saldoInsoluto: '',
            baseDR: '',
            impuestoDR: '',
            tipoFactorDR: '',
            tasaCuotaDR: '',
            importeDR: '',
          });
          return;
        }

        doctos.forEach((docto) => {
          const serie = getAttr(docto, 'Serie');
          const folio = getAttr(docto, 'Folio');
          const serieFolio = (serie || folio) ? `${serie || ''}${serie && folio ? '-' : ''}${folio || ''}` : 'N/A';

          const baseRow = {
            uuidCFDI,
            fechaCFDI,
            rfcEmisor,
            rfcReceptor,
            fechaPago,
            formaPago,
            monedaP,
            monto,
            uuidDR: getAttr(docto, 'IdDocumento'),
            serieFolio,
            parcialidad: getAttr(docto, 'NumParcialidad'),
            impPagado: getAttr(docto, 'ImpPagado'),
            saldoInsoluto: getAttr(docto, 'ImpSaldoInsoluto'),
          };

          const traslados = getElementsByLocalName(docto, 'TrasladoDR');
          const retenciones = getElementsByLocalName(docto, 'RetencionDR');

          if (traslados.length === 0 && retenciones.length === 0) {
            registros.push({
              ...baseRow,
              baseDR: '',
              impuestoDR: '',
              tipoFactorDR: '',
              tasaCuotaDR: '',
              importeDR: '',
            });
            return;
          }

          traslados.forEach((tax) => {
            registros.push({
              ...baseRow,
              baseDR: getAttr(tax, 'BaseDR'),
              impuestoDR: getAttr(tax, 'ImpuestoDR'),
              tipoFactorDR: getAttr(tax, 'TipoFactorDR'),
              tasaCuotaDR: getAttr(tax, 'TasaOCuotaDR'),
              importeDR: getAttr(tax, 'ImporteDR'),
            });
          });

          retenciones.forEach((tax) => {
            registros.push({
              ...baseRow,
              baseDR: getAttr(tax, 'BaseDR'),
              impuestoDR: getAttr(tax, 'ImpuestoDR'),
              tipoFactorDR: getAttr(tax, 'TipoFactorDR'),
              tasaCuotaDR: getAttr(tax, 'TasaOCuotaDR'),
              importeDR: getAttr(tax, 'ImporteDR'),
            });
          });
        });
      });
    });
  });

  if (registros.length === 0) {
    throw new Error('No se encontró el complemento de pagos o no hay pagos registrados');
  }

  return registros;
}

export function detectCFDIProfile(xmlString: string): CFDIProfile {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
  const parseError = xmlDoc.querySelector('parsererror');

  if (parseError) {
    return 'unknown';
  }

  const root = xmlDoc.documentElement;
  const getNodes = (parent: Document | Element, localName: string) =>
    Array.from(parent.getElementsByTagNameNS('*', localName));
  const getAttr = (el: Element | null, name: string) => el?.getAttribute(name) || '';

  const complementos = getNodes(root, 'Complemento');
  const pagosNodes = getNodes(root, 'Pago');
  const doctosRelacionados = getNodes(root, 'DoctoRelacionado');

  const hasPagosComplement = complementos.some((complemento) =>
    Array.from(complemento.children).some((child) => {
      const childName = child.localName || child.nodeName.split(':').pop() || '';
      return childName.includes('Pagos');
    })
  );

  if (hasPagosComplement || pagosNodes.length > 0 || doctosRelacionados.length > 0) {
    return 'pagos';
  }

  const tipoDeComprobante = getAttr(root, 'TipoDeComprobante');
  const conceptos = getNodes(root, 'Concepto');

  if (tipoDeComprobante === 'I' || conceptos.length > 0) {
    return 'ingreso';
  }

  return 'unknown';
}

export function analyzeCFDI(xmlString: string): CFDIAnalysisBundle {
  const profile = detectCFDIProfile(xmlString);
  const cfdi = parseCFDI(xmlString);
  const ingresoRows = extractIngresoRows(xmlString);

  let pagoRows: CFDIPagoRow[] = [];
  try {
    pagoRows = extractPagoRows(xmlString);
  } catch {
    pagoRows = [];
  }

  return {
    profile,
    cfdi,
    ingresoRows,
    pagoRows,
  };
}
