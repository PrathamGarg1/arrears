'use client'

import { useState } from 'react'
import { Pencil, Plus, Trash2, Check, X } from 'lucide-react'
import { ExtractedSheetData } from '@/lib/ocr-processor'

interface DataEditorProps {
  data: ExtractedSheetData
  onChange: (data: ExtractedSheetData) => void
}

export function DataEditor({ data, onChange }: DataEditorProps) {
  const [editingRow, setEditingRow] = useState<number | null>(null)
  const [editedEvent, setEditedEvent] = useState<ExtractedSheetData['payEvents'][0] | null>(null)

  const handleEdit = (index: number) => {
    setEditingRow(index)
    setEditedEvent({ ...data.payEvents[index] })
  }

  const handleSave = () => {
    if (editingRow !== null && editedEvent) {
      const newEvents = [...data.payEvents]
      newEvents[editingRow] = editedEvent
      onChange({ ...data, payEvents: newEvents })
      setEditingRow(null)
      setEditedEvent(null)
    }
  }

  const handleCancel = () => {
    setEditingRow(null)
    setEditedEvent(null)
  }

  const handleDelete = (index: number) => {
    const newEvents = data.payEvents.filter((_, i) => i !== index)
    onChange({ ...data, payEvents: newEvents })
  }

  const handleAdd = () => {
    const lastEvent = data.payEvents[data.payEvents.length - 1]
    const newEvent: ExtractedSheetData['payEvents'][0] = {
      date: new Date(),
      basicPay: lastEvent?.basicPay || 0,
      gradePay: lastEvent?.gradePay,
      daPercent: lastEvent?.daPercent || 0,
      hra: lastEvent?.hra,
      totalPay: 0,
      type: 'NORMAL',
      confidence: 1.0,
    }
    onChange({ ...data, payEvents: [...data.payEvents, newEvent] })
  }

  return (
    <div className="space-y-6">
      {/* Metadata Editor */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Employee Information</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
            <input
              type="text"
              value={data.metadata.employeeName}
              onChange={(e) => onChange({
                ...data,
                metadata: { ...data.metadata, employeeName: e.target.value }
              })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Employee ID</label>
            <input
              type="text"
              value={data.metadata.employeeId}
              onChange={(e) => onChange({
                ...data,
                metadata: { ...data.metadata, employeeId: e.target.value }
              })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Designation</label>
            <input
              type="text"
              value={data.metadata.designation || ''}
              onChange={(e) => onChange({
                ...data,
                metadata: { ...data.metadata, designation: e.target.value }
              })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Pay Events Table */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900">Pay Events</h3>
          <button
            onClick={handleAdd}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Event
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Date</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Type</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">Basic Pay</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">Grade Pay</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">DA %</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">HRA</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.payEvents.map((event, index) => (
                <tr key={index} className="border-b border-slate-100 hover:bg-slate-50">
                  {editingRow === index && editedEvent ? (
                    <>
                      <td className="px-4 py-3">
                        <input
                          type="date"
                          value={editedEvent.date.toISOString().split('T')[0]}
                          onChange={(e) => setEditedEvent({ ...editedEvent, date: new Date(e.target.value) })}
                          className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={editedEvent.type}
                          onChange={(e) => setEditedEvent({ ...editedEvent, type: e.target.value as any })}
                          className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                        >
                          <option value="NORMAL">Normal</option>
                          <option value="INCREMENT">Increment</option>
                          <option value="PROMOTION">Promotion</option>
                          <option value="REVISION">Revision</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={editedEvent.basicPay}
                          onChange={(e) => setEditedEvent({ ...editedEvent, basicPay: parseInt(e.target.value) })}
                          className="w-full px-2 py-1 border border-slate-300 rounded text-sm text-right"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={editedEvent.gradePay || ''}
                          onChange={(e) => setEditedEvent({ ...editedEvent, gradePay: e.target.value ? parseInt(e.target.value) : undefined })}
                          className="w-full px-2 py-1 border border-slate-300 rounded text-sm text-right"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={editedEvent.daPercent}
                          onChange={(e) => setEditedEvent({ ...editedEvent, daPercent: parseInt(e.target.value) })}
                          className="w-full px-2 py-1 border border-slate-300 rounded text-sm text-right"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={editedEvent.hra || ''}
                          onChange={(e) => setEditedEvent({ ...editedEvent, hra: e.target.value ? parseInt(e.target.value) : undefined })}
                          className="w-full px-2 py-1 border border-slate-300 rounded text-sm text-right"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={handleSave} className="p-1 text-green-600 hover:bg-green-50 rounded">
                            <Check className="h-4 w-4" />
                          </button>
                          <button onClick={handleCancel} className="p-1 text-red-600 hover:bg-red-50 rounded">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 text-sm text-slate-900">
                        {event.date.toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          event.type === 'PROMOTION' ? 'bg-purple-100 text-purple-700' :
                          event.type === 'INCREMENT' ? 'bg-blue-100 text-blue-700' :
                          event.type === 'REVISION' ? 'bg-orange-100 text-orange-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {event.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-900 text-right font-mono">
                        ₹{event.basicPay.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-900 text-right font-mono">
                        {event.gradePay ? `₹${event.gradePay.toLocaleString()}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-900 text-right font-mono">
                        {event.daPercent}%
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-900 text-right font-mono">
                        {event.hra ? `₹${event.hra.toLocaleString()}` : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleEdit(index)}
                            className="p-1 text-indigo-600 hover:bg-indigo-50 rounded"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(index)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data.payEvents.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            <p>No pay events extracted. Click "Add Event" to create one manually.</p>
          </div>
        )}
      </div>
    </div>
  )
}
