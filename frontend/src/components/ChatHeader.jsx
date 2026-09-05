import { ArrowLeft, MoreVertical, Users } from 'lucide-react'

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

export default function ChatHeader({ conversation, currentUser, onBackClick }) {
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
    <header className="flex h-20 items-center gap-3 border-b border-white/10 bg-slate-900/60 px-3 shadow-sm shadow-black/20 backdrop-blur-xl md:gap-4 md:px-6">
      {/* Back button - visible only on mobile */}
      <button
        className="md:hidden flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-all duration-300 hover:bg-white/5 hover:text-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-400/20"
        type="button"
        onClick={onBackClick}
        aria-label="Back to conversations"
      >
        <ArrowLeft size={20} aria-hidden="true" />
      </button>

      {isGroup ? (
        <div className="relative">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 text-slate-950 shadow-lg shadow-amber-500/20 ring-1 ring-amber-300/30">
            <Users size={24} aria-hidden="true" />
          </div>
        </div>
      ) : otherParticipant?.profilePicture ? (
        <div className="relative">
          <img
            className="h-14 w-14 shrink-0 rounded-full object-cover ring-2 ring-slate-700 shadow-md"
            src={otherParticipant.profilePicture}
            alt={`${name} avatar`}
          />
          {isOnline ? (
            <div className="animate-pulse absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-slate-900 bg-teal-500 shadow-[0_0_12px_rgba(20,184,166,0.65)]" />
          ) : null}
        </div>
      ) : (
        <div className="relative">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-700 to-slate-800 text-sm font-bold text-slate-200 ring-1 ring-white/10 shadow-md">
            {getInitial(name)}
          </div>
          {isOnline ? (
            <div className="animate-pulse absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-slate-900 bg-teal-500 shadow-[0_0_12px_rgba(20,184,166,0.65)]" />
          ) : null}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <h2 className="truncate text-lg font-bold tracking-[0.02em] text-slate-100">
          {name || 'Conversation'}
        </h2>
        <p
          className={`mt-0.5 text-sm font-medium ${
            subtitle === 'Online' ? 'text-teal-400' : 'text-slate-500'
          }`}
        >
          {subtitle}
        </p>
      </div>

      <button
        className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 transition-all duration-300 hover:bg-white/5 hover:text-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-400/20"
        type="button"
        aria-label="More options"
      >
        <MoreVertical size={20} aria-hidden="true" />
      </button>
    </header>
  )
}
