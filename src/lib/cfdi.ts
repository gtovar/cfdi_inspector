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
    hallazgos: []
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
  if (Math.abs(data.subtotalCalculado - data.subtotal) > 0.01) {
    data.hallazgos.push(`Discrepancia en Subtotal: XML declara ${data.subtotal}, suma de conceptos da ${data.subtotalCalculado.toFixed(2)}`);
  }

  const sumaTraslados = data.impuestosGlobales.reduce((acc, curr) => acc + curr.importe, 0);
  data.totalCalculado = data.subtotal - data.descuento + sumaTraslados;

  if (Math.abs(data.totalCalculado - data.total) > 0.01) {
    data.hallazgos.push(`Discrepancia en Total: XML declara ${data.total}, cálculo manual da ${data.totalCalculado.toFixed(2)}`);
  }

  return data;
}
