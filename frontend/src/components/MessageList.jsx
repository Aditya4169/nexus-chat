import { Check, CheckCheck, FileText } from 'lucide-react'
import { useEffect, useRef } from 'react'

function getId(item) {
  return item?._id ?? item?.id
}

function formatTime(value) {
  if (!value) {
    return ''
  }

  return new Date(value).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
}

function resolveFileUrl(fileUrl) {
  if (!fileUrl) {
    return ''
  }

  if (fileUrl.startsWith('http')) {
    return fileUrl
  }

  const apiUrl = import.meta.env.VITE_API_URL ?? ''
  const serverUrl = import.meta.env.VITE_SOCKET_URL ?? apiUrl.replace(/\/api\/?$/, '')

  return `${serverUrl}${fileUrl}`
}

function hasBeenSeen(message, currentUserId) {
  return message.seenBy?.some((user) => {
    const seenUserId = getId(user) ?? user
    return seenUserId && seenUserId !== currentUserId
  })
}

export default function MessageList({ messages, currentUserId, isGroup = false }) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages])

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-gradient-to-b from-slate-50 to-white px-6 py-6">
      <div className="mx-auto flex max-w-3xl flex-col">
        {messages.map((message, index) => {
          const messageId = getId(message)
          const senderId = getId(message.sender) ?? message.sender
          const previousSenderId =
            getId(messages[index - 1]?.sender) ?? messages[index - 1]?.sender
          const isOwnMessage = senderId === currentUserId
          const isGroupedWithPrevious = previousSenderId === senderId
          const fileUrl = resolveFileUrl(message.fileUrl)

          return (
            <div
              className={`flex animate-fade-in ${isOwnMessage ? 'justify-end' : 'justify-start'} ${
                isGroupedWithPrevious ? 'mt-1' : 'mt-6'
              } first:mt-0`}
              key={messageId}
            >
              <div className={`max-w-[78%] ${isOwnMessage ? 'items-end' : 'items-start'}`}>
                {isGroup && !isOwnMessage && !isGroupedWithPrevious ? (
                  <p className="mb-2 px-1 text-xs font-semibold text-slate-500">
                    {message.sender?.username ?? 'Unknown user'}
                  </p>
                ) : null}

                <div
                  className={`rounded-2xl px-4 py-2.5 ${
                    isOwnMessage
                      ? 'rounded-br-md bg-gradient-to-br from-teal-500 to-teal-600 text-white shadow-lg shadow-teal-600/25'
                      : 'rounded-bl-md border border-slate-100 bg-white text-slate-900 shadow-sm'
                  }`}
                >
                  {message.messageType === 'image' ? (
                    <a href={fileUrl} target="_blank" rel="noreferrer">
                      <img
                        className="max-h-80 rounded-xl border border-slate-100 object-contain shadow-md"
                        src={fileUrl}
                        alt={message.fileName || 'Shared image'}
                      />
                    </a>
                  ) : null}

                  {message.messageType === 'file' ? (
                    <a
                      className={`flex items-center gap-3 rounded-xl px-3 py-2 transition ${
                        isOwnMessage
                          ? 'bg-white/15 hover:bg-white/25'
                          : 'bg-slate-100/60 hover:bg-slate-200'
                      }`}
                      href={fileUrl}
                      download={message.fileName}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <FileText size={20} aria-hidden="true" />
                      <span className="min-w-0 truncate text-sm font-medium">
                        {message.fileName || 'Download file'}
                      </span>
                    </a>
                  ) : null}

                  {message.messageType !== 'image' && message.messageType !== 'file' ? (
                    <p className="whitespace-pre-wrap break-words text-sm leading-6">
                      {message.text}
                    </p>
                  ) : null}
                </div>

                <div
                  className={`mt-1.5 flex items-center gap-1 px-1 text-xs ${
                    isOwnMessage ? 'justify-end text-slate-400' : 'justify-start text-slate-400'
                  }`}
                >
                  <span>{formatTime(message.createdAt)}</span>
                  {isOwnMessage ? (
                    hasBeenSeen(message, currentUserId) ? (
                      <CheckCheck className="text-teal-300" size={14} aria-label="Seen" />
                    ) : (
                      <Check size={14} aria-label="Delivered" />
                    )
                  ) : null}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
