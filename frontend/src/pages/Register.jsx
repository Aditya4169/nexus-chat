import { MessageCircle, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Register() {
  const navigate = useNavigate()
  const { register } = useAuth()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    const result = await register(username, email, password)

    setSubmitting(false)

    if (result.success) {
      navigate('/chat')
      return
    }

    setError(result.message)
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-slate-200/60 bg-white/95 backdrop-blur p-8 shadow-[0_8px_32px_rgba(0,0,0,0.08)]">
        <div className="mb-8 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 text-white shadow-lg shadow-teal-500/30">
            <MessageCircle size={24} aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950">Create account</h1>
            <p className="mt-1 text-sm font-medium text-slate-600">Start chatting with Nexus</p>
          </div>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Username</span>
            <input
              className="mt-2.5 w-full rounded-lg border border-slate-300/60 bg-slate-50/40 px-4 py-3.5 text-slate-950 outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-100"
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="nexus_user"
              autoComplete="username"
              required
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Email</span>
            <input
              className="mt-2.5 w-full rounded-lg border border-slate-300/60 bg-slate-50/40 px-4 py-3.5 text-slate-950 outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-100"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Password</span>
            <input
              className="mt-2.5 w-full rounded-lg border border-slate-300/60 bg-slate-50/40 px-4 py-3.5 text-slate-950 outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-100"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Choose a secure password"
              autoComplete="new-password"
              required
            />
          </label>

          {error ? (
            <div className="rounded-lg border border-red-200/60 bg-red-50/80 px-4 py-3.5 text-sm font-medium text-red-700 backdrop-blur animate-fade-in">
              {error}
            </div>
          ) : null}

          <button
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-teal-600 to-teal-700 px-4 py-3.5 font-semibold text-white shadow-lg shadow-teal-600/30 transition-all duration-200 hover:shadow-lg hover:shadow-teal-600/40 hover:scale-[1.01] focus:outline-none focus:ring-4 focus:ring-teal-100 disabled:cursor-not-allowed disabled:opacity-60"
            type="submit"
            disabled={submitting}
          >
            <UserPlus size={18} aria-hidden="true" />
            {submitting ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm font-medium text-slate-600">
          Already have an account?{' '}
          <Link className="font-semibold text-teal-700 transition-colors duration-200 hover:text-teal-800" to="/login">
            Sign in
          </Link>
        </p>
      </section>
    </main>
  )
}
