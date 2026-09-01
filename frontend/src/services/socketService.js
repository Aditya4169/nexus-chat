import { io } from 'socket.io-client'

let socket = null

export function acquireSocket(token) {
  if (socket?.connected) {
    return socket
  }

  socket = io(import.meta.env.VITE_SOCKET_URL, {
    auth: { token },
  })

  return socket
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}
