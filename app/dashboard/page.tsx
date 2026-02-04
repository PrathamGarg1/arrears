
import { prisma } from '@/lib/db'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { format } from 'date-fns'
import { DashboardCharts } from './charts'
import { StatsCards } from './stats-cards'
import { MotionButton } from '@/components/ui/motion-button'
import { Plus, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

export default async function DashboardPage() {
  const cookieStore = await cookies()
  const role = cookieStore.get('user_role')?.value
  const email = cookieStore.get('user_email')?.value

  if (!role) return <div className="p-10 text-center text-gray-500">Please login to access the dashboard.</div>

  // --- Fetch Data ---
  let where = {}
  if (role === 'CLERK') {
    const user = await prisma.user.findUnique({ where: { email } })
    if (user) where = { initiatorId: user.id }
  }

  const requests = await prisma.arrearRequest.findMany({
    where,
    include: { initiator: true },
    orderBy: { updatedAt: 'desc' }
  })

  // --- Helper to parse totals ---
  const getArrearTotal = (jsonStr: string | null): number => {
    if (!jsonStr) return 0
    try {
      const segments = JSON.parse(jsonStr)
      if (!Array.isArray(segments)) return 0
      return segments.reduce((acc: number, seg: any) => {
        const due = typeof seg.totalDue === 'number' ? seg.totalDue : 0
        const drawn = typeof seg.totalDrawn === 'number' ? seg.totalDrawn : 0
        return acc + (due - drawn)
      }, 0)
    } catch {
      return 0
    }
  }

  // --- Calculate Analytics ---
  // 1. Status Distribution
  const statusCounts = requests.reduce((acc, req) => {
    acc[req.status] = (acc[req.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  
  const statusData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }))

  // 2. Trend Data
  const trendMap = requests.reduce((acc, req) => {
      const total = getArrearTotal(req.calculationResult)
      if (req.status === 'APPROVED' || (total > 0)) {
          const month = format(req.updatedAt, 'MMM')
          acc[month] = (acc[month] || 0) + total
      }
      return acc
  }, {} as Record<string, number>)

  const trendData = Object.entries(trendMap).map(([month, amount]) => ({ month, amount }))

  // 3. Top Requests
  const topRequests = [...requests]
     .map(r => ({ name: r.employeeName || 'Unknown', amount: getArrearTotal(r.calculationResult) }))
     .filter(r => r.amount > 0)
     .sort((a, b) => b.amount - a.amount)
     .slice(0, 5)

  return (
    <div className="space-y-8">
      
      {/* Header Section */}
      <div className="flex justify-between items-end">
        <div>
           <h2 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
             Welcome back, {role === 'CLERK' ? 'Clerk' : 'Officer'}
           </h2>
           <p className="text-gray-500 mt-1">Here is the overview of recent arrear calculations.</p>
        </div>
        {role === 'CLERK' && (
          <Link href="/requests/new">
            <MotionButton size="lg" className="shadow-blue-500/20">
              <Plus className="mr-2 h-5 w-5" />
              New Arrear Request
            </MotionButton>
          </Link>
        )}
      </div>

      {/* Stats Overview */}
      <StatsCards 
        totalRequests={requests.length}
        pendingRequests={requests.filter(r => r.status === 'PENDING_APPROVAL').length}
        approvedRequests={requests.filter(r => r.status === 'APPROVED').length}
        totalAmount={requests.reduce((sum, r) => sum + getArrearTotal(r.calculationResult), 0)}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content Area (Charts + Recent Activity) */}
        <div className="lg:col-span-2 space-y-8">
           {/* Charts Section */}
           {requests.length > 0 && (
             <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900 mb-6">Arrear Trends</h3>
                <div className="h-[300px]">
                  <DashboardCharts 
                      statusData={statusData.length > 0 ? statusData : [{name: 'No Data', value: 1}]} 
                      trendData={trendData}
                      topRequests={topRequests}
                  />
                </div>
             </div>
           )}

           {/* Recent Activity Table */}
           <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
             <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center">
               <h3 className="font-semibold text-slate-900">Recent Requests</h3>
               <Link href="/requests" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">View All</Link>
             </div>
             
             {requests.length === 0 ? (
               <div className="p-12 text-center">
                 <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 mb-4">
                   <FileText className="w-6 h-6 text-slate-400" />
                 </div>
                 <h3 className="text-sm font-medium text-slate-900">No requests yet</h3>
                 <p className="mt-1 text-sm text-slate-500">Get started by creating a new arrear request.</p>
               </div>
             ) : (
               <div className="overflow-x-auto">
                 <table className="w-full">
                   <thead>
                     <tr className="bg-slate-50/50 border-b border-slate-100">
                       <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Employee</th>
                       <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                       <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Amount</th>
                       <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                     {requests.slice(0, 5).map((req) => {
                       const total = getArrearTotal(req.calculationResult)
                       return (
                       <tr key={req.id} className="hover:bg-slate-50/50 transition-colors group">
                         <td className="px-6 py-4">
                           <div className="flex items-center">
                             <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xs mr-3">
                               {req.employeeName?.[0] || 'U'}
                             </div>
                             <div>
                               <Link href={`/requests/${req.id}`} className="block text-sm font-medium text-slate-900 hover:text-indigo-600 transition-colors">
                                 {req.employeeName}
                               </Link>
                               <span className="text-xs text-slate-500">{req.employeeId}</span>
                             </div>
                           </div>
                         </td>
                         <td className="px-6 py-4">
                           <span className={cn(
                             "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
                             req.status === 'APPROVED' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                             req.status === 'REJECTED' ? "bg-red-50 text-red-700 border-red-200" :
                             "bg-amber-50 text-amber-700 border-amber-200"
                           )}>
                             {req.status.replace('_', ' ')}
                           </span>
                         </td>
                         <td className="px-6 py-4 text-right text-sm font-medium text-slate-900">
                           ₹{total.toLocaleString()}
                         </td>
                         <td className="px-6 py-4 text-right text-sm text-slate-500">
                           {format(req.updatedAt, 'dd MMM')}
                         </td>
                       </tr>
                     )})}
                   </tbody>
                 </table>
               </div>
             )}
           </div>
        </div>

        {/* Sidebar / Quick Actions (Right Column) */}
        <div className="space-y-6">
           {/* Mini Top Requests */}
           <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
             <h3 className="font-semibold text-slate-900 mb-4">Top Requests</h3>
             <div className="space-y-4">
               {topRequests.map((req, i) => (
                 <div key={i} className="flex items-center justify-between">
                   <div className="flex items-center">
                     <span className="text-sm font-medium text-slate-600 w-6">{i + 1}.</span>
                     <span className="text-sm text-slate-900">{req.name}</span>
                   </div>
                   <span className="text-sm font-medium text-slate-900">₹{(req.amount/1000).toFixed(1)}k</span>
                 </div>
               ))}
               {topRequests.length === 0 && <p className="text-sm text-slate-500">No data available</p>}
             </div>
           </div>

           {/* Quick Actions Card */}
           <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-xl p-6 text-white shadow-lg">
             <h3 className="text-lg font-bold mb-2">Need Help?</h3>
             <p className="text-indigo-100 text-sm mb-6">Check the documentation or verify calculations manually.</p>
             <button className="w-full bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-lg py-2 text-sm font-medium transition-colors">
               View Documentation
             </button>
           </div>
        </div>
      </div>
    </div>
  )
}
