import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Sidebar } from './sidebar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const role = cookieStore.get('user_role')?.value

  if (!role) {
    redirect('/login')
  }

  // Determine if it's the CLERK/SUPERINTENDENT role to pass to sidebar if needed within the component (handled via cookie mostly or passed as prop)
  // Our Sidebar component is client-side and can take props or just handle navigation.
  // The interactive sidebar we made earlier takes `userRole`.

  return (
    <div className="flex min-h-screen bg-slate-50/50">
      {/* Sidebar Navigation */}
      <Sidebar userRole={role} />

      {/* Main Content Area */}
      <main className="flex-1 md:ml-64 transition-all duration-200 ease-in-out">
        {/* Top Header / Breadcrumb area could go here if we wanted one fixed */}
        <div className="w-full max-w-7xl mx-auto p-6 md:p-8 lg:p-10">
          {children}
        </div>
      </main>
    </div>
  )
}
