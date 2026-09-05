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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-black px-4 py-10">
      <div className="pointer-events-none absolute -right-20 top-1/3 h-72 w-72 rounded-full bg-amber-500/10 blur-3xl" />
      <section className="animate-page-enter relative w-full max-w-md rounded-2xl border border-white/10 bg-slate-900/65 p-8 shadow-[0_0_70px_rgba(245,158,11,0.12)] backdrop-blur-xl">
        <div className="mb-8 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-300 to-amber-500 text-slate-950 shadow-lg shadow-amber-500/30">
            <MessageCircle size={24} aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-[0.02em] text-slate-100">Create account</h1>
            <p className="mt-1 text-sm font-medium text-slate-400">Start chatting with Nexus</p>
          </div>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <label className="block">
            <span className="text-sm font-semibold text-slate-300">Username</span>
            <input
              className="mt-2.5 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-3.5 text-slate-100 outline-none transition-all duration-300 placeholder:text-slate-500 focus:border-amber-400/70 focus:bg-black/30 focus:ring-4 focus:ring-amber-400/10"
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="nexus_user"
              autoComplete="username"
              required
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-slate-300">Email</span>
            <input
              className="mt-2.5 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-3.5 text-slate-100 outline-none transition-all duration-300 placeholder:text-slate-500 focus:border-amber-400/70 focus:bg-black/30 focus:ring-4 focus:ring-amber-400/10"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-slate-300">Password</span>
            <input
              className="mt-2.5 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-3.5 text-slate-100 outline-none transition-all duration-300 placeholder:text-slate-500 focus:border-amber-400/70 focus:bg-black/30 focus:ring-4 focus:ring-amber-400/10"
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
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-amber-400 to-amber-500 px-4 py-3.5 font-semibold text-slate-950 shadow-lg shadow-amber-500/20 transition-all duration-300 hover:scale-[1.01] hover:shadow-[0_0_24px_rgba(245,158,11,0.35)] active:scale-95 focus:outline-none focus:ring-4 focus:ring-amber-400/20 disabled:cursor-not-allowed disabled:opacity-60"
            type="submit"
            disabled={submitting}
          >
            <UserPlus size={18} aria-hidden="true" />
            {submitting ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm font-medium text-slate-400">
          Already have an account?{' '}
          <Link className="font-semibold text-amber-400 transition-colors duration-200 hover:text-amber-300" to="/login">
            Sign in
          </Link>
        </p>
      </section>
    </main>
  )
}
