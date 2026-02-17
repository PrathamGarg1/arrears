import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import { format } from 'date-fns'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import PayEventsEditor from './events-editor'
import CalculationGrid from './calculation-grid'
import ApprovalWorkflow from './approval-workflow'
import { calculateArrears } from '@/lib/calculation-engine'
import { RequestHeaderActions } from './header-actions'

export default async function RequestDetailPage({ params }: { params: { id: string } }) {
  const { id } = await params
  const request = await prisma.arrearRequest.findUnique({
    where: { id },
    include: { 
      payEvents: { orderBy: { date: 'asc' } },
      initiator: true
    }
  })

  if (!request) notFound()

  // Fetch Logic Data
  const daRates = await prisma.dARate.findMany({ orderBy: { effectiveDate: 'asc' } })

  // Prepare data for Client Components (Serialization Safety)
  const safeEvents = request.payEvents.map(p => ({
    ...p,
    date: new Date(p.date),
    drawnBasicPay: p.drawnBasicPay ?? undefined,
    drawnGradePay: p.drawnGradePay ?? undefined,
    drawnIR: p.drawnIR ?? undefined
  }))

  const safeDARates = daRates.map(d => ({
    ...d,
    effectiveDate: new Date(d.effectiveDate),
    type: d.type as 'REVISED' | 'PRE_REVISED'
  }))

  const segments = calculateArrears({
    startDate: new Date(request.startDate),
    endDate: new Date(request.endDate),
    payEvents: safeEvents,
    daRates: safeDARates
  })

  // Calculate totals and serialize data
  const totalArrear = segments.reduce((sum, seg) => sum + (seg.totalDue - seg.totalDrawn), 0)
  const serializedSegments = JSON.parse(JSON.stringify(segments))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/dashboard" className="text-gray-500 hover:text-gray-700">
            <ChevronLeft />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{request.employeeName} ({request.employeeId})</h1>
            <p className="text-sm text-gray-500">
              {format(request.startDate, 'dd MMM yyyy')} - {format(request.endDate, 'dd MMM yyyy')} • Status: {request.status}
            </p>
          </div>
        </div>
        
        {/* Client Actions: Export PDF & Excel */}
        <RequestHeaderActions request={request} daRates={daRates} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Left Col: Inputs (Pay Events) */}
        <div className="xl:col-span-1 space-y-8">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Pay Events</h2>
              <span className="text-xs font-medium px-2 py-1 bg-slate-100 rounded-full text-slate-600">
                {request.payEvents.length} Events
              </span>
            </div>
            <PayEventsEditor 
              requestId={request.id} 
              initialEvents={request.payEvents.map(e => ({
                ...e,
                drawnBasicPay: e.drawnBasicPay ?? undefined,
                drawnGradePay: e.drawnGradePay ?? undefined,
                drawnIR: e.drawnIR ?? undefined
              }))} 
            />
          </div>
          
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Workflow Actions</h2>
            <ApprovalWorkflow request={request} />
          </div>
        </div>

        {/* Right Col: Calculation Grid */}
        <div className="xl:col-span-2 space-y-8">
           <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm overflow-hidden">
             <div className="flex items-center justify-between mb-6">
                <div>
                   <h2 className="text-lg font-semibold text-slate-900">Calculation Details</h2>
                   <p className="text-sm text-slate-500">Detailed breakdown of due vs drawn amounts</p>
                </div>
             </div>
             <CalculationGrid 
               request={request} 
               payEvents={request.payEvents} 
               daRates={daRates}
             />
           </div>
        </div>
      </div>


    </div>
  )
}
