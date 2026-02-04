
import { PrismaClient } from '@prisma/client'
import 'dotenv/config'

const prisma = new PrismaClient()

async function main() {
    console.log('Seeding database with Exact DA Rates...')

    // 1. Users
    const users = [
        { email: 'clerk@bbmb.gov.in', name: 'Ramesh Clerk', role: 'CLERK' },
        { email: 'junior@bbmb.gov.in', name: 'Suresh Jr', role: 'JR_ASSISTANT' },
        { email: 'senior@bbmb.gov.in', name: 'Mahesh Sr', role: 'SR_ASSISTANT' },
        { email: 'super@bbmb.gov.in', name: 'Rajesh Super', role: 'SUPERINTENDENT' },
        { email: 'ao@bbmb.gov.in', name: 'Amit AO', role: 'AO' },
    ]
    for (const u of users) {
        await prisma.user.upsert({
            where: { email: u.email },
            update: {},
            create: u,
        })
    }

    // 2. DA Rates (Revised - 7th CPC - Due)
    // Source: User provided list
    const revisedDA = [
        { date: '2016-01-01', pct: 0 },
        { date: '2016-07-01', pct: 2 },
        { date: '2017-01-01', pct: 4 },
        { date: '2017-07-01', pct: 5 },
        { date: '2018-01-01', pct: 7 },
        { date: '2018-07-01', pct: 9 },
        { date: '2019-01-01', pct: 12 },
        { date: '2019-07-01', pct: 17 },
        { date: '2020-01-01', pct: 17 }, // Freeze
        { date: '2020-07-01', pct: 17 }, // Freeze
        { date: '2021-01-01', pct: 17 }, // Freeze
        { date: '2021-07-01', pct: 31 }, // Corrected from 28%
        { date: '2022-01-01', pct: 34 },
        { date: '2022-07-01', pct: 38 },
        { date: '2023-01-01', pct: 42 },
        { date: '2023-07-01', pct: 46 },
        { date: '2024-01-01', pct: 50 },
    ]

    // 3. DA Rates (Pre-Revised - 6th CPC - Drawn)
    // Source: User provided list
    const preRevisedDA = [
        { date: '2016-01-01', pct: 125 },
        { date: '2016-07-01', pct: 132 },
        { date: '2017-01-01', pct: 136 },
        { date: '2017-07-01', pct: 139 },
        { date: '2018-01-01', pct: 142 },
        { date: '2018-07-01', pct: 148 },
        { date: '2019-01-01', pct: 154 },
        { date: '2019-07-01', pct: 164 },
        // "Then same" implies it stays at 164? Or follows freeze? 
        // Usually Pre-Revised also froze.
        { date: '2020-01-01', pct: 164 },
        { date: '2020-07-01', pct: 164 },
        { date: '2021-01-01', pct: 164 },
        // Jump corresponding to 28%? Standard table: 
        // 17% -> 28% (Jump of 11% on 7th CPC ~= x% on 6th)
        // 6th CPC jump usually 164% to 189%
        { date: '2021-07-01', pct: 196 }, // Corrected from 189%
        { date: '2022-01-01', pct: 203 },
        { date: '2022-07-01', pct: 212 },
    ]

    await prisma.dARate.deleteMany({}) // Clear old

    for (const d of revisedDA) {
        await prisma.dARate.create({
            data: {
                effectiveDate: new Date(d.date),
                percentage: d.pct,
                type: 'REVISED'
            }
        })
    }

    for (const d of preRevisedDA) {
        await prisma.dARate.create({
            data: {
                effectiveDate: new Date(d.date),
                percentage: d.pct,
                type: 'PRE_REVISED'
            }
        })
    }

    console.log('Seeding completed.')
}

main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })
