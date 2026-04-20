export type Quality = 'Good' | 'Bad' | 'Timeout' | 'N/A';
export type Protocol = 'Modbus TCP' | 'Siemens S7-1200' | 'Siemens S7-1500' | 'Mitsubishi FX3U' | 'Mitsubishi FX5U' | 'Delta AS' | 'Delta DVP';
export type DataType = 'Bool' | 'Int16' | 'UInt16' | 'Int32' | 'Float';
export type RwMode = 'R' | 'W';

export interface RegisterRow {
  id: string;
  tagName: string;
  address: string;
  value: string;
  dataType: DataType;
  rwMode: RwMode;
  quality: Quality;
  lastUpdate: string;
}

export interface WatchTable {
  id: string;
  name: string;
  registers: RegisterRow[];
}

export interface DeviceProfile {
  id: string;
  name: string;
  protocol: Protocol;
  host: string;
  port: number;
  pollIntervalMs: number;
  rack?: number;
  slot?: number;
  stationId?: number;
  networkNo?: number;
  stationNo?: number;
  watchTables: WatchTable[];
}

export type ProfileFormValue = Omit<DeviceProfile, 'id' | 'watchTables'>;

export interface RuntimeApiResult {
  ok: boolean;
  message?: string;
  data?: Record<string, unknown>;
}

export interface TraceLog {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
}

export interface RuntimeConnectionState {
  runtimeId?: string;
  profileId?: string;
  profileName?: string;
  protocol?: string;
  status: 'connecting' | 'polling' | 'error' | 'disconnected';
  retryCount: number;
  skippedPollCount: number;
  pollErrorCount: number;
  lastPollAt?: string;
  lastSuccessAt?: string;
  lastCycleDurationMs?: number;
  lastError?: string;
}

export interface RegisterValidationResult {
  valid: boolean;
  message?: string;
}

export interface AppState {
  profiles: DeviceProfile[];
  activeProfileId?: string;
  pollIntervalMs: number;
  logs: TraceLog[];
  mapPreviewRows: unknown[];
  mapErrors: string[];
}
