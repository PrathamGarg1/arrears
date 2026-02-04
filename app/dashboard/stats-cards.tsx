'use client'

import { motion } from 'framer-motion'
import { FileText, Clock, CheckCircle, IndianRupee, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatsCardsProps {
  totalRequests: number
  pendingRequests: number
  approvedRequests: number
  totalAmount: number
}

export function StatsCards({ totalRequests, pendingRequests, approvedRequests, totalAmount }: StatsCardsProps) {
  const stats = [
    {
      label: 'Total Requests',
      value: totalRequests,
      icon: FileText,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      trend: '+12% from last month'
    },
    {
      label: 'Pending Approval',
      value: pendingRequests,
      icon: Clock,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      trend: '5 urgent'
    },
    {
      label: 'Approved',
      value: approvedRequests,
      icon: CheckCircle,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      trend: 'All settled'
    },
    {
      label: 'Total Disbursed',
      value: `₹${(totalAmount / 100000).toFixed(1)}L`,
      icon: IndianRupee,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
      trend: '+2.4L this year'
    }
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((stat, i) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
          className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow group"
        >
          <div className="flex items-center justify-between mb-4">
            <div className={cn("p-2 rounded-lg", stat.bg)}>
              <stat.icon className={cn("w-5 h-5", stat.color)} />
            </div>
            {i === 3 && (
              <span className="flex items-center text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                <TrendingUp className="w-3 h-3 mr-1" />
                24%
              </span>
            )}
          </div>
          <div>
            <h3 className="text-2xl font-bold text-slate-900 tracking-tight">{stat.value}</h3>
            <p className="text-sm font-medium text-slate-500 mt-1">{stat.label}</p>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-50">
            <p className="text-xs text-slate-400 font-medium">{stat.trend}</p>
          </div>
        </motion.div>
      ))}
    </div>
  )
}
