/* oxlint-disable react/set-state-in-effect */
import { LogOut, MessageCircle } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'
import ChatHeader from '../components/ChatHeader'
import MessageInput from '../components/MessageInput'
import MessageList from '../components/MessageList'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../context/AuthContext'
import { acquireSocket, disconnectSocket } from '../services/socketService'

function getId(item) {
  return item?._id ?? item?.id
}

function getUnreadCount(conversation, currentUserId) {
  const unreadEntry = conversation.unreadCounts?.find(
    (entry) => getId(entry.user) === currentUserId || entry.user === currentUserId,
  )
  return unreadEntry?.count ?? 0
}

export default function Chat() {
  const navigate = useNavigate()
  const { logout, token, user } = useAuth()
  const [conversations, setConversations] = useState([])
  const [activeConversationId, setActiveConversationId] = useState(null)
  const [messages, setMessages] = useState([])
  const [loadingConversations, setLoadingConversations] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [conversationError, setConversationError] = useState('')
  const [messageError, setMessageError] = useState('')
  const [typingUsers, setTypingUsers] = useState([])
  const [socket, setSocket] = useState(null)
  const activeConversationIdRef = useRef(null)
  const currentUserIdRef = useRef(null)
  const fetchConversationsRef = useRef(null)

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId
  }, [activeConversationId])

  useEffect(() => {
    currentUserIdRef.current = getId(user)
  }, [user])

  const activeConversation = useMemo(
    () => conversations.find((conversation) => getId(conversation) === activeConversationId),
    [activeConversationId, conversations],
  )

  const fetchConversations = useCallback(async () => {
    console.log('[DEBUG] fetchConversations() called')
    setLoadingConversations(true)
    setConversationError('')

    try {
      const { data } = await api.get('/conversations')
      const conversationsArray = Array.isArray(data) ? data : data.conversations ?? []
      console.log('[DEBUG] fetchConversations response:', conversationsArray.map(c => ({
        id: getId(c),
        name: c.type === 'group' ? c.groupName : c.participants?.[0]?.username,
        unreadCounts: c.unreadCounts
      })))
      setConversations(conversationsArray)
    } catch (error) {
      setConversationError(
        error.response?.data?.message ?? 'Could not load your conversations.',
      )
    } finally {
      setLoadingConversations(false)
    }
  }, [])

  useEffect(() => {
    fetchConversationsRef.current = fetchConversations
  }, [fetchConversations])

  function appendMessage(nextMessage) {
    setMessages((currentMessages) => {
      const nextMessageId = getId(nextMessage)

      if (currentMessages.some((message) => getId(message) === nextMessageId)) {
        return currentMessages
      }

      return [...currentMessages, nextMessage]
    })
  }

  useEffect(() => {
    if (!token) {
      return
    }

    const nextSocket = acquireSocket(token)
    setSocket(nextSocket)

    function handleNewMessage(message) {
      const conversationId = getId(message.conversation) ?? message.conversation
      console.log('[DEBUG] handleNewMessage received:', { messageId: getId(message), conversationId, activeConversationId: activeConversationIdRef.current })

      if (conversationId === activeConversationIdRef.current) {
        appendMessage(message)
      }

      console.log('[DEBUG] handleNewMessage calling fetchConversationsRef')
      fetchConversationsRef.current?.()
    }

    function handleUserTyping({ userId, conversationId }) {
      if (conversationId !== activeConversationIdRef.current || userId === currentUserIdRef.current) {
        return
      }

      setTypingUsers((currentUsers) =>
        currentUsers.includes(userId) ? currentUsers : [...currentUsers, userId],
      )
    }

    function handleUserStoppedTyping({ userId, conversationId }) {
      if (conversationId !== activeConversationIdRef.current) {
        return
      }

      setTypingUsers((currentUsers) => currentUsers.filter((id) => id !== userId))
    }

    function handleMessageUpdated(updatedMessage) {
      setMessages((currentMessages) =>
        currentMessages.map((message) =>
          getId(message) === getId(updatedMessage) ? updatedMessage : message,
        ),
      )
      fetchConversationsRef.current?.()
    }

    function handleMessageDeleted({ messageId }) {
      setMessages((currentMessages) =>
        currentMessages.filter((message) => getId(message) !== messageId),
      )
      fetchConversationsRef.current?.()
    }

    function handleMessageRead({ messageId, userId }) {
      setMessages((currentMessages) =>
        currentMessages.map((message) => {
          if (getId(message) !== messageId) {
            return message
          }

          const seenBy = message.seenBy ?? []
          const hasUser = seenBy.some((seenUser) => (getId(seenUser) ?? seenUser) === userId)

          return hasUser ? message : { ...message, seenBy: [...seenBy, userId] }
        }),
      )
    }

    function handleMessageError(error) {
      setMessageError(error.message ?? 'Something went wrong with messaging.')
    }

    nextSocket.on('newMessage', handleNewMessage)
    nextSocket.on('userTyping', handleUserTyping)
    nextSocket.on('userStoppedTyping', handleUserStoppedTyping)
    nextSocket.on('messageUpdated', handleMessageUpdated)
    nextSocket.on('messageDeleted', handleMessageDeleted)
    nextSocket.on('messageRead', handleMessageRead)
    nextSocket.on('messageError', handleMessageError)

    return () => {
      nextSocket.off('newMessage', handleNewMessage)
      nextSocket.off('userTyping', handleUserTyping)
      nextSocket.off('userStoppedTyping', handleUserStoppedTyping)
      nextSocket.off('messageUpdated', handleMessageUpdated)
      nextSocket.off('messageDeleted', handleMessageDeleted)
      nextSocket.off('messageRead', handleMessageRead)
      nextSocket.off('messageError', handleMessageError)
      disconnectSocket()
    }
  }, [token])

  useEffect(() => {
    if (!socket || !activeConversationId) {
      setMessages([])
      setTypingUsers([])
      return
    }

    socket.emit('joinConversation', activeConversationId)
    setTypingUsers([])
    setMessageError('')

    async function fetchMessages() {
      setLoadingMessages(true)

      try {
        const { data } = await api.get(`/messages/${activeConversationId}`)
        setMessages(data.messages ?? [])
      } catch (error) {
        setMessages([])
        setMessageError(error.response?.data?.message ?? 'Could not load messages.')
      } finally {
        setLoadingMessages(false)
      }
    }

    async function markAsRead() {
      console.log('[DEBUG] markAsRead() called with activeConversationId:', activeConversationId)
      
      try {
        const requestUrl = `/conversations/${activeConversationId}/read`
        console.log('[DEBUG] Sending PATCH request to:', requestUrl)
        
        const { data: updatedConversation } = await api.patch(requestUrl)
        
        console.log('[DEBUG] PATCH response received:', updatedConversation)
        console.log('[DEBUG] Updated conversation unreadCounts:', updatedConversation.unreadCounts)
        
        // Update local state with the response from the server
        setConversations((prevConversations) => {
          console.log('[DEBUG] Current conversations state BEFORE update:', prevConversations.map(c => ({
            id: getId(c),
            name: c.type === 'group' ? c.groupName : c.participants?.[0]?.username,
            unreadCount: getUnreadCount(c, currentUserIdRef.current)
          })))
          
          const updated = prevConversations.map((conv) => {
            const convId = getId(conv)
            const match = convId === activeConversationId
            console.log(`[DEBUG] Checking conv ${convId}: match=${match}`)
            return match ? updatedConversation : conv
          })
          
          console.log('[DEBUG] Current conversations state AFTER update:', updated.map(c => ({
            id: getId(c),
            name: c.type === 'group' ? c.groupName : c.participants?.[0]?.username,
            unreadCount: getUnreadCount(c, currentUserIdRef.current)
          })))
          
          return updated
        })
      } catch (error) {
        console.error('[DEBUG] Failed to mark conversation as read:', error)
      }
    }

    console.log('[DEBUG] useEffect triggered: activeConversationId=', activeConversationId)
    fetchMessages()
    markAsRead()

    return () => {
      socket.emit('leaveConversation', activeConversationId)
    }
  }, [activeConversationId, socket])

  const typingLabel = useMemo(() => {
    if (!activeConversation || typingUsers.length === 0) {
      return ''
    }

    const names = typingUsers
      .map(
        (userId) =>
          activeConversation.participants?.find((participant) => getId(participant) === userId)
            ?.username,
      )
      .filter(Boolean)

    if (names.length === 0) {
      return 'Someone is typing...'
    }

    return names.length === 1 ? `${names[0]} is typing...` : 'Several people are typing...'
  }, [activeConversation, typingUsers])

  function handleLogout() {
    disconnectSocket()
    logout()
    navigate('/login')
  }

  return (
    <main className="animate-page-enter flex h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-black text-slate-100">
      {/* Sidebar: hidden on mobile when conversation selected, visible otherwise */}
      <div className={`${activeConversationId ? 'hidden md:flex' : 'flex md:flex'} flex-col`}>
        <Sidebar
          conversations={conversations}
          activeConversationId={activeConversationId}
          currentUser={user}
          onSelectConversation={setActiveConversationId}
          onConversationsUpdate={fetchConversations}
        />
      </div>

      {/* Chat section: hidden on mobile when no conversation selected, visible when selected */}
      <section className={`flex min-w-0 flex-1 flex-col ${activeConversationId ? 'flex md:flex' : 'hidden md:flex'}`}>
        <div className="flex h-16 items-center justify-between border-b border-white/10 bg-slate-900/60 px-3 shadow-sm shadow-black/20 backdrop-blur-xl md:px-6">
          <div className="flex min-w-0 items-center gap-3 md:gap-4">
            {/* Logo visible only on desktop */}
            <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 text-slate-950 shadow-lg shadow-amber-500/20 ring-1 ring-amber-300/30 md:flex">
              <MessageCircle size={22} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="hidden truncate text-sm font-medium text-slate-500 md:block">
                Signed in as {user?.username ?? 'friend'}
              </p>
              <h1 className="truncate text-lg font-bold tracking-[0.03em] text-slate-100 md:text-xl">Nexus Chat</h1>
            </div>
          </div>

          <button
            className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 font-semibold text-slate-300 shadow-sm shadow-black/15 transition-all duration-300 hover:border-amber-400/30 hover:bg-amber-400/10 hover:text-amber-200 hover:shadow-[0_0_18px_rgba(245,158,11,0.12)] active:scale-95 focus:outline-none focus:ring-2 focus:ring-amber-400/20"
            type="button"
            onClick={handleLogout}
          >
            <LogOut size={18} aria-hidden="true" />
            Logout
          </button>
        </div>

        {activeConversation ? (
          <>
            <ChatHeader conversation={activeConversation} currentUser={user} onBackClick={() => setActiveConversationId(null)} />
            <div className="flex min-h-0 flex-1 flex-col">
              {loadingMessages ? (
                <div className="flex flex-1 items-center justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-black p-6">
                  <div className="text-center">
                    <div className="mx-auto mb-4 flex gap-1">
                      <div className="h-2 w-2 rounded-full bg-amber-400 animate-bounce" style={{animationDelay: '0ms'}}></div>
                      <div className="h-2 w-2 rounded-full bg-amber-400 animate-bounce" style={{animationDelay: '150ms'}}></div>
                      <div className="h-2 w-2 rounded-full bg-amber-400 animate-bounce" style={{animationDelay: '300ms'}}></div>
                    </div>
                    <p className="text-sm font-medium text-slate-500">Loading messages...</p>
                  </div>
                </div>
              ) : (
                <MessageList
                  currentUserId={getId(user)}
                  isGroup={activeConversation.type === 'group'}
                  messages={messages}
                />
              )}

              <div className="border-t border-white/10 bg-slate-900/40 px-5 py-3.5 shadow-sm shadow-black/20">
                {typingLabel ? (
                  <p className="flex items-center gap-1 text-sm font-semibold text-teal-400">
                    {typingLabel}
                    <span className="inline-flex gap-0.5" aria-hidden="true">
                      <span className="animate-bounce" style={{ animationDelay: '0ms' }}>.</span>
                      <span className="animate-bounce" style={{ animationDelay: '150ms' }}>.</span>
                      <span className="animate-bounce" style={{ animationDelay: '300ms' }}>.</span>
                    </span>
                  </p>
                ) : null}
                {messageError ? (
                  <div className="mt-3 rounded-lg border border-red-400/20 bg-red-950/40 px-4 py-3 text-sm font-medium text-red-300 animate-fade-in">
                    {messageError}
                  </div>
                ) : null}
              </div>

              <MessageInput
                conversationId={activeConversationId}
                onConversationsRefresh={fetchConversations}
                socket={socket}
              />
            </div>
          </>
        ) : (
          <div className="flex min-h-0 flex-1 items-center justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-black p-6">
            <div className="max-w-sm text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-400/10 shadow-md shadow-amber-500/10">
                <MessageCircle size={32} className="text-amber-400" aria-hidden="true" />
              </div>
              <h2 className="mt-6 text-xl font-bold tracking-[0.02em] text-slate-100">
                Select a conversation
              </h2>
              <p className="mt-2 text-sm font-medium text-slate-400">
                Choose an existing chat or search for someone in the sidebar to get started.
              </p>
              {loadingConversations ? (
                <div className="mt-6 flex items-center justify-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="h-2 w-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="h-2 w-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              ) : null}
              {conversationError ? (
                <div className="mt-6 rounded-lg border border-red-400/20 bg-red-950/40 px-4 py-3.5 text-sm font-medium text-red-300">
                  {conversationError}
                </div>
              ) : null}
            </div>
          </div>
        )}
      </section>
    </main>
  )
}
