'use client'

import { format } from 'date-fns'
import { addPayEvent, deletePayEvent } from '../actions'
import { useRef, useState } from 'react'
import { Trash2, Copy } from 'lucide-react'

interface PayEvent {
  id: string
  date: Date
  basicPay: number
  type: string
  drawnBasicPay?: number
  drawnGradePay?: number
  drawnIR?: number
}

export default function PayEventsEditor({ requestId, initialEvents }: { requestId: string, initialEvents: PayEvent[] }) {
  const formRef = useRef<HTMLFormElement>(null)
  
  // State for inputs to allow "Copy Previous" logic
  // We don't strictly controlled inputs for everything, but pre-filling values is useful.
  // Actually, standard inputs + defaultValues/key is easier.
  
  const lastEvent = initialEvents.length > 0 ? initialEvents[initialEvents.length - 1] : null
  
  const [defaults, setDefaults] = useState({
      basicPay: '',
      drawnBasicPay: '',
      drawnGradePay: ''
  })

  function fillFromLast() {
      if (!lastEvent) return
      setDefaults({
          basicPay: String(lastEvent.basicPay),
          drawnBasicPay: String(lastEvent.drawnBasicPay || ''),
          drawnGradePay: String(lastEvent.drawnGradePay || '')
      })
      
      // Also update standard form inputs manually if refs needed, but React key change forces reload or value prop
      // For simple "Fill" form, setting key on form resets it. 
  }

  return (
    <div>
       <div className="space-y-3 mb-6">
        {initialEvents.length === 0 && <p className="text-gray-500 text-sm italic">No pay events recorded. Please add the Initial Pay (01.01.2016) to start.</p>}
        {initialEvents.map(event => (
          <div key={event.id} className="p-3 bg-white rounded-lg border border-gray-200 shadow-sm text-sm hover:border-blue-300 transition-colors">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded text-xs">{format(new Date(event.date), 'dd MMM yyyy')}</span>
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{event.type}</span>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-2 text-xs">
                    <div className="bg-blue-50 p-2 rounded border border-blue-100">
                        <span className="text-blue-700 font-bold block mb-1">DUE (New)</span> 
                        BP: ₹{event.basicPay}
                    </div>
                    <div className="bg-yellow-50 p-2 rounded border border-yellow-100">
                        <span className="text-yellow-800 font-bold block mb-1">DRAWN (Old)</span> 
                        BP {event.drawnBasicPay} + GP {event.drawnGradePay} (IR auto-calculated)
                    </div>
                </div>
              </div>
              <form action={async (formData) => {
                  await deletePayEvent(formData)
              }} className="ml-3">
                  <input type="hidden" name="id" value={event.id} />
                  <input type="hidden" name="requestId" value={requestId} />
                  <button type="submit" className="text-gray-400 hover:text-red-600 transition-colors">
                      <Trash2 size={18} />
                  </button>
              </form>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
          <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-gray-800">Add Pay Event</h3>
              {lastEvent && (
                  <button 
                    type="button" 
                    onClick={fillFromLast}
                    className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-800"
                  >
                      <Copy size={12} /> Copy Previous Values
                  </button>
              )}
          </div>
          
          <form 
            key={defaults.basicPay ? 'filled' : 'empty'} // Force re-render on fill
            ref={formRef}
            action={async (formData) => {
                await addPayEvent(formData)
                formRef.current?.reset()
                setDefaults({ basicPay: '', drawnBasicPay: '', drawnGradePay: ''})
            }} 
            className="space-y-4"
          >
            <input type="hidden" name="requestId" value={requestId} />
            
            <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">Event Date</label>
                    <input type="date" name="date" required className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 p-2 border" />
                </div>
                
                <div className="col-span-2">
                   <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">Event Type</label>
                   <select name="type" className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 p-2 border">
                     <option value="Initial Pay">Initial Pay</option>
                     <option value="Annual Increment">Annual Increment</option>
                     <option value="Promotion">Promotion</option>
                     <option value="Revision">Revision</option>
                     <option value="Arrear Installment">Arrear Installment</option>
                   </select>
                </div>

                {/* DUE SECTION */}
                <div className="col-span-1 bg-white p-3 rounded border border-blue-200 relative">
                    <span className="absolute -top-2 left-2 bg-blue-100 text-blue-800 text-[10px] px-2 py-0.5 rounded font-bold uppercase">Due (New)</span>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mt-2">Basic Pay</label>
                      <input type="number" name="basicPay" defaultValue={defaults.basicPay} required placeholder="e.g. 52000" className="mt-1 w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 p-1.5 border" />
                    </div>
                </div>

                {/* DRAWN SECTION */}
                <div className="col-span-1 bg-white p-3 rounded border border-yellow-200 relative">
                     <span className="absolute -top-2 left-2 bg-yellow-100 text-yellow-800 text-[10px] px-2 py-0.5 rounded font-bold uppercase">Drawn (Old)</span>
                        <div>
                          <label className="block text-[10px] font-medium text-gray-500">Basic Pay</label>
                          <input type="number" name="drawnBasicPay" defaultValue={defaults.drawnBasicPay} placeholder="BP" className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-gray-500 focus:border-gray-500 p-1.5 border" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-medium text-gray-500">Grade Pay</label>
                          <input type="number" name="drawnGradePay" defaultValue={defaults.drawnGradePay} placeholder="GP" className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-gray-500 focus:border-gray-500 p-1.5 border" />
                        </div>
                        <div className="col-span-2">
                          <p className="text-[10px] text-gray-500 italic mt-1">IR is auto-calculated (5% from 1.1.2017)</p>
                        </div>
                </div>
            </div>

            <button type="submit" className="w-full bg-slate-900 text-white py-2.5 px-4 rounded-md text-sm font-medium hover:bg-slate-800 transition shadow-sm">
              Add Pay Event
            </button>
          </form>
      </div>
    </div>
  )
}
