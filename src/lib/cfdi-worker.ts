import { detectCFDIProfileWorker, parseCFDIWorker, extractIngresoRowsWorker, extractPagoRowsWorker } from './cfdi-worker-analysis';

function projectProgress(start: number, end: number, stepProgress: number) {
  return Math.round(start + ((end - start) * stepProgress) / 100);
}

self.onmessage = async (event: MessageEvent<{ xml: string }>) => {
  try {
    const { xml } = event.data;
    self.postMessage({ progress: 8, label: 'Detectando perfil CFDI', detail: 'Leyendo estructura base del comprobante.' });
    const profile = detectCFDIProfileWorker(xml);

    self.postMessage({ progress: 28, label: 'Calculando diagnóstico fiscal', detail: `Perfil detectado: ${profile}.` });
    const cfdi = parseCFDIWorker(xml);

    self.postMessage({
      progress: 56,
      label: 'Extrayendo filas de ingresos',
      detail: `${cfdi.conceptos.length.toLocaleString('es-MX')} conceptos detectados · ${cfdi.findings.length.toLocaleString('es-MX')} hallazgos.`,
    });
    const ingresoRows = extractIngresoRowsWorker(xml, (stepProgress, detail) => {
      self.postMessage({
        progress: projectProgress(56, 84, stepProgress),
        label: 'Extrayendo filas de ingresos',
        detail,
      });
    });

    self.postMessage({
      progress: 84,
      label: 'Extrayendo filas de pagos',
      detail: `${ingresoRows.length.toLocaleString('es-MX')} filas de ingresos listas.`,
    });
    let pagoRows = [] as ReturnType<typeof extractPagoRowsWorker>;
    try {
      pagoRows = extractPagoRowsWorker(xml, (stepProgress, detail) => {
        self.postMessage({
          progress: projectProgress(84, 96, stepProgress),
          label: 'Extrayendo filas de pagos',
          detail,
        });
      });
    } catch {
      pagoRows = [];
    }

    const finalDetail =
      profile === 'pagos'
        ? `Filas: ${pagoRows.length.toLocaleString('es-MX')}`
        : `Filas: ${ingresoRows.length.toLocaleString('es-MX')}`;

    self.postMessage({
      progress: 96,
      label: 'Consolidando resultados del archivo',
      detail: finalDetail,
    });
    const result = { profile, cfdi, ingresoRows, pagoRows };
    self.postMessage({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido al analizar CFDI';
    self.postMessage({ ok: false, error: message });
  }
};

export {};
