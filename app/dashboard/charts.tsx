
'use client'

import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area
} from 'recharts'
import { motion } from 'framer-motion'
import { GlassCard } from '@/components/ui/glass-card'

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042']

interface DashboardChartsProps {
  statusData: { name: string; value: number }[]
  trendData: { month: string; amount: number }[]
  topRequests: { name: string; amount: number }[]
}

export function DashboardCharts({ statusData, trendData, topRequests }: DashboardChartsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
      {/* Status Distribution */}
      <GlassCard delay={0.1} className="p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Request Status</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 flex justify-center gap-4 text-xs text-gray-500">
           {statusData.map((entry, index) => (
              <div key={entry.name} className="flex items-center gap-1">
                 <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                 {entry.name}: {entry.value}
              </div>
           ))}
        </div>
      </GlassCard>

      {/* Monthly Trend - Area Chart */}
      <GlassCard delay={0.2} className="p-6 col-span-1 lg:col-span-2">
         <h3 className="text-lg font-semibold text-gray-800 mb-4">Total Arrears Processed (Timeline)</h3>
         <div className="h-64">
           <ResponsiveContainer width="100%" height="100%">
             <AreaChart data={trendData}>
                <defs>
                   <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
                   </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 12}} tickFormatter={(value) => `₹${value/1000}k`} />
                <Tooltip 
                   contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.8)', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                   formatter={(value: number | undefined) => [`₹${(value || 0).toLocaleString()}`, 'Amount']}
                />
                <Area type="monotone" dataKey="amount" stroke="#8884d8" fillOpacity={1} fill="url(#colorAmount)" />
             </AreaChart>
           </ResponsiveContainer>
         </div>
      </GlassCard>
    </div>
  )
}
