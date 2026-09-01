/* oxlint-disable react/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import api from '../api/axios'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(() => localStorage.getItem('token'))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function checkExistingSession() {
      const savedToken = localStorage.getItem('token')

      if (!savedToken) {
        setLoading(false)
        return
      }

      try {
        const { data } = await api.get('/users/me')
        setToken(savedToken)
        setUser(data.user ?? data)
      } catch {
        localStorage.removeItem('token')
        setToken(null)
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    checkExistingSession()
  }, [])

  async function login(email, password) {
    try {
      const { data } = await api.post('/auth/login', { email, password })
      const nextToken = data.token
      const nextUser = data.user

      localStorage.setItem('token', nextToken)
      setToken(nextToken)
      setUser(nextUser)

      return { success: true }
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message ?? 'Login failed. Please try again.',
      }
    }
  }

  async function register(username, email, password) {
    try {
      const { data } = await api.post('/auth/register', {
        username,
        email,
        password,
      })
      const nextToken = data.token
      const nextUser = data.user

      localStorage.setItem('token', nextToken)
      setToken(nextToken)
      setUser(nextUser)

      return { success: true }
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message ?? 'Registration failed. Please try again.',
      }
    }
  }

  function logout() {
    localStorage.removeItem('token')
    setToken(null)
    setUser(null)
  }

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      isAuthenticated: Boolean(token && user),
      login,
      register,
      logout,
    }),
    [user, token, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used inside an AuthProvider')
  }

  return context
}
