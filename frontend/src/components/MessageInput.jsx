import { FileText, Image, Paperclip, Send, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import api from '../api/axios'

export default function MessageInput({
  conversationId,
  socket,
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

        await api.post('/messages', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })

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
    <footer className="border-t border-white/10 bg-slate-900/60 px-3 py-3 shadow-sm shadow-black/20 backdrop-blur-xl md:px-5 md:py-4">
      {selectedFile ? (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          <div className="min-w-0">
            <p className="truncate font-semibold">{selectedFile.name}</p>
            <p className="mt-0.5 text-xs font-medium text-amber-300">{Math.ceil(selectedFile.size / 1024)} KB</p>
          </div>
          <button
            className="rounded-full p-1 text-amber-300 transition-all duration-300 hover:scale-110 hover:bg-amber-400/20 hover:text-amber-100"
            type="button"
            onClick={() => setSelectedFile(null)}
            aria-label="Remove attachment"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="mb-4 rounded-lg border border-red-400/20 bg-red-950/40 px-4 py-3 text-sm font-medium text-red-300 animate-fade-in">
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
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-400 transition-all duration-300 hover:bg-amber-400/10 hover:text-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-400/20"
            type="button"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Attach file"
          >
            <Paperclip size={18} aria-hidden="true" />
          </button>

          {isMenuOpen ? (
            <div
              ref={menuRef}
              className="absolute bottom-full left-0 right-0 z-50 mx-2 mb-3 max-w-[calc(100vw-1.5rem)] rounded-lg border border-white/10 bg-slate-900/95 shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-xl animate-fade-in md:left-auto md:right-0 md:mx-0 md:max-w-none md:w-48"
            >
              <button
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left font-medium text-slate-200 transition-colors duration-150 hover:bg-amber-400/10 first:rounded-t-lg"
                type="button"
                onClick={handlePhotoVideoSelect}
              >
                <Image size={20} className="shrink-0 text-amber-400" aria-hidden="true" />
                <span>Photo & Video</span>
              </button>
              <button
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left font-medium text-slate-200 transition-colors duration-150 hover:bg-amber-400/10 last:rounded-b-lg"
                type="button"
                onClick={handleDocumentSelect}
              >
                <FileText size={20} className="shrink-0 text-amber-400" aria-hidden="true" />
                <span>Document</span>
              </button>
            </div>
          ) : null}
        </div>

        <textarea
          className="max-h-32 min-h-10 flex-1 resize-none rounded-full border border-white/10 bg-black/20 px-5 py-3 text-sm font-medium leading-6 text-slate-100 outline-none transition-all duration-300 placeholder:text-slate-500 focus:border-amber-400/60 focus:bg-black/30 focus:ring-2 focus:ring-amber-400/20"
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          placeholder="Write a message..."
          rows={1}
        />

        <button
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-lg shadow-amber-500/20 transition-all duration-300 hover:shadow-[0_0_20px_rgba(245,158,11,0.35)] active:scale-95 focus:outline-none focus:ring-2 focus:ring-amber-400/20 disabled:cursor-not-allowed disabled:scale-100 disabled:opacity-50"
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
