'use client'

import { updateStatus } from '../actions'

export default function ApprovalWorkflow({ request }: { request: any }) {
  const currentStatus = request.status
  
  // Define transitions based on current status
  // DRAFT/PENDING_CALC -> PENDING_BUDGET -> PENDING_APPROVAL -> APPROVED
  
  const getAction = () => {
    switch (currentStatus) {
      case 'PENDING_CALC':
        return { label: 'Submit for Budget Check', next: 'PENDING_BUDGET', role: 'JR_ASSISTANT' }
      case 'PENDING_BUDGET':
        return { label: 'Budget Verified', next: 'PENDING_APPROVAL', role: 'SUPERINTENDENT' }
      case 'PENDING_APPROVAL':
        return { label: 'Final Approve', next: 'APPROVED', role: 'AO' }
      default:
        return null
    }
  }

  const action = getAction()

  if (!action) return <div className="text-gray-500 text-sm">No actions available. Request is {currentStatus}.</div>

  return (
      <div className="space-y-4">
          <p className="text-sm text-gray-600">
              Current Status: <span className="font-semibold">{currentStatus}</span>
          </p>
          <button 
            onClick={() => updateStatus(request.id, action.next)}
            className="w-full bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 transition"
          >
              {action.label}
          </button>
          <p className="text-xs text-gray-400">Action performed by: {action.role}</p>
      </div>
  )
}
