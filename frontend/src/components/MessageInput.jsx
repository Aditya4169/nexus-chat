import { FileText, Image, Paperclip, Send, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import api from '../api/axios'

export default function MessageInput({
  conversationId,
  socket,
  onFileMessageCreated,
  onConversationsRefresh,
}) {
  const [text, setText] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const fileInputRef = useRef(null)
  const photoVideoInputRef = useRef(null)
  const documentInputRef = useRef(null)
  const menuRef = useRef(null)
  const paperclipButtonRef = useRef(null)
  const stopTypingTimerRef = useRef(null)
  const typingRef = useRef(false)

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        isMenuOpen &&
        menuRef.current &&
        !menuRef.current.contains(event.target) &&
        !paperclipButtonRef.current?.contains(event.target)
      ) {
        setIsMenuOpen(false)
      }
    }

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isMenuOpen])

  useEffect(() => {
    return () => {
      window.clearTimeout(stopTypingTimerRef.current)
      if (typingRef.current) {
        socket?.emit('stopTyping', { conversationId })
      }
    }
  }, [conversationId, socket])

  function emitTypingActivity() {
    if (!socket || !conversationId) {
      return
    }

    if (!typingRef.current) {
      socket.emit('typing', { conversationId })
      typingRef.current = true
    }

    // A quiet period ends the typing indicator for other participants.
    window.clearTimeout(stopTypingTimerRef.current)
    stopTypingTimerRef.current = window.setTimeout(() => {
      socket.emit('stopTyping', { conversationId })
      typingRef.current = false
    }, 2000)
  }

  function stopTypingNow() {
    window.clearTimeout(stopTypingTimerRef.current)

    if (typingRef.current) {
      socket?.emit('stopTyping', { conversationId })
      typingRef.current = false
    }
  }

  function handlePhotoVideoSelect() {
    setIsMenuOpen(false)
    photoVideoInputRef.current?.click()
  }

  function handleDocumentSelect() {
    setIsMenuOpen(false)
    documentInputRef.current?.click()
  }

  function handleFileSelected(file) {
    if (file) {
      setSelectedFile(file)
    }
  }

  function handleTextChange(event) {
    setText(event.target.value)
    emitTypingActivity()
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSend()
    }
  }

  async function handleSend() {
    const trimmedText = text.trim()

    if (!trimmedText && !selectedFile) {
      return
    }

    setSending(true)
    setError('')
    stopTypingNow()

    try {
      if (selectedFile) {
        const formData = new FormData()
        formData.append('conversationId', conversationId)
        formData.append('file', selectedFile)

        if (trimmedText) {
          formData.append('text', trimmedText)
        }

        const { data } = await api.post('/messages', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })

        // REST uploads may not broadcast in older backend code, so keep sender UI current.
        onFileMessageCreated?.(data)
        onConversationsRefresh?.()
      } else {
        socket?.emit('sendMessage', {
          conversationId,
          text: trimmedText,
          messageType: 'text',
        })
      }

      setText('')
      setSelectedFile(null)
      if (photoVideoInputRef.current) {
        photoVideoInputRef.current.value = ''
      }
      if (documentInputRef.current) {
        documentInputRef.current.value = ''
      }
    } catch (requestError) {
      setError(requestError.response?.data?.message ?? 'Could not send the message.')
    } finally {
      setSending(false)
    }
  }

  return (
    <footer className="border-t border-slate-200/40 bg-white px-3 md:px-5 py-3 md:py-4 shadow-sm shadow-slate-200/15">
      {selectedFile ? (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-teal-200/50 bg-teal-50/60 px-4 py-3 text-sm text-teal-900">
          <div className="min-w-0">
            <p className="truncate font-semibold">{selectedFile.name}</p>
            <p className="mt-0.5 text-xs font-medium text-teal-700">{Math.ceil(selectedFile.size / 1024)} KB</p>
          </div>
          <button
            className="rounded-full p-1 text-teal-700 transition-all duration-200 hover:bg-teal-100 hover:text-teal-950 hover:scale-110"
            type="button"
            onClick={() => setSelectedFile(null)}
            aria-label="Remove attachment"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="mb-4 rounded-lg border border-red-200/50 bg-red-50/60 px-4 py-3 text-sm font-medium text-red-700 animate-fade-in">
          {error}
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <input
          ref={photoVideoInputRef}
          className="hidden"
          type="file"
          accept="image/*,video/*"
          onChange={(event) => handleFileSelected(event.target.files?.[0] ?? null)}
        />
        <input
          ref={documentInputRef}
          className="hidden"
          type="file"
          accept=".pdf,.doc,.docx,.txt"
          onChange={(event) => handleFileSelected(event.target.files?.[0] ?? null)}
        />

        <div className="relative">
          <button
            ref={paperclipButtonRef}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100/80 text-slate-600 transition-all duration-200 hover:bg-slate-200 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-200"
            type="button"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Attach file"
          >
            <Paperclip size={18} aria-hidden="true" />
          </button>

          {isMenuOpen ? (
            <div
              ref={menuRef}
              className="absolute bottom-full left-0 right-0 md:left-auto md:right-0 mb-3 mx-2 md:mx-0 max-w-[calc(100vw-1.5rem)] md:max-w-none md:w-48 rounded-lg border border-slate-200/50 bg-white shadow-[0_8px_32px_rgba(0,0,0,0.12)] animate-fade-in z-50"
            >
              <button
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left font-medium text-slate-900 transition-colors duration-150 hover:bg-teal-50/60 first:rounded-t-lg"
                type="button"
                onClick={handlePhotoVideoSelect}
              >
                <Image size={20} className="shrink-0 text-teal-600" aria-hidden="true" />
                <span>Photo & Video</span>
              </button>
              <button
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left font-medium text-slate-900 transition-colors duration-150 hover:bg-teal-50/60 last:rounded-b-lg"
                type="button"
                onClick={handleDocumentSelect}
              >
                <FileText size={20} className="shrink-0 text-teal-600" aria-hidden="true" />
                <span>Document</span>
              </button>
            </div>
          ) : null}
        </div>

        <textarea
          className="max-h-32 min-h-10 flex-1 resize-none rounded-full border border-slate-200/50 bg-slate-100 px-5 py-3 text-sm font-medium leading-6 text-slate-950 outline-none transition-all duration-200 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-teal-500"
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          placeholder="Write a message..."
          rows={1}
        />

        <button
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-teal-600 to-teal-700 text-white shadow-lg shadow-teal-600/30 transition-all duration-200 hover:shadow-lg hover:shadow-teal-600/40 active:scale-95 focus:outline-none focus:ring-2 focus:ring-teal-200 disabled:cursor-not-allowed disabled:opacity-50 disabled:scale-100"
          type="button"
          onClick={handleSend}
          disabled={sending || (!text.trim() && !selectedFile)}
          aria-label="Send message"
        >
          <Send size={18} aria-hidden="true" />
        </button>
      </div>
    </footer>
  )
}
