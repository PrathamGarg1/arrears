
import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.ethereal.email',
    port: 587,
    auth: {
        user: process.env.SMTP_USER || 'ethereal_user',
        pass: process.env.SMTP_PASS || 'ethereal_pass'
    }
})

export async function sendEmail(to: string, subject: string, text: string) {
    if (process.env.NODE_ENV === 'development') {
        console.log(`[MOCK EMAIL] To: ${to} | Subject: ${subject} | Body: ${text}`)
        return
    }

    try {
        await transporter.sendMail({
            from: '"BBMB Arrears System" <noreply@bbmb.gov.in>',
            to,
            subject,
            text,
        })
    } catch (error) {
        console.error('Email failed:', error)
    }
}
