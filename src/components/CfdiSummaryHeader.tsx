import type { LucideIcon } from 'lucide-react';

export interface SummaryFieldCard {
  key: string;
  label: string;
  value: string;
  icon: LucideIcon;
  meaning?: string;
}

interface CfdiSummaryHeaderProps {
  summaryFields: SummaryFieldCard[];
}

export default function CfdiSummaryHeader({ summaryFields }: CfdiSummaryHeaderProps) {
  return (
    <div className={`grid border-b border-[#141414] ${summaryFields.length >= 4 ? 'grid-cols-4' : 'grid-cols-3'}`}>
      {summaryFields.map((field, index) => {
        const Icon = field.icon;
        return (
          <div
            key={field.key}
            className={`p-4 flex items-start gap-3 ${index < summaryFields.length - 1 ? 'border-r border-[#141414]' : ''}`}
            title={field.meaning}
          >
            <Icon size={16} className="opacity-50 mt-1" />
            <div>
              <p className="text-[10px] font-mono uppercase opacity-50">{field.label}</p>
              <p className="text-xs font-bold truncate max-w-[200px]">{field.value}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
