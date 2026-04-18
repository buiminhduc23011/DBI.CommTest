import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Form, message, Modal } from 'antd';
import {
  TraceLog,
  RegisterRow,
  DeviceProfile,
  ProfileFormValue,
  WatchTable,
  RuntimeConnectionState,
  RegisterValidationResult,
} from '../types';
import { DEFAULT_PROFILES, LEGACY_PROFILE_STORAGE_KEY, PROFILE_STORAGE_KEY } from '../constants';
import {
  getCurrentTime,
  id,
  loadFromStorage,
  normalizeStoredProfiles,
  protocolToDriverKey,
  saveToStorage,
  validateRegisterAddress,
} from '../utils';
import { runtimeFetch } from '../api';

interface RuntimeReadResponse {
  items: Array<{
    tagId: string;
    value: unknown;
    quality: string;
    timestampUtc: string;
    error?: string | null;
  }>;
  stats: {
    packCount: number;
    driverRequestCount: number;
    durationMs: number;
    cacheHit: boolean;
  };
}

interface RuntimeConnectionDto {
  id: string;
  name: string;
  protocol: string;
  driverKey: string;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim().length > 0) {
      return message;
    }
  }

  return fallback;
}

export function useHomeState() {
  const [messageApi, contextHolder] = message.useMessage();
  const [profileForm] = Form.useForm<ProfileFormValue>();
  const pollTimeoutRef = useRef<number | null>(null);
  const pollInFlightRef = useRef(false);
  const pollRunnerRef = useRef<() => Promise<void>>(async () => {});
  const connectionRef = useRef<RuntimeConnectionState | null>(null);
  const startPollingImmediatelyRef = useRef(false);

  const [editingProfileId, setEditingProfileId] = useState<string | 'NEW' | undefined>();
  const [profiles, setProfiles] = useState<DeviceProfile[]>(() => {
    const current = normalizeStoredProfiles(loadFromStorage<unknown>(PROFILE_STORAGE_KEY, []));
    if (current.length > 0) return current;
    const legacy = normalizeStoredProfiles(loadFromStorage<unknown>(LEGACY_PROFILE_STORAGE_KEY, []));
    return legacy.length > 0 ? legacy : DEFAULT_PROFILES;
  });
  const [activeProfileId, setActiveProfileId] = useState<string | undefined>(profiles.length > 0 ? profiles[0].id : undefined);
  const [logs, setLogs] = useState<TraceLog[]>([]);
  const [watchTables, setWatchTables] = useState<WatchTable[]>(() => {
    const initial = profiles.length > 0 ? structuredClone(profiles[0].watchTables) : [{ id: id(), name: 'Watch Table 1', registers: [] }];
    return initial.length > 0 ? initial : [{ id: id(), name: 'Watch Table 1', registers: [] }];
  });
  const [selectedRegisterId, setSelectedRegisterId] = useState<string | undefined>();
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileManagerOpen, setProfileManagerOpen] = useState(false);
  const [connection, setConnection] = useState<RuntimeConnectionState | null>(null);

  const activeProfile = useMemo(
    () => profiles.find((p) => p.id === activeProfileId),
    [profiles, activeProfileId]
  );
  const pollIntervalMs = activeProfile?.pollIntervalMs ?? 1000;

  useEffect(() => {
    connectionRef.current = connection;
  }, [connection]);

  const clearScheduledPoll = useCallback(() => {
    if (pollTimeoutRef.current !== null) {
      window.clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
  }, []);

  const addTrace = useCallback((level: TraceLog['level'], msg: string) => {
    setLogs((prev) => {
      const clone = [...prev, { id: id(), timestamp: getCurrentTime(), level, message: msg }];
      return clone.length > 200 ? clone.slice(clone.length - 200) : clone;
    });
  }, []);

  const persistProfiles = useCallback((nextProfiles: DeviceProfile[]) => {
    setProfiles(nextProfiles);
    saveToStorage(PROFILE_STORAGE_KEY, nextProfiles);
  }, []);

  const updateRegisterFields = useCallback((tableId: string, regId: string, updates: Partial<RegisterRow>) => {
    setWatchTables((prev) =>
      prev.map((table) =>
        table.id === tableId
          ? { ...table, registers: table.registers.map((row) => row.id === regId ? { ...row, ...updates } : row) }
          : table
      )
    );
  }, []);

  const getRegisterById = useCallback((regId: string) => {
    return watchTables.flatMap((table) => table.registers).find((row) => row.id === regId);
  }, [watchTables]);

  const findTableId = useCallback((registerId: string) => {
    const table = watchTables.find((item) => item.registers.some((row) => row.id === registerId));
    return table?.id ?? '';
  }, [watchTables]);

  const validateRegister = useCallback((register: RegisterRow): RegisterValidationResult => {
    if (!activeProfile) {
      return { valid: false, message: 'No active profile.' };
    }
    return validateRegisterAddress(activeProfile.protocol, register.address, register.dataType);
  }, [activeProfile]);

  const scheduleNextPoll = useCallback((delayMs: number) => {
    clearScheduledPoll();
    pollTimeoutRef.current = window.setTimeout(() => {
      void pollRunnerRef.current();
    }, Math.max(0, delayMs));
  }, [clearScheduledPoll]);

  const applyRegisterRuntime = useCallback(async (registerId: string, forceRead = true) => {
    const currentConnection = connectionRef.current;
    if (!currentConnection?.runtimeId || currentConnection.status !== 'polling') return;

    const register = getRegisterById(registerId);
    if (!register) return;

    const tableId = findTableId(registerId);
    const validation = validateRegister(register);
    if (!validation.valid) {
      updateRegisterFields(tableId, registerId, { quality: 'Bad' });
      messageApi.error(validation.message || 'Invalid register configuration');
      addTrace('error', `Register ${register.tagName} invalid: ${validation.message}`);
      return;
    }

    if (register.rwMode === 'W') {
      try {
        await runtimeFetch(`/api/runtime/connections/${currentConnection.runtimeId}/write`, {
          method: 'POST',
          body: JSON.stringify({
            address: register.address,
            dataType: register.dataType,
            values: [register.value],
          }),
        });
        updateRegisterFields(tableId, registerId, { quality: 'Good', lastUpdate: getCurrentTime() });
        addTrace('info', `Applied write for ${register.address}`);
      } catch (error: unknown) {
        const errorMessage = getErrorMessage(error, 'Write failed');
        updateRegisterFields(tableId, registerId, { quality: 'Bad' });
        messageApi.error(`Write failed: ${errorMessage}`);
        addTrace('error', `Write error: ${errorMessage}`);
      }
      return;
    }

    if (!forceRead) return;

    try {
      const response = await runtimeFetch<RuntimeReadResponse>(`/api/runtime/connections/${currentConnection.runtimeId}/read`, {
        method: 'POST',
        body: JSON.stringify({
          items: [{
            tagId: register.id,
            address: register.address,
            dataType: register.dataType,
            rwMode: register.rwMode,
          }],
        }),
      });
      const item = response.items[0];
      if (item) {
        updateRegisterFields(tableId, registerId, {
          value: item.value === null || item.value === undefined ? register.value : String(item.value),
          quality: item.quality === 'Timeout' ? 'Timeout' : item.quality === 'Bad' ? 'Bad' : 'Good',
          lastUpdate: getCurrentTime(),
        });
        addTrace('info', `Applied read for ${register.address}`);
      }
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error, 'Read failed');
      updateRegisterFields(tableId, registerId, { quality: 'Bad' });
      messageApi.error(`Read failed: ${errorMessage}`);
      addTrace('error', `Read error: ${errorMessage}`);
    }
  }, [getRegisterById, findTableId, validateRegister, updateRegisterFields, messageApi, addTrace]);

  const commitRegisterConfig = useCallback(async (tableId: string, registerId: string) => {
    const table = watchTables.find((item) => item.id === tableId);
    const register = table?.registers.find((item) => item.id === registerId);
    if (!register) return;

    const validation = validateRegister(register);
    if (!validation.valid) {
      updateRegisterFields(tableId, registerId, { quality: 'Bad' });
      messageApi.error(validation.message || 'Invalid register config');
      addTrace('error', `Invalid config ${register.address}/${register.dataType}: ${validation.message}`);
      return;
    }

    const currentConnection = connectionRef.current;
    updateRegisterFields(tableId, registerId, { quality: currentConnection?.status === 'polling' ? register.quality : 'Good' });

    if (currentConnection?.status === 'polling') {
      await applyRegisterRuntime(registerId, true);
    }
  }, [watchTables, validateRegister, updateRegisterFields, messageApi, addTrace, applyRegisterRuntime]);

  const applyProfileData = useCallback((profile: DeviceProfile) => {
    setActiveProfileId(profile.id);
    setWatchTables(profile.watchTables.length > 0 ? structuredClone(profile.watchTables) : [{ id: id(), name: 'Watch Table 1', registers: [] }]);
    setProfileManagerOpen(false);
    addTrace('info', `Loaded profile [${profile.name}]`);
  }, [addTrace]);

  const saveCurrentSnapshotAsProfile = useCallback(() => {
    if (!activeProfile) return;
    const updatedProfiles = profiles.map((p) =>
      p.id === activeProfileId
        ? { ...p, watchTables: structuredClone(watchTables), pollIntervalMs: activeProfile.pollIntervalMs }
        : p
    );
    persistProfiles(updatedProfiles);
    addTrace('info', `Saved profile snapshot [${activeProfile.name}]`);
    messageApi.success('Profiles & Tags saved');
  }, [activeProfile, activeProfileId, persistProfiles, profiles, watchTables, addTrace, messageApi]);

  const buildConnectionPayload = useCallback((profile: DeviceProfile) => ({
    name: profile.name,
    protocol: profile.protocol,
    driverKey: protocolToDriverKey(profile.protocol),
    host: profile.host,
    port: profile.port,
    unitId: profile.stationId,
    rack: profile.rack,
    slot: profile.slot,
    cpuType: profile.protocol === 'Siemens S7-1200' ? 'S7-1200' : profile.protocol === 'Siemens S7-1500' ? 'S7-1500' : undefined,
    networkNo: profile.networkNo,
    stationNo: profile.stationNo,
    frame: profile.protocol.startsWith('Mitsubishi') ? '3E' : undefined,
  }), []);

  const syncWithDevice = useCallback(async () => {
    const currentConnection = connectionRef.current;
    if (!activeProfile || !currentConnection?.runtimeId || currentConnection.status !== 'polling') return;

    if (pollInFlightRef.current) {
      setConnection((prev) => prev ? { ...prev, skippedPollCount: prev.skippedPollCount + 1 } : prev);
      addTrace('warn', 'Skipped poll tick because previous cycle is still running');
      scheduleNextPoll(pollIntervalMs);
      return;
    }

    const allRegisters = watchTables.flatMap((table) => table.registers);
    const readTargets = allRegisters
      .filter((r) => r.rwMode === 'R')
      .map((register) => ({ register, validation: validateRegister(register) }));

    const validReads = readTargets.filter((item) => item.validation.valid).map((item) => item.register);
    const invalidReads = readTargets.filter((item) => !item.validation.valid);

    if (invalidReads.length > 0) {
      const invalidIds = new Set(invalidReads.map((item) => item.register.id));
      setWatchTables((prev) => prev.map((table) => ({
        ...table,
        registers: table.registers.map((register) => (
          invalidIds.has(register.id)
            ? { ...register, quality: 'Bad' }
            : register
        )),
      })));
    }

    const cycleStartedAt = Date.now();
    pollInFlightRef.current = true;
    setConnection((prev) => prev ? { ...prev, lastPollAt: getCurrentTime() } : prev);

    try {
      if (validReads.length === 0) {
        setConnection((prev) => prev ? {
          ...prev,
          retryCount: 0,
          lastError: undefined,
          lastSuccessAt: getCurrentTime(),
          lastCycleDurationMs: Date.now() - cycleStartedAt,
        } : prev);
        addTrace('info', 'Polling idle: no valid readable registers');
        return;
      }

      const response = await runtimeFetch<RuntimeReadResponse>(`/api/runtime/connections/${currentConnection.runtimeId}/read`, {
        method: 'POST',
        body: JSON.stringify({
          items: validReads.map((register) => ({
            tagId: register.id,
            address: register.address,
            dataType: register.dataType,
            rwMode: register.rwMode,
          })),
        }),
      });

      const now = getCurrentTime();
      const itemMap = new Map(response.items.map((item) => [item.tagId, item]));
      setWatchTables((prev) =>
        prev.map((table) => ({
          ...table,
          registers: table.registers.map((register) => {
            const item = itemMap.get(register.id);
            if (!item) return register;
            return {
              ...register,
              value: item.value === null || item.value === undefined ? register.value : String(item.value),
              quality: item.quality === 'Timeout' ? 'Timeout' : item.quality === 'Bad' ? 'Bad' : 'Good',
              lastUpdate: now,
            };
          }),
        }))
      );

      setConnection((prev) =>
        prev
          ? {
              ...prev,
              retryCount: 0,
              lastError: undefined,
              lastSuccessAt: now,
              lastCycleDurationMs: Date.now() - cycleStartedAt,
            }
          : prev
      );

      addTrace('info', `Poll OK: ${validReads.length} tags / ${response.stats.packCount} packs / ${response.stats.driverRequestCount} driver requests`);
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error, 'Sync failed');
      setConnection((prev) =>
        prev
          ? {
              ...prev,
              status: 'error',
              lastError: errorMessage,
              retryCount: prev.retryCount + 1,
              pollErrorCount: prev.pollErrorCount + 1,
              lastCycleDurationMs: Date.now() - cycleStartedAt,
            }
          : prev
      );
      addTrace('error', `Sync error: ${errorMessage}`);
    } finally {
      pollInFlightRef.current = false;
      if (connectionRef.current?.status === 'polling') {
        scheduleNextPoll(pollIntervalMs);
      }
    }
  }, [activeProfile, watchTables, addTrace, validateRegister, pollIntervalMs, scheduleNextPoll]);

  useEffect(() => {
    pollRunnerRef.current = syncWithDevice;
  }, [syncWithDevice]);

  useEffect(() => {
    if (connection?.status === 'polling') {
      const delay = startPollingImmediatelyRef.current ? 0 : pollIntervalMs;
      startPollingImmediatelyRef.current = false;
      scheduleNextPoll(delay);
    } else {
      clearScheduledPoll();
    }

    return () => {
      clearScheduledPoll();
    };
  }, [connection?.status, pollIntervalMs, scheduleNextPoll, clearScheduledPoll]);

  const connectCurrent = useCallback(async () => {
    if (!activeProfile) return;
    clearScheduledPoll();
    pollInFlightRef.current = false;

    const connectingState: RuntimeConnectionState = {
      profileId: activeProfile.id,
      profileName: activeProfile.name,
      protocol: activeProfile.protocol,
      status: 'connecting',
      retryCount: 0,
      skippedPollCount: 0,
      pollErrorCount: 0,
    };

    connectionRef.current = connectingState;
    setConnection(connectingState);
    addTrace('info', `Connecting to ${activeProfile.host}:${activeProfile.port} (${activeProfile.protocol})...`);

    try {
      const created = await runtimeFetch<RuntimeConnectionDto>('/api/runtime/connections', {
        method: 'POST',
        body: JSON.stringify(buildConnectionPayload(activeProfile)),
      });

      const pollingState: RuntimeConnectionState = {
        runtimeId: created.id,
        profileId: activeProfile.id,
        profileName: activeProfile.name,
        protocol: activeProfile.protocol,
        status: 'polling',
        retryCount: 0,
        skippedPollCount: 0,
        pollErrorCount: 0,
        lastPollAt: getCurrentTime(),
      };

      startPollingImmediatelyRef.current = true;
      connectionRef.current = pollingState;
      setConnection(pollingState);
      addTrace('info', `Connected. Runtime connection = ${created.id}`);
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error, 'Connection failed');
      const errorState: RuntimeConnectionState = {
        profileId: activeProfile.id,
        profileName: activeProfile.name,
        protocol: activeProfile.protocol,
        status: 'error',
        retryCount: 0,
        skippedPollCount: 0,
        pollErrorCount: 1,
        lastError: errorMessage,
      };

      connectionRef.current = errorState;
      setConnection(errorState);
      addTrace('error', `Connection failed: ${errorMessage}`);
      messageApi.error('Connection failed');
    }
  }, [activeProfile, addTrace, buildConnectionPayload, messageApi, clearScheduledPoll]);

  const disconnectCurrent = useCallback(async () => {
    clearScheduledPoll();
    pollInFlightRef.current = false;

    const currentConnection = connectionRef.current;
    if (!currentConnection?.runtimeId) {
      connectionRef.current = null;
      setConnection(null);
      return;
    }

    try {
      await runtimeFetch(`/api/runtime/connections/${currentConnection.runtimeId}/disconnect`, { method: 'POST' });
    } catch {
      // ignore disconnect errors
    }

    connectionRef.current = null;
    setConnection(null);
    addTrace('warn', 'Disconnected');
  }, [addTrace, clearScheduledPoll]);

  const openCreateProfile = useCallback(() => {
    profileForm.setFieldsValue({
      name: `New Device ${profiles.length + 1}`,
      protocol: 'Modbus TCP',
      host: '127.0.0.1',
      port: 502,
      pollIntervalMs: 1000,
      stationId: 1,
      rack: 0,
      slot: 1,
      networkNo: 0,
      stationNo: 255,
    });
    setEditingProfileId('NEW');
    setProfileModalOpen(true);
  }, [profileForm, profiles.length]);

  const openEditProfile = useCallback(() => {
    if (!activeProfile) return;
    profileForm.setFieldsValue({
      name: activeProfile.name,
      protocol: activeProfile.protocol,
      host: activeProfile.host,
      port: activeProfile.port,
      pollIntervalMs: activeProfile.pollIntervalMs,
      rack: activeProfile.rack ?? 0,
      slot: activeProfile.slot ?? 1,
      stationId: activeProfile.stationId ?? 1,
      networkNo: activeProfile.networkNo ?? 0,
      stationNo: activeProfile.stationNo ?? 255,
    });
    setEditingProfileId(activeProfile.id);
    setProfileModalOpen(true);
  }, [activeProfile, profileForm]);

  const saveProfileFromModal = useCallback(async () => {
    try {
      const values = await profileForm.validateFields();
      if (!editingProfileId) return;

      if (editingProfileId === 'NEW') {
        const newProfile: DeviceProfile = {
          id: id(),
          ...values,
          watchTables: [{ id: id(), name: 'Watch Table 1', registers: [] }],
        };
        const nextProfiles = [...profiles, newProfile];
        persistProfiles(nextProfiles);
        if (!activeProfileId) applyProfileData(newProfile);
        addTrace('info', `Created profile [${values.name}]`);
      } else {
        const nextProfiles = profiles.map((profile) =>
          profile.id === editingProfileId ? { ...profile, ...values } : profile
        );
        persistProfiles(nextProfiles);
        addTrace('info', `Updated profile [${values.name}]`);
      }

      setProfileModalOpen(false);
      messageApi.success('Profile saved');
    } catch {
      // validation errors handled by form
    }
  }, [profileForm, editingProfileId, profiles, persistProfiles, activeProfileId, applyProfileData, addTrace, messageApi]);

  const deleteProfileData = useCallback((profile: DeviceProfile) => {
    Modal.confirm({
      title: 'Delete Profile',
      content: `B?n mu?n xóa profile ${profile.name}?`,
      okText: 'Delete',
      okType: 'danger',
      onOk: () => {
        const nextProfiles = profiles.filter((p) => p.id !== profile.id);
        persistProfiles(nextProfiles);
        if (activeProfileId === profile.id) {
          if (nextProfiles.length > 0) {
            applyProfileData(nextProfiles[0]);
          } else {
            setActiveProfileId(undefined);
            setWatchTables([{ id: id(), name: 'Watch Table 1', registers: [] }]);
          }
        }
      },
    });
  }, [profiles, persistProfiles, activeProfileId, applyProfileData]);

  const writeRegisterValue = useCallback(async (registerId: string, value: string) => {
    updateRegisterFields(findTableId(registerId), registerId, { value });
    await applyRegisterRuntime(registerId, false);
  }, [applyRegisterRuntime, updateRegisterFields, findTableId]);

  const addRegister = useCallback((tableId: string) => {
    setWatchTables((prev) => prev.map((table) => {
      if (table.id !== tableId) return table;
      const defaultAddress = activeProfile?.protocol === 'Modbus TCP'
        ? `${40001 + table.registers.length}`
        : activeProfile?.protocol?.startsWith('Siemens')
          ? `DB1.DBW${table.registers.length * 2}`
          : `D${table.registers.length}`;

      const newRegister: RegisterRow = {
        id: id(),
        tagName: `Tag_${Math.floor(Math.random() * 1000)}`,
        address: defaultAddress,
        value: '0',
        dataType: 'Int16',
        rwMode: 'R',
        quality: 'Bad',
        lastUpdate: '-',
      };
      addTrace('info', `Added register ${newRegister.tagName} [${newRegister.address}] to ${table.name}`);
      return { ...table, registers: [...table.registers, newRegister] };
    }));
  }, [activeProfile, addTrace]);

  const removeRegister = useCallback((tableId: string, regId: string) => {
    setWatchTables((prev) => prev.map((table) => table.id !== tableId ? table : { ...table, registers: table.registers.filter((r) => r.id !== regId) }));
    if (selectedRegisterId === regId) setSelectedRegisterId(undefined);
    addTrace('warn', 'Removed one register from UI');
  }, [selectedRegisterId, addTrace]);

  return {
    contextHolder,
    profileForm,
    profiles,
    activeProfileId,
    activeProfile,
    pollIntervalMs,
    logs,
    watchTables,
    setWatchTables,
    selectedRegisterId,
    setSelectedRegisterId,
    profileModalOpen,
    setProfileModalOpen,
    profileManagerOpen,
    setProfileManagerOpen,
    connection,
    addTrace,
    updateRegisterFields,
    validateRegister,
    commitRegisterConfig,
    applyProfileData,
    saveProfileFromModal,
    saveCurrentSnapshotAsProfile,
    connectCurrent,
    disconnectCurrent,
    openCreateProfile,
    openEditProfile,
    deleteProfileData,
    writeRegisterValue,
    addRegister,
    removeRegister,
  };
}

export type HomeState = ReturnType<typeof useHomeState>;
