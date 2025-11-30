export enum ConnectionState {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR',
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  sender: 'USER' | 'SYSTEM' | 'AI';
  text: string;
}

export interface AudioConfig {
  sampleRate: number;
}
