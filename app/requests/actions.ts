'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { sendEmail } from '@/lib/mailer'
import { cookies } from 'next/headers'

export async function addPayEvent(formData: FormData) {
    const requestId = formData.get('requestId') as string
    const date = new Date(formData.get('date') as string)
    const basicPay = parseFloat(formData.get('basicPay') as string)
    const type = formData.get('type') as string

    // Drawn Fields (Optional)
    const drawnBasicPay = formData.get('drawnBasicPay') ? parseFloat(formData.get('drawnBasicPay') as string) : null
    const drawnGradePay = formData.get('drawnGradePay') ? parseFloat(formData.get('drawnGradePay') as string) : null
    // IR is auto-calculated from 1.1.2017 onwards, so we don't accept it from the form

    await prisma.payEvent.create({
        data: {
            requestId,
            date,
            basicPay,
            type,
            drawnBasicPay,
            drawnGradePay,
            drawnIR: null // Will be auto-calculated
        }
    })

    revalidatePath(`/requests/${requestId}`)
}

export async function deletePayEvent(formData: FormData) {
    const id = formData.get('id') as string
    const requestId = formData.get('requestId') as string

    await prisma.payEvent.delete({ where: { id } })
    revalidatePath(`/requests/${requestId}`)
}

export async function updateStatus(requestId: string, newStatus: string) {
    const request = await prisma.arrearRequest.update({
        where: { id: requestId },
        data: { status: newStatus },
        include: { initiator: true }
    })

    // Notify Initiator
    if (request.initiator?.email) {
        await sendEmail(
            request.initiator.email,
            `Request Status Update: ${newStatus}`,
            `Your arrear request for ${request.employeeName} has been updated to ${newStatus}.`
        )
    }

    revalidatePath(`/requests/${requestId}`)
}
