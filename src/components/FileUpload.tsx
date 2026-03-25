/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { Upload, FileText, X } from 'lucide-react';
import { motion } from 'motion/react';

interface FileUploadProps {
  onFileSelect: (xml: string) => void;
}

export default function FileUpload({ onFileSelect }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (file && file.type === "text/xml" || file.name.endsWith(".xml")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        onFileSelect(content);
      };
      reader.readAsText(file);
    } else {
      alert("Por favor sube un archivo XML válido.");
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative border-2 border-dashed rounded-xl p-12 transition-all duration-300 flex flex-col items-center justify-center cursor-pointer
        ${isDragging ? 'border-blue-500 bg-blue-50/50' : 'border-gray-300 hover:border-gray-400 bg-white'}`}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={onDrop}
      onClick={() => fileInputRef.current?.click()}
    >
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept=".xml"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
      
      <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
        <Upload className="text-blue-600 w-8 h-8" />
      </div>
      
      <h3 className="text-lg font-semibold text-gray-900 mb-2">Cargar XML de Factura</h3>
      <p className="text-sm text-gray-500 text-center max-w-xs">
        Arrastra tu archivo CFDI aquí o haz clic para buscar en tu equipo.
      </p>
      
      <div className="mt-6 flex items-center gap-2 text-xs font-mono text-gray-400">
        <FileText size={14} />
        <span>Soporta CFDI 3.3 y 4.0</span>
      </div>
    </motion.div>
  );
}
