export type SocketEventName =
  | 'connect'
  | 'disconnect'
  | 'error'
  | 'voice:send_chunk'
  | 'voice:send_file'
  | 'voice:chunk_received'
  | 'voice:file_received'
  | 'voice:commit';
