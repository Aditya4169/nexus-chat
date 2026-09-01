/* oxlint-disable react/set-state-in-effect */
import { Search, Users, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import api from '../api/axios'

function getId(item) {
  return item?._id ?? item?.id
}

function getInitial(name) {
  return name?.trim()?.charAt(0)?.toUpperCase() || '?'
}

function normalizeUsers(data) {
  return Array.isArray(data) ? data : data.users ?? []
}

export default function GroupCreateModal({ currentUser, isOpen, onClose, onCreated }) {
  const [groupName, setGroupName] = useState('')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [selectedUsers, setSelectedUsers] = useState([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    setGroupName('')
    setQuery('')
    setResults([])
    setSelectedUsers([])
    setError('')
  }, [isOpen])

  useEffect(() => {
    const trimmedQuery = query.trim()

    if (!isOpen || trimmedQuery.length < 2) {
      setResults([])
      return
    }

    // This debounce mirrors the sidebar lookup and keeps typing smooth.
    const timerId = window.setTimeout(async () => {
      setSearching(true)
      setError('')

      try {
        const { data } = await api.get('/users/search', { params: { q: trimmedQuery } })
        const selectedIds = new Set(selectedUsers.map((user) => getId(user)))
        const users = normalizeUsers(data).filter(
          (user) => getId(user) !== getId(currentUser) && !selectedIds.has(getId(user)),
        )
        setResults(users)
      } catch (requestError) {
        setResults([])
        setError(requestError.response?.data?.message ?? 'User search is unavailable.')
      } finally {
        setSearching(false)
      }
    }, 350)

    return () => window.clearTimeout(timerId)
  }, [currentUser, isOpen, query, selectedUsers])

  if (!isOpen) {
    return null
  }

  function addUser(user) {
    setSelectedUsers((users) => [...users, user])
    setQuery('')
    setResults([])
  }

  function removeUser(userId) {
    setSelectedUsers((users) => users.filter((user) => getId(user) !== userId))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const { data } = await api.post('/conversations/group', {
        groupName,
        participantIds: selectedUsers.map((user) => getId(user)),
      })
      onCreated(data)
      onClose()
    } catch (requestError) {
      setError(requestError.response?.data?.message ?? 'Could not create the group.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/40 px-4 backdrop-blur-sm">
      <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/20">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
              <Users size={20} aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-950">New group</h2>
              <p className="text-sm text-slate-500">Choose at least two people.</p>
            </div>
          </div>
          <button
            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            type="button"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <form className="space-y-5 p-6" onSubmit={handleSubmit}>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Group name</span>
            <input
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
              value={groupName}
              onChange={(event) => setGroupName(event.target.value)}
              placeholder="Project crew"
              required
            />
          </label>

          <div>
            <span className="text-sm font-medium text-slate-700">Members</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {selectedUsers.map((user) => (
                <span
                  className="inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1.5 text-sm font-medium text-teal-800"
                  key={getId(user)}
                >
                  {user.username}
                  <button
                    className="text-teal-700 transition hover:text-teal-950"
                    type="button"
                    onClick={() => removeUser(getId(user))}
                    aria-label={`Remove ${user.username}`}
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={18}
              aria-hidden="true"
            />
            <input
              className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-950 outline-none transition focus:border-teal-600 focus:bg-white focus:ring-4 focus:ring-teal-100"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search users to add"
            />

            {query.trim().length >= 2 ? (
              <div className="absolute z-50 mt-2 max-h-52 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-200/80">
                {searching ? <p className="px-4 py-3 text-sm text-slate-500">Searching...</p> : null}
                {!searching && results.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-slate-500">No users found.</p>
                ) : null}
                {results.map((user) => (
                  <button
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
                    key={getId(user)}
                    type="button"
                    onClick={() => addUser(user)}
                  >
                    {user.profilePicture ? (
                      <img
                        className="h-9 w-9 rounded-full object-cover"
                        src={user.profilePicture}
                        alt={`${user.username} avatar`}
                      />
                    ) : (
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-700">
                        {getInitial(user.username)}
                      </div>
                    )}
                    <span className="truncate text-sm font-medium text-slate-800">
                      {user.username}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {error ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-3 pt-2">
            <button
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 transition hover:bg-slate-50"
              type="button"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className="rounded-xl bg-teal-600 px-4 py-2 font-semibold text-white shadow-sm shadow-teal-600/20 transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-70"
              type="submit"
              disabled={submitting || selectedUsers.length < 2}
            >
              {submitting ? 'Creating...' : 'Create group'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
