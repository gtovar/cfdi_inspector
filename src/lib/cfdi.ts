/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { buildCfdiData, detectCfdiProfile } from '../cfdi/application/cfdiAnalysisService';

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

export function parseCFDI(xmlString: string): CFDIData {
  return buildCfdiData(xmlString);
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
  try {
    return detectCfdiProfile(xmlString);
  } catch {
    return 'unknown';
  }
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
