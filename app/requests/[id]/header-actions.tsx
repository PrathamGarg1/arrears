
'use client'

import { MotionButton } from '@/components/ui/motion-button'
import { Download, FileSpreadsheet } from 'lucide-react'
import { generatePDF } from '@/lib/pdf-generator'
import { generateExcel } from '@/lib/excel-generator'
import { calculateArrears } from '@/lib/calculation-engine'

interface RequestHeaderActionsProps {
  request: any
  daRates: any[]
}

export function RequestHeaderActions({ request, daRates }: RequestHeaderActionsProps) {

  const getCalculationData = () => {
    const safeEvents = request.payEvents.map((p: any) => ({
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

    const totalArrear = segments.reduce((sum, seg) => sum + (seg.totalDue - seg.totalDrawn), 0)

    return { segments, totalArrear }
  }

  const handleExportPDF = () => {
    const { segments, totalArrear } = getCalculationData()

    generatePDF({
      employeeName: request.employeeName || 'Employee',
      employeeId: request.employeeId,
      startDate: new Date(request.startDate),
      endDate: new Date(request.endDate),
      segments,
      totalArrear
    })
  }

  const handleExportExcel = () => {
    const { segments, totalArrear } = getCalculationData()

    generateExcel({
      employeeName: request.employeeName || 'Employee',
      employeeId: request.employeeId,
      startDate: new Date(request.startDate),
      endDate: new Date(request.endDate),
      segments,
      totalArrear,
      status: request.status
    })
  }

  return (
    <div className="flex gap-2">
      <MotionButton variant="secondary" onClick={handleExportPDF}>
        <Download className="mr-2 h-4 w-4" />
        Export PDF
      </MotionButton>
      <MotionButton variant="secondary" onClick={handleExportExcel}>
        <FileSpreadsheet className="mr-2 h-4 w-4" />
        Export Excel
      </MotionButton>
    </div>
  )
}
