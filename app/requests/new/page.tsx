
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'

export default async function NewRequestPage() {
  async function createRequest(formData: FormData) {
    'use server'
    const employeeId = formData.get('employeeId') as string
    const employeeName = formData.get('employeeName') as string
    const startDate = new Date(formData.get('startDate') as string)
    const endDate = new Date(formData.get('endDate') as string)
    
    const email = (await cookies()).get('user_email')?.value
    const initiator = await prisma.user.findUnique({ where: { email } })
    
    if (!initiator) throw new Error('User not found')

    const req = await prisma.arrearRequest.create({
      data: {
        employeeId,
        employeeName,
        startDate,
        endDate,
        status: 'PENDING_CALC', // Clerk creates, moves to Pending Calc
        initiatorId: initiator.id
      }
    })

    redirect(`/requests/${req.id}`)
  }

  return (
    <div className="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">New Arrear Calculation Request</h1>
      <form action={createRequest} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700">Employee ID / PF Number</label>
          <input name="employeeId" required className="mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500" />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700">Employee Name</label>
          <input name="employeeName" required className="mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500" />
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700">Arrear Start Date</label>
            <input type="date" name="startDate" required className="mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Arrear End Date</label>
            <input type="date" name="endDate" required className="mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500" />
          </div>
        </div>

        <div className="pt-4">
          <button type="submit" className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
            Create Request
          </button>
        </div>
      </form>
    </div>
  )
}
