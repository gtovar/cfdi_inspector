import { useState } from 'react';
import type { CFDIData, CFDIIngresoRow, CFDIPagoRow, CFDIProfile } from '../../cfdi/public';
import { analyzeCFDIWithWorker } from '../../lib/cfdi-worker-client';

export function useCfdiAnalysis() {
  const [profile, setProfile] = useState<CFDIProfile>('unknown');
  const [cfdi, setCfdi] = useState<CFDIData | null>(null);
  const [ingresoRows, setIngresoRows] = useState<CFDIIngresoRow[]>([]);
  const [pagoRows, setPagoRows] = useState<CFDIPagoRow[]>([]);
  const [analysisEngine, setAnalysisEngine] = useState<'idle' | 'worker' | 'fallback'>('idle');
  const [analysisReason, setAnalysisReason] = useState('');
  const [analysisStageLabel, setAnalysisStageLabel] = useState('Analizando estructura CFDI');
  const [analysisStageProgress, setAnalysisStageProgress] = useState(100);
  const [analysisStageDetail, setAnalysisStageDetail] = useState('');
  const [sourceXml, setSourceXml] = useState('');

  async function handleFileSelect(
    xml: string,
    options?: {
      onBeforeApply?: (nextProfile: CFDIProfile) => void;
      onAfterApply?: () => void;
    },
  ) {
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 0));
      const { bundle, engine, reason } = await analyzeCFDIWithWorker(xml, ({ label, progress, detail }) => {
        setAnalysisStageLabel(label);
        setAnalysisStageProgress(progress);
        setAnalysisStageDetail(detail ?? '');
      });

      options?.onBeforeApply?.(bundle.profile);

      setSourceXml(xml);
      setCfdi(bundle.cfdi);
      setIngresoRows(bundle.ingresoRows);
      setPagoRows(bundle.pagoRows);
      setProfile(bundle.profile);
      setAnalysisEngine(engine);
      setAnalysisReason(reason ?? '');
      setAnalysisStageLabel('Analizando estructura CFDI');
      setAnalysisStageProgress(100);
      setAnalysisStageDetail('');

      options?.onAfterApply?.();
    } catch (error) {
      console.error('Error parsing CFDI:', error);
      alert('Error al procesar el XML. Asegúrate de que sea un CFDI válido.');
    }
  }

  function resetAnalysis() {
    setCfdi(null);
    setIngresoRows([]);
    setPagoRows([]);
    setSourceXml('');
    setProfile('unknown');
    setAnalysisEngine('idle');
    setAnalysisReason('');
    setAnalysisStageLabel('Analizando estructura CFDI');
    setAnalysisStageProgress(100);
    setAnalysisStageDetail('');
  }

  return {
    profile,
    cfdi,
    ingresoRows,
    pagoRows,
    analysisEngine,
    analysisReason,
    analysisStageLabel,
    analysisStageProgress,
    analysisStageDetail,
    sourceXml,
    handleFileSelect,
    resetAnalysis,
  };
}
