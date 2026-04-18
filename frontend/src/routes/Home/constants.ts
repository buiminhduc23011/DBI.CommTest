import { DataType, Protocol, RwMode, RegisterRow, DeviceProfile } from './types';
import { id } from './utils';

export const PROFILE_STORAGE_KEY = 'plc-test-studio.profiles.v2';
export const LEGACY_PROFILE_STORAGE_KEY = 'plc-test-studio.profiles.v1';
export const PROTOCOL_OPTIONS: Protocol[] = [
  'Modbus TCP',
  'Siemens S7-1200',
  'Siemens S7-1500',
  'Mitsubishi FX3U',
  'Mitsubishi FX5U',
  'Delta AS',
  'Delta DVP',
];
export const DATA_TYPE_OPTIONS: DataType[] = ['Bool', 'Int16', 'UInt16', 'Int32', 'Float'];
export const RW_OPTIONS: RwMode[] = ['R', 'W'];
export const FALLBACK_BACKEND_URL = 'http://127.0.0.1:5001';

export const baseRegisters: RegisterRow[] = [
  {
    id: id(),
    tagName: 'Motor_Run',
    address: '00001',
    value: '0',
    dataType: 'Bool',
    rwMode: 'W',
    quality: 'Good',
    lastUpdate: '-',
  },
  {
    id: id(),
    tagName: 'Line_Speed',
    address: '40001',
    value: '0',
    dataType: 'Int16',
    rwMode: 'R',
    quality: 'Good',
    lastUpdate: '-',
  },
];

export const DEFAULT_PROFILES: DeviceProfile[] = [
  {
    id: id(),
    name: 'Primary PLC',
    protocol: 'Modbus TCP',
    host: '127.0.0.1',
    port: 502,
    stationId: 1,
    pollIntervalMs: 1000,
    watchTables: [
      {
        id: id(),
        name: 'Watch Table 1',
        registers: baseRegisters,
      },
    ],
  },
];
