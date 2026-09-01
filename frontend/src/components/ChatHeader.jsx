import { MoreVertical, Users } from 'lucide-react'

function getId(item) {
  return item?._id ?? item?.id
}

function getOtherParticipant(conversation, currentUser) {
  const currentUserId = getId(currentUser)

  return conversation.participants?.find((participant) => getId(participant) !== currentUserId)
}

function getInitial(name) {
  return name?.trim()?.charAt(0)?.toUpperCase() || '?'
}

function formatLastSeen(value) {
  if (!value) {
    return 'Offline'
  }

  const date = new Date(value)
  const diffMinutes = Math.floor((Date.now() - date.getTime()) / 60000)

  if (diffMinutes < 1) return 'Last seen just now'
  if (diffMinutes < 60) return `Last seen ${diffMinutes}m ago`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `Last seen ${diffHours}h ago`

  return `Last seen ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
}

export default function ChatHeader({ conversation, currentUser }) {
  const otherParticipant = getOtherParticipant(conversation, currentUser)
  const isGroup = conversation.type === 'group'
  const name = isGroup ? conversation.groupName : otherParticipant?.username
  const isOnline = !isGroup && otherParticipant?.status === 'online'
  const subtitle = isGroup
    ? `${conversation.participants?.length ?? 0} members`
    : otherParticipant?.status === 'online'
      ? 'Online'
      : formatLastSeen(otherParticipant?.lastSeen)

  return (
    <header className="flex h-20 items-center gap-4 border-b border-slate-200/40 bg-white px-6 shadow-sm shadow-slate-200/15">
      {isGroup ? (
        <div className="relative">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-teal-600 text-white shadow-md ring-2 ring-white">
            <Users size={24} aria-hidden="true" />
          </div>
        </div>
      ) : otherParticipant?.profilePicture ? (
        <div className="relative">
          <img
            className="h-14 w-14 shrink-0 rounded-full object-cover ring-2 ring-white shadow-md"
            src={otherParticipant.profilePicture}
            alt={`${name} avatar`}
          />
          {isOnline ? (
            <div className="absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-white bg-teal-500 shadow-sm" />
          ) : null}
        </div>
      ) : (
        <div className="relative">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-300 to-slate-400 text-sm font-bold text-white ring-2 ring-white shadow-md">
            {getInitial(name)}
          </div>
          {isOnline ? (
            <div className="absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-white bg-teal-500 shadow-sm" />
          ) : null}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <h2 className="truncate text-lg font-bold tracking-tight text-slate-950">
          {name || 'Conversation'}
        </h2>
        <p
          className={`mt-0.5 text-sm font-medium ${
            subtitle === 'Online' ? 'text-teal-600' : 'text-slate-500'
          }`}
        >
          {subtitle}
        </p>
      </div>

      <button
        className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 transition-all duration-200 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-200"
        type="button"
        aria-label="More options"
      >
        <MoreVertical size={20} aria-hidden="true" />
      </button>
    </header>
  )
}
