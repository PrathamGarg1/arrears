
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

export default async function LoginPage() {
  const users = await prisma.user.findMany({
    orderBy: { role: 'asc' }
  })

  async function login(formData: FormData) {
    'use server'
    console.log('Login action started')
    try {
      const email = formData.get('email') as string
      console.log('Attempting login for:', email)
      
      const user = await prisma.user.findUnique({ where: { email } })
      console.log('User found:', user)
      
      if (user) {
        console.log('Setting cookies...')
        const cookieStore = await cookies()
        cookieStore.set('user_email', user.email)
        cookieStore.set('user_role', user.role)
        console.log('Cookies set. Redirecting...')
      } else {
        console.log('User not found')
      }
    } catch (e) {
      console.error('Login error:', e)
      throw e
    }
    // Redirect must be outside try/catch if it throws NEXT_REDIRECT, or just let it bubble
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full p-8 bg-white rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold mb-6 text-center text-gray-800">BBMB Arrears Login</h1>
        <div className="space-y-4">
          <p className="text-sm text-gray-500 text-center mb-4">Select a user to simulate login:</p>
          {users.map(u => (
            <form key={u.id} action={login} className="block">
              <input type="hidden" name="email" value={u.email} />
              <button 
                type="submit"
                className="w-full text-left px-4 py-3 border rounded hover:bg-blue-50 hover:border-blue-300 transition-colors flex justify-between items-center group"
              >
                <div>
                  <div className="font-medium text-gray-900 group-hover:text-blue-700">{u.name}</div>
                  <div className="text-xs text-gray-500">{u.email}</div>
                </div>
                <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded text-gray-600 group-hover:bg-blue-100 group-hover:text-blue-800">
                  {u.role}
                </span>
              </button>
            </form>
          ))}
        </div>
      </div>
    </div>
  )
}
