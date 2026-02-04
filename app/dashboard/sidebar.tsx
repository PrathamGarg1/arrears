'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  LayoutDashboard, 
  FileText, 
  Users, 
  Settings, 
  LogOut, 
  PlusCircle, 
  Menu
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import { cn } from '@/lib/utils'

interface SidebarProps {
  userRole?: string
}

export function Sidebar({ userRole }: SidebarProps) {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)

  const links = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/requests/new', label: 'New Request', icon: PlusCircle },
    // Placeholder links for "premium" feel
    { href: '#', label: 'Employees', icon: Users, disabled: true },
    { href: '#', label: 'Settings', icon: Settings, disabled: true },
  ]

  const isActive = (path: string) => pathname === path

  return (
    <>
      <div className="fixed top-4 left-4 z-50 md:hidden">
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 bg-white rounded-md shadow-sm border border-slate-200"
        >
          <Menu className="w-5 h-5 text-slate-600" />
        </button>
      </div>

      <AnimatePresence mode="wait">
        <motion.div 
          className={cn(
            "fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-slate-200 transform transition-transform duration-200 ease-in-out md:translate-x-0",
            isOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="flex flex-col h-full">
            {/* Logo Area */}
            <div className="h-16 flex items-center px-6 border-b border-slate-100">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center mr-3 shadow-sm">
                <span className="text-white font-bold text-lg">B</span>
              </div>
              <span className="font-bold text-lg text-slate-800 tracking-tight">BBMB Arrear</span>
            </div>

            {/* Navigation */}
            <nav className="flex-1 py-6 px-3 space-y-1">
              {links.map((link) => (
                <Link 
                  key={link.label}
                  href={link.href}
                  className={cn(
                    "flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group relative",
                    link.disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-slate-50",
                    isActive(link.href) 
                      ? "bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-200/50" 
                      : "text-slate-600 hover:text-slate-900"
                  )}
                  onClick={() => setIsOpen(false)}
                >
                  <link.icon className={cn(
                    "w-5 h-5 mr-3 transition-colors",
                    isActive(link.href) ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600"
                  )} />
                  {link.label}
                  {isActive(link.href) && (
                    <motion.div
                      layoutId="active-pill"
                      className="absolute right-2 w-1.5 h-1.5 rounded-full bg-indigo-600"
                    />
                  )}
                </Link>
              ))}
            </nav>

            {/* Profile / Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/50">
              <div className="flex items-center mb-4 px-2">
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm">
                  {userRole?.[0]?.toUpperCase() || 'U'}
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-slate-900">User Account</p>
                  <p className="text-xs text-slate-500 capitalize">{userRole?.toLowerCase() || 'Viewer'}</p>
                </div>
              </div>
              <button 
                onClick={() => { /* Handle sign out */ }}
                className="w-full flex items-center justify-center px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-white hover:text-red-600 hover:border-red-100 transition-colors shadow-sm"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
      
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  )
}
