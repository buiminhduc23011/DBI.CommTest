import { DataType, DeviceProfile, Protocol, Quality, RegisterRow, RegisterValidationResult, RwMode } from './types';

export function id(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function nowLabel(): string {
  return new Date().toLocaleTimeString('vi-VN', { hour12: false });
}

export function getCurrentTime(): string {
  return nowLabel();
}

export function loadFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const data = localStorage.getItem(key);
    if (!data) return defaultValue;
    return JSON.parse(data) as T;
  } catch {
    return defaultValue;
  }
}

export function saveToStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('Error saving to storage', e);
  }
}

export function toText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return `${value}`;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return '';
}

export function asDataType(value: string): DataType {
  const normalized = value.toLowerCase();
  if (normalized === 'bool' || normalized === 'boolean') return 'Bool';
  if (normalized === 'int16' || normalized === 'short') return 'Int16';
  if (normalized === 'uint16' || normalized === 'word') return 'UInt16';
  if (normalized === 'int32' || normalized === 'dint') return 'Int32';
  if (normalized === 'float' || normalized === 'real') return 'Float';
  return 'Int16';
}

export function asRw(value: string): RwMode {
  const normalized = value.toUpperCase();
  return normalized === 'W' ? 'W' : 'R';
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function toProtocol(value: unknown): Protocol | null {
  const text = toText(value);
  if (
    text === 'Modbus TCP' ||
    text === 'Siemens S7-1200' ||
    text === 'Siemens S7-1500' ||
    text === 'Mitsubishi FX3U' ||
    text === 'Mitsubishi FX5U' ||
    text === 'Delta AS' ||
    text === 'Delta DVP'
  ) {
    return text as Protocol;
  }

  return null;
}

export function toQuality(value: unknown): Quality {
  const text = toText(value).toLowerCase();
  if (text === 'bad') return 'Bad';
  if (text === 'timeout') return 'Timeout';
  return 'Good';
}

export function protocolToDriverKey(protocol: Protocol): string {
  if (protocol === 'Modbus TCP') return 'fluentmodbus';
  if (protocol === 'Delta AS' || protocol === 'Delta DVP') return 'dbi-drivers';
  if (protocol.startsWith('Siemens S7')) return 'sharp7';
  if (protocol.startsWith('Mitsubishi FX')) return 'mcpx';
  return 'fluentmodbus';
}

function toStandardModbusAddress(value: number, legacyArea?: unknown): string {
  const area = toText(legacyArea).toUpperCase();
  if (area === 'COIL') return `${value}`.padStart(5, '0');
  if (area === 'DI') return `${value >= 10001 ? value : 10000 + value}`;
  if (area === 'IR') return `${value >= 30001 ? value : 30000 + value}`;
  return `${value >= 40001 ? value : 40000 + value}`;
}

export function inferCanonicalAddress(protocol: Protocol, value: unknown, legacyArea?: unknown): string {
  const addressText = toText(value);
  if (addressText.length > 0 && /[A-Za-z]/.test(addressText)) {
    return addressText.toUpperCase();
  }

  const addressNumber = Number(addressText);
  if (Number.isFinite(addressNumber)) {
    if (protocol === 'Modbus TCP') {
      return toStandardModbusAddress(addressNumber, legacyArea);
    }

    if (protocol === 'Delta AS' || protocol === 'Delta DVP' || protocol.startsWith('Mitsubishi FX')) {
      return `D${addressNumber}`;
    }

    if (protocol.startsWith('Siemens S7')) {
      return `DB1.DBW${addressNumber}`;
    }
  }

  return protocol === 'Modbus TCP' ? '40001' : protocol.startsWith('Siemens') ? 'DB1.DBW0' : 'D0';
}

function isBoolOnlyPrefix(prefix: string): boolean {
  return ['C', 'DI', 'M', 'X', 'Y', 'S', 'TS', 'TC', 'CS', 'CC', 'SC', 'SS', 'SM'].includes(prefix);
}

function isWordOnlyPrefix(prefix: string): boolean {
  return ['IR', 'HR', 'D', 'R', 'TN', 'CN', 'SN', 'T', 'C', 'SD', 'W', 'ZR', 'Z', 'L', 'F', 'V', 'B'].includes(prefix);
}

export function validateRegisterAddress(protocol: Protocol, address: string, dataType: DataType): RegisterValidationResult {
  const text = toText(address).toUpperCase();
  if (text.length === 0) {
    return { valid: false, message: 'Address is required.' };
  }

  if (protocol === 'Modbus TCP') {
    if (/^\d{5,6}$/.test(text)) {
      const numeric = Number(text);
      if (numeric >= 1 && numeric <= 9999) {
        return dataType === 'Bool' ? { valid: true } : { valid: false, message: 'Coil 0xxxx ch? dùng Bool.' };
      }
      if (numeric >= 10001 && numeric <= 19999) {
        return dataType === 'Bool' ? { valid: true } : { valid: false, message: 'Discrete Input 1xxxx ch? dùng Bool.' };
      }
      if (numeric >= 30001 && numeric <= 39999) {
        return dataType !== 'Bool' ? { valid: true } : { valid: false, message: 'Input Register 3xxxx không dùng Bool.' };
      }
      if (numeric >= 40001 && numeric <= 49999) {
        return dataType !== 'Bool' ? { valid: true } : { valid: false, message: 'Holding Register 4xxxx không dùng Bool.' };
      }
      return { valid: false, message: 'Modbus ph?i thu?c vùng 00001/10001/30001/40001.' };
    }

    if (/^(C|DI)\d+$/.test(text)) {
      return dataType === 'Bool' ? { valid: true } : { valid: false, message: `${text.replace(/\d+/g, '')} ch? dùng Bool.` };
    }
    if (/^(IR|HR)\d+$/.test(text)) {
      return dataType !== 'Bool' ? { valid: true } : { valid: false, message: `${text.replace(/\d+/g, '')} không dùng Bool.` };
    }

    return { valid: false, message: 'Modbus address không h?p l?.' };
  }

  if (protocol.startsWith('Siemens')) {
    if (/^DB\d+\.DBX\d+\.[0-7]$/.test(text) || /^(I|Q|M)\d+\.[0-7]$/.test(text)) {
      return dataType === 'Bool' ? { valid: true } : { valid: false, message: 'Ð?a ch? bit Siemens ch? dùng Bool.' };
    }
    if (/^DB\d+\.DB(B|W|D)\d+$/.test(text) || /^(I|Q|M)(B|W|D)\d+$/.test(text)) {
      return dataType !== 'Bool' ? { valid: true } : { valid: false, message: 'Ð?a ch? byte/word/dword Siemens không dùng Bool.' };
    }
    return { valid: false, message: 'Siemens address không h?p l?.' };
  }

  const match = /^(TN|CN|TC|CC|TS|CS|SN|SC|SS|ZR|SM|SD|DX|DY|D|M|X|Y|R|S|T|C|L|F|V|B|W|Z)([0-9A-F]+)$/.exec(text);
  if (!match) {
    return { valid: false, message: `${protocol} address không h?p l?.` };
  }

  const prefix = match[1];
  if (isBoolOnlyPrefix(prefix)) {
    return dataType === 'Bool' ? { valid: true } : { valid: false, message: `${prefix} ch? dùng Bool.` };
  }
  if (isWordOnlyPrefix(prefix)) {
    return dataType !== 'Bool' ? { valid: true } : { valid: false, message: `${prefix} không dùng Bool.` };
  }

  return { valid: true };
}

export function normalizeStoredRegister(value: unknown, protocol: Protocol): RegisterRow | null {
  if (!isRecord(value)) return null;

  const tagName = toText(value.tagName);
  if (tagName.length === 0) return null;

  return {
    id: id(),
    tagName,
    address: inferCanonicalAddress(protocol, value.address, value.area),
    value: toText(value.value),
    dataType: asDataType(toText(value.dataType) || 'Int16'),
    rwMode: asRw(toText(value.rwMode) || 'R'),
    quality: toQuality(value.quality),
    lastUpdate: toText(value.lastUpdate) || '-',
  };
}

export function normalizeStoredProfile(value: unknown): DeviceProfile | null {
  if (!isRecord(value)) return null;

  const protocol = toProtocol(value.protocol);
  const name = toText(value.name);
  const host = toText(value.host);
  const port = Number(toText(value.port));
  const pollIntervalMs = Number(toText(value.pollIntervalMs)) || 1000;

  if (!protocol || name.length === 0 || host.length === 0) return null;
  if (!Number.isFinite(port) || port < 1 || port > 65535) return null;

  const rawWatchTables = Array.isArray(value.watchTables)
    ? value.watchTables
    : Array.isArray(value.registers)
      ? [{ id: id(), name: 'Watch Table 1', registers: value.registers }]
      : [];

  const watchTables = rawWatchTables
    .map((table) => {
      if (!isRecord(table)) return null;
      const name = toText(table.name) || 'Watch Table';
      const registers = Array.isArray(table.registers)
        ? table.registers
            .map((item) => normalizeStoredRegister(item, protocol))
            .filter((item): item is RegisterRow => item !== null)
        : [];
      return { id: id(), name, registers };
    })
    .filter((table): table is DeviceProfile['watchTables'][number] => table !== null);

  const rack = value.rack !== undefined ? Number(value.rack) : undefined;
  const slot = value.slot !== undefined ? Number(value.slot) : undefined;
  const stationId = value.stationId !== undefined ? Number(value.stationId) : undefined;
  const networkNo = value.networkNo !== undefined ? Number(value.networkNo) : undefined;
  const stationNo = value.stationNo !== undefined ? Number(value.stationNo) : undefined;

  return {
    id: id(),
    name,
    protocol,
    host,
    port,
    pollIntervalMs,
    rack,
    slot,
    stationId,
    networkNo,
    stationNo,
    watchTables: watchTables.length > 0 ? watchTables : [{ id: id(), name: 'Watch Table 1', registers: [] }],
  };
}

export function normalizeStoredProfiles(value: unknown): DeviceProfile[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => normalizeStoredProfile(item))
    .filter((item): item is DeviceProfile => item !== null);
}
