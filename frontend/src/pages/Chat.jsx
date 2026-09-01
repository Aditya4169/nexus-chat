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
    <main className="flex h-screen overflow-hidden bg-white">
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
        <div className="flex h-16 items-center justify-between border-b border-slate-200/40 bg-white px-3 md:px-6 shadow-sm shadow-slate-200/15">
          <div className="flex min-w-0 items-center gap-3 md:gap-4">
            {/* Logo visible only on desktop */}
            <div className="hidden md:flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-teal-600 text-white shadow-md ring-2 ring-white">
              <MessageCircle size={22} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="hidden md:block truncate text-sm font-medium text-slate-500">
                Signed in as {user?.username ?? 'friend'}
              </p>
              <h1 className="truncate text-lg md:text-xl font-bold tracking-tight text-slate-950">Nexus Chat</h1>
            </div>
          </div>

          <button
            className="flex items-center gap-2 rounded-lg border border-slate-200/60 bg-white px-4 py-2.5 font-semibold text-slate-700 shadow-sm shadow-slate-200/15 transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-teal-200"
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
                <div className="flex flex-1 items-center justify-center bg-gradient-to-b from-slate-50 to-white p-6">
                  <div className="text-center">
                    <div className="mx-auto mb-4 flex gap-1">
                      <div className="h-2 w-2 rounded-full bg-teal-500 animate-bounce" style={{animationDelay: '0ms'}}></div>
                      <div className="h-2 w-2 rounded-full bg-teal-500 animate-bounce" style={{animationDelay: '150ms'}}></div>
                      <div className="h-2 w-2 rounded-full bg-teal-500 animate-bounce" style={{animationDelay: '300ms'}}></div>
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

              <div className="border-t border-slate-200/40 bg-white px-5 py-3.5 shadow-sm shadow-slate-200/15">
                {typingLabel ? (
                  <p className="text-sm font-semibold text-teal-600">{typingLabel}</p>
                ) : null}
                {messageError ? (
                  <div className="mt-3 rounded-lg border border-red-200/50 bg-red-50/60 px-4 py-3 text-sm font-medium text-red-700 animate-fade-in">
                    {messageError}
                  </div>
                ) : null}
              </div>

              <MessageInput
                conversationId={activeConversationId}
                onConversationsRefresh={fetchConversations}
                onFileMessageCreated={appendMessage}
                socket={socket}
              />
            </div>
          </>
        ) : (
          <div className="flex min-h-0 flex-1 items-center justify-center bg-gradient-to-b from-slate-50 to-white p-6">
            <div className="max-w-sm text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-teal-50 shadow-md">
                <MessageCircle size={32} className="text-teal-600" aria-hidden="true" />
              </div>
              <h2 className="mt-6 text-xl font-bold tracking-tight text-slate-950">
                Select a conversation
              </h2>
              <p className="mt-2 text-sm font-medium text-slate-600">
                Choose an existing chat or search for someone in the sidebar to get started.
              </p>
              {loadingConversations ? (
                <div className="mt-6 flex items-center justify-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-teal-600 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="h-2 w-2 rounded-full bg-teal-600 animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="h-2 w-2 rounded-full bg-teal-600 animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              ) : null}
              {conversationError ? (
                <div className="mt-6 rounded-lg border border-red-200/50 bg-red-50/60 px-4 py-3.5 text-sm font-medium text-red-700">
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
