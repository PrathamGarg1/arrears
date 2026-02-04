'use client'

import { calculateArrears } from '@/lib/calculation-engine'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

interface CalculationGridProps {
  request: any
  payEvents: any[]
  daRates: any[]
}

export default function CalculationGrid({ request, payEvents, daRates }: CalculationGridProps) {
  const safeEvents = payEvents.map(p => ({
    ...p,
    date: new Date(p.date)
  }))
  
  const safeDARates = daRates.map(d => ({
    ...d,
    effectiveDate: new Date(d.effectiveDate)
  }))

  const segments = calculateArrears({
    startDate: new Date(request.startDate),
    endDate: new Date(request.endDate),
    payEvents: safeEvents,
    daRates: safeDARates
  })

  // Calculate Aggregates
  const totalArrear = segments.reduce((sum, seg) => sum + (seg.totalDue - seg.totalDrawn), 0)

  return (
    <div>
      <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-white">
      <div className="overflow-x-auto max-h-[600px] relative">
        <table className="min-w-full divide-y divide-slate-200 text-xs text-center border-collapse">
          <thead className="bg-slate-50 sticky top-0 z-10 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
            {/* Header Row 1: Groupings */}
            <tr>
              <th className="border-b border-r border-slate-200 px-3 py-2 sticky left-0 z-20 bg-slate-50 text-left text-slate-500 font-semibold w-[160px]">Period</th>
              <th className="border-b border-slate-200 px-2 py-1 font-semibold text-slate-500 bg-slate-50 sticky left-[160px] z-20 w-[100px]">Duration</th>
              <th colSpan={5} className="border-b border-r border-slate-200 px-2 py-2 font-bold text-slate-700 bg-slate-50/50">DUE (Revised)</th>
              <th colSpan={6} className="border-b border-r border-slate-200 px-2 py-2 font-bold text-slate-700 bg-slate-50/50">DRAWN (Old)</th>
              <th colSpan={3} className="border-b border-slate-200 px-2 py-2 font-bold text-slate-900 bg-slate-100">NET ARREAR</th>
            </tr>
            {/* Header Row 2: Columns */}
            <tr>
              <th className="border-b border-r border-slate-200 px-3 py-2 text-left bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 font-medium sticky left-0 z-20 top-[33px]">Dates</th>
              <th className="border-b border-slate-200 px-2 py-2 text-center bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 font-medium sticky left-[160px] z-20 top-[33px]">Months/Days</th>
              
              {/* DUE Columns */}
              <th className="border-b border-slate-200 px-2 py-2 text-right text-[10px] text-slate-400 font-medium">DA%</th>
              <th className="border-b border-slate-200 px-2 py-2 text-right text-[10px] text-slate-400 font-medium">Basic</th>
              <th className="border-b border-slate-200 px-2 py-2 text-right text-[10px] text-slate-400 font-medium">DA Amt</th>
              <th className="border-b border-slate-200 px-2 py-2 text-right text-[10px] text-slate-400 font-medium">HRA</th>
              <th className="border-b border-r border-slate-200 px-2 py-2 text-right text-[10px] text-slate-600 font-bold bg-slate-50/30">Total Due</th>

              {/* DRAWN Columns */}
              <th className="border-b border-slate-200 px-2 py-2 text-right text-[10px] text-slate-400 font-medium">DA%</th>
              <th className="border-b border-slate-200 px-2 py-2 text-right text-[10px] text-slate-400 font-medium">Basic</th>
              <th className="border-b border-slate-200 px-2 py-2 text-right text-[10px] text-slate-400 font-medium">G.Pay</th>
              <th className="border-b border-slate-200 px-2 py-2 text-right text-[10px] text-slate-400 font-medium">IR</th>
              <th className="border-b border-slate-200 px-2 py-2 text-right text-[10px] text-slate-400 font-medium">DA Amt</th>
              <th className="border-b border-r border-slate-200 px-2 py-2 text-right text-[10px] text-slate-600 font-bold bg-slate-50/30">Total Drawn</th>
              
              {/* DIFF Columns */}
              <th className="border-b border-slate-200 px-2 py-2 text-right text-[10px] text-slate-400 font-medium">Monthly Diff</th>
              <th className="border-b border-r border-slate-200 px-2 py-2 text-right text-[10px] text-slate-400 font-medium">Factor</th>
              <th className="border-b border-slate-200 px-2 py-2 text-right text-[10px] text-slate-800 font-bold bg-slate-100">Net Payable</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-100">
            {segments.map((seg, idx) => (
              <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                <td className="border-r border-slate-100 px-3 py-2 whitespace-nowrap font-medium text-slate-700 text-[11px] sticky left-0 bg-white group-hover:bg-slate-50 z-10 text-left">
                  {format(seg.startDate, 'dd.MM.yy')} - {format(seg.endDate, 'dd.MM.yy')}
                </td>
                <td className="border-r border-slate-100 px-2 py-2 whitespace-nowrap text-slate-500 text-[10px] sticky left-[160px] bg-white group-hover:bg-slate-50 z-10">
                   {seg.durationLabel}
                </td>
                
                {/* DUE */}
                <td className="px-2 py-2 text-right text-slate-500 font-mono">{seg.daPercentage}%</td>
                <td className="px-2 py-2 text-right text-slate-900 font-medium font-mono">{seg.basicPay}</td>
                <td className="px-2 py-2 text-right text-slate-500 font-mono">{seg.daRate}</td>
                <td className="px-2 py-2 text-right text-slate-300 font-mono">-</td>
                <td className="border-r border-slate-100 px-2 py-2 text-right font-medium text-slate-700 bg-slate-50/30 font-mono">
                  {seg.monthlyDueTotal}
                </td>

                {/* DRAWN */}
                <td className="px-2 py-2 text-right text-slate-500 font-mono">{seg.drawnDAPercentage}%</td>
                <td className="px-2 py-2 text-right text-slate-500 font-mono">{seg.drawnBasicPay}</td>
                <td className="px-2 py-2 text-right text-slate-500 font-mono">{seg.drawnGradePay}</td>
                <td className="px-2 py-2 text-right text-slate-500 font-mono">{seg.drawnIR}</td>
                <td className="px-2 py-2 text-right text-slate-500 font-mono">{seg.drawnDA}</td>
                <td className="border-r border-slate-100 px-2 py-2 text-right font-medium text-slate-700 bg-slate-50/30 font-mono">
                  {seg.drawnTotal}
                </td>

                {/* DIFF & TOTAL */}
                <td className="px-2 py-2 text-right text-slate-400 font-mono">
                   {seg.monthlyDueTotal - seg.drawnTotal}
                </td>
                <td className="border-r border-slate-100 px-2 py-2 text-right text-slate-400 text-[10px] font-mono">
                   {/* Factor */}
                </td>
                <td className={cn(
                  "px-2 py-2 text-right font-bold font-mono bg-slate-50",
                  Math.round(seg.totalDue - seg.totalDrawn) >= 0 ? "text-emerald-600" : "text-red-500"
                )}>
                    {Math.round(seg.totalDue - seg.totalDrawn)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-50 font-bold border-t border-slate-200 text-sm sticky bottom-0 z-10 shadow-[0_-1px_2px_rgba(0,0,0,0.05)]">
            <tr>
              <td colSpan={13} className="px-4 py-3 text-right uppercase text-xs text-slate-500 font-bold tracking-wider">Net Arrear Payable:</td>
              <td className="px-4 py-3 text-right text-slate-900 border-l border-slate-200 bg-emerald-50/50">
                ₹ {totalArrear.toLocaleString()}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      </div>
    </div>
  )
}
