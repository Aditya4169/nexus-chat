/* oxlint-disable react/set-state-in-effect */
import { Search, Users, X, MessageCircle } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import api from '../api/axios'
import GroupCreateModal from './GroupCreateModal'

function getId(item) {
  return item?._id ?? item?.id
}

function getOtherParticipant(conversation, currentUser) {
  const currentUserId = getId(currentUser)

  return conversation.participants?.find((participant) => getId(participant) !== currentUserId)
}

function getConversationName(conversation, currentUser) {
  if (conversation.type === 'group') {
    return conversation.groupName || 'Group chat'
  }

  return getOtherParticipant(conversation, currentUser)?.username || 'Direct message'
}

function getConversationAvatar(conversation, currentUser) {
  if (conversation.type === 'group') {
    return null
  }

  return getOtherParticipant(conversation, currentUser)?.profilePicture
}

function getInitial(name) {
  return name?.trim()?.charAt(0)?.toUpperCase() || '?'
}

function getUnreadCount(conversation, currentUser) {
  const currentUserId = getId(currentUser)
  const unreadEntry = conversation.unreadCounts?.find(
    (entry) => getId(entry.user) === currentUserId || entry.user === currentUserId,
  )

  return unreadEntry?.count ?? 0
}

function formatRelativeTime(value) {
  if (!value) {
    return ''
  }

  const date = new Date(value)
  const diffMs = Date.now() - date.getTime()
  const diffMinutes = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMinutes < 1) return 'Just now'
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function normalizeList(data) {
  return Array.isArray(data) ? data : data.users ?? data.conversations ?? []
}

function formatMessagePreview(message) {
  if (!message) return 'No messages yet'
  if (message.messageType === 'image') return '📷 Photo'
  if (message.messageType === 'file') return `📎 ${message.fileName || 'File'}`
  return message.text || 'No messages yet'
}

export default function Sidebar({
  conversations,
  activeConversationId,
  onSelectConversation,
  onConversationsUpdate,
  currentUser,
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [creatingDirectId, setCreatingDirectId] = useState('')
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false)

  useEffect(() => {
    onConversationsUpdate()
  }, [onConversationsUpdate])

  useEffect(() => {
    const query = searchQuery.trim()

    if (query.length < 2) {
      setSearchResults([])
      setSearchError('')
      return
    }

    // Debounce keeps the API from being called on every keystroke.
    const timerId = window.setTimeout(async () => {
      setSearching(true)
      setSearchError('')

      try {
        const { data } = await api.get('/users/search', { params: { q: query } })
        const users = normalizeList(data).filter((user) => getId(user) !== getId(currentUser))
        setSearchResults(users)
      } catch (error) {
        setSearchResults([])
        setSearchError(error.response?.data?.message ?? 'User search is unavailable.')
      } finally {
        setSearching(false)
      }
    }, 350)

    return () => window.clearTimeout(timerId)
  }, [currentUser, searchQuery])

  const sortedConversations = useMemo(() => conversations ?? [], [conversations])

  async function handleStartDirect(user) {
    const participantId = getId(user)
    setCreatingDirectId(participantId)

    try {
      const { data } = await api.post('/conversations/direct', { participantId })
      await onConversationsUpdate()
      onSelectConversation(getId(data))
      setSearchQuery('')
      setSearchResults([])
    } finally {
      setCreatingDirectId('')
    }
  }

  function renderAvatar(conversation) {
    const name = getConversationName(conversation, currentUser)
    const avatar = getConversationAvatar(conversation, currentUser)
    const otherParticipant = getOtherParticipant(conversation, currentUser)
    const isOnline = otherParticipant?.status === 'online'

    if (conversation.type === 'group') {
      return (
        <div className="relative">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-teal-600 text-white shadow-md ring-2 ring-white">
            <Users size={20} aria-hidden="true" />
          </div>
        </div>
      )
    }

    if (avatar) {
      return (
        <div className="relative">
          <img
            className="h-12 w-12 shrink-0 rounded-full object-cover ring-2 ring-white shadow-md"
            src={avatar}
            alt={`${name} avatar`}
          />
          {isOnline ? (
            <div className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white bg-teal-500 shadow-sm" />
          ) : null}
        </div>
      )
    }

    return (
      <div className="relative">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-300 to-slate-400 text-sm font-bold text-white ring-2 ring-white shadow-md">
          {getInitial(name)}
        </div>
        {isOnline ? (
          <div className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white bg-teal-500 shadow-sm" />
        ) : null}
      </div>
    )
  }

  return (
    <>
      <aside className="flex h-full w-80 shrink-0 flex-col border-r border-slate-200/40 bg-slate-50/80">
        <div className="bg-gradient-to-r from-teal-600 to-teal-700 px-5 py-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-teal-100">
                Nexus Chat
              </p>
              <h1 className="mt-1 text-xl font-bold tracking-tight text-white">Conversations</h1>
            </div>
            <button
              className="rounded-lg bg-white/20 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-teal-600/20 backdrop-blur transition-all duration-200 hover:bg-white/30 hover:scale-[1.02] focus:outline-none focus:ring-4 focus:ring-white/20"
              type="button"
              onClick={() => setIsGroupModalOpen(true)}
            >
              New Group
            </button>
          </div>

          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={18}
              aria-hidden="true"
            />
            <input
              className="w-full rounded-lg border border-slate-200/40 bg-white px-10 py-3 text-sm font-medium text-slate-950 outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-teal-400 focus:bg-white focus:ring-2 focus:ring-teal-200"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search users..."
            />
            {searchQuery ? (
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors duration-200 hover:text-slate-600"
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
              >
                <X size={16} aria-hidden="true" />
              </button>
            ) : null}
          </div>

          {searchQuery.trim().length >= 2 ? (
            <div className="absolute z-20 mt-2 w-72 overflow-hidden rounded-lg border border-slate-200/60 bg-white shadow-[0_8px_32px_rgba(0,0,0,0.1)]">
              {searching ? (
                <p className="px-4 py-4 text-sm font-medium text-slate-500">Searching...</p>
              ) : null}
              {!searching && searchError ? (
                <p className="px-4 py-4 text-sm font-medium text-red-600">{searchError}</p>
              ) : null}
              {!searching && !searchError && searchResults.length === 0 ? (
                <p className="px-4 py-4 text-sm font-medium text-slate-500">No users found.</p>
              ) : null}
              {searchResults.map((user) => (
                <button
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors duration-200 hover:bg-teal-50/50"
                  key={getId(user)}
                  type="button"
                  onClick={() => handleStartDirect(user)}
                  disabled={creatingDirectId === getId(user)}
                >
                  {user.profilePicture ? (
                    <img
                      className="h-10 w-10 shrink-0 rounded-full object-cover"
                      src={user.profilePicture}
                      alt={`${user.username} avatar`}
                    />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-100 to-teal-50 text-sm font-semibold text-teal-700">
                      {getInitial(user.username)}
                    </div>
                  )}
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">
                    {user.username}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {sortedConversations.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-teal-50">
                  <MessageCircle size={28} className="text-teal-600" aria-hidden="true" />
                </div>
                <p className="text-sm font-semibold text-slate-600">No conversations yet</p>
                <p className="mt-1 text-xs text-slate-500">Search for users or create a group to get started</p>
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            {sortedConversations.map((conversation) => {
              const conversationId = getId(conversation)
              const name = getConversationName(conversation, currentUser)
              const unreadCount = getUnreadCount(conversation, currentUser)
              const isActive = activeConversationId === conversationId
              const preview = formatMessagePreview(conversation.lastMessage)
              const timestamp = formatRelativeTime(
                conversation.lastMessage?.createdAt ?? conversation.updatedAt,
              )

              return (
                <button
                  className={`group flex w-full gap-3.5 rounded-xl px-4 py-4 text-left transition-all duration-200 ${
                    isActive
                      ? 'bg-teal-50/90 shadow-[0_2px_12px_rgba(20,184,166,0.15)] ring-1 ring-teal-200/60'
                      : 'hover:bg-white/60'
                  }`}
                  key={conversationId}
                  type="button"
                  onClick={() => onSelectConversation(conversationId)}
                >
                  {renderAvatar(conversation)}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`truncate text-sm font-semibold ${isActive ? 'text-slate-950' : 'text-slate-900'}`}>{name}</p>
                      {timestamp ? (
                        <span className="shrink-0 text-xs font-medium text-slate-400">{timestamp}</span>
                      ) : null}
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <p className="min-w-0 flex-1 truncate text-sm text-slate-500 group-hover:text-slate-600">{preview}</p>
                      {unreadCount > 0 ? (
                        <span className="flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-600 to-teal-700 px-2 py-1 text-xs font-bold text-white shadow-lg shadow-teal-600/30 min-w-6">
                          {unreadCount}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </aside>

      <GroupCreateModal
        currentUser={currentUser}
        isOpen={isGroupModalOpen}
        onClose={() => setIsGroupModalOpen(false)}
        onCreated={async (conversation) => {
          await onConversationsUpdate()
          onSelectConversation(getId(conversation))
        }}
      />
    </>
  )
}
