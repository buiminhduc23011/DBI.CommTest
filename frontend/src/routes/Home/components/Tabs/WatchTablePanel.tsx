import { Input, InputNumber, Popover, Select, Table, TableColumnsType, Tooltip, Button, Dropdown } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useMemo, useState } from 'react';
import { useHomeContext } from '../../HomeContext';
import { useAppTheme } from '../../../../ThemeContext';
import { DATA_TYPE_OPTIONS } from '../../constants';
import { DataType, Quality, RegisterRow, WatchTable } from '../../types';
import { getAddressPlaceholder, isReadOnlyAddress } from '../../utils';

interface Props {
  table: WatchTable;
}

export function WatchTablePanel({ table }: Props) {
  const {
    activeProfile,
    setSelectedRegisterId,
    writeRegisterValue,
    addTrace,
    addRegister,
    addBulkRegisters,
    updateRegisterFields,
    validateRegister,
    commitRegisterConfig,
    removeRegister,
  } = useHomeContext();

  const { mode } = useAppTheme();

  // Bulk-add popover state
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [bulkStartAddr, setBulkStartAddr] = useState('');
  const [bulkCount, setBulkCount] = useState(1);
  const [bulkDataType, setBulkDataType] = useState<string>('Int16');

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ open: boolean; x: number; y: number; recordId: string | null }>({
    open: false,
    x: 0,
    y: 0,
    recordId: null,
  });

  const handleBulkAdd = () => {
    if (!bulkStartAddr.trim()) {
      addRegister(table.id);
    } else {
      addBulkRegisters(table.id, bulkStartAddr.trim(), bulkCount, bulkDataType);
    }
    setPopoverOpen(false);
    setBulkStartAddr('');
    setBulkCount(1);
  };

  const bulkPopoverContent = (
    <div style={{ width: 260, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 12, color: '#888', marginBottom: 2 }}>Create sequential registers</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <label style={{ fontSize: 12, fontWeight: 500 }}>Start Address</label>
        <Input
          size="small"
          placeholder={getAddressPlaceholder(activeProfile?.protocol, bulkDataType as DataType)}
          value={bulkStartAddr}
          onChange={(e) => setBulkStartAddr(e.target.value.toUpperCase())}
          onPressEnter={handleBulkAdd}
          autoFocus
        />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 12, fontWeight: 500 }}>Count</label>
          <InputNumber
            size="small"
            min={1}
            max={100}
            value={bulkCount}
            onChange={(v) => setBulkCount(v ?? 1)}
            style={{ width: '100%' }}
          />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 12, fontWeight: 500 }}>Data Type</label>
          <Select
            size="small"
            value={bulkDataType}
            onChange={setBulkDataType}
            options={DATA_TYPE_OPTIONS.map((o) => ({ value: o, label: o }))}
            style={{ width: '100%' }}
          />
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 4 }}>
        <Button size="small" onClick={() => setPopoverOpen(false)}>Cancel</Button>
        <Button size="small" type="primary" onClick={handleBulkAdd}>
          Add {bulkCount} Row{bulkCount > 1 ? 's' : ''}
        </Button>
      </div>
    </div>
  );

  const registerColumns = useMemo<TableColumnsType<RegisterRow>>(
    () => [
      {
        title: 'Tag Name',
        dataIndex: 'tagName',
        key: 'tagName',
        width: 180,
        render: (value: string, row) => (
          <Input
            value={value}
            bordered={false}
            style={{ borderRadius: 0, backgroundColor: 'transparent' }}
            onFocus={() => setSelectedRegisterId(row.id)}
            onBlur={() => setSelectedRegisterId(undefined)}
            onChange={(event) => updateRegisterFields(table.id, row.id, { tagName: event.target.value })}
            onPressEnter={(event) => addTrace('info', `Updated Tag Name: ${event.currentTarget.value} (${table.name})`)}
            size="small"
          />
        ),
      },
      {
        title: 'Address',
        dataIndex: 'address',
        key: 'address',
        width: 180,
        render: (value: string, row) => {
          const validation = validateRegister(row);
          return (
            <Tooltip 
              title={
                !validation.valid 
                  ? `${validation.message} (Example: ${getAddressPlaceholder(activeProfile?.protocol, row.dataType)})`
                  : undefined
              }
            >
              <Input
                value={value}
                size="small"
                bordered={false}
                status={!validation.valid ? 'error' : undefined}
                style={{ width: '100%', borderRadius: 0, backgroundColor: 'transparent' }}
                onFocus={() => setSelectedRegisterId(row.id)}
                placeholder={getAddressPlaceholder(activeProfile?.protocol, row.dataType)}
                onChange={(event) => updateRegisterFields(table.id, row.id, { address: event.target.value.toUpperCase() })}
                onPressEnter={() => void commitRegisterConfig(table.id, row.id)}
                onBlur={() => {
                  setSelectedRegisterId(undefined);
                  void commitRegisterConfig(table.id, row.id);
                }}
              />
            </Tooltip>
          );
        },
      },
      {
        title: 'Value',
        dataIndex: 'value',
        key: 'value',
        width: 140,
        render: (value: string, row) => (
          <Input
            value={value}
            size="small"
            bordered={false}
            style={{ borderRadius: 0, backgroundColor: 'transparent' }}
            status={row.quality === 'Bad' ? 'error' : undefined}
            disabled={isReadOnlyAddress(activeProfile?.protocol, row.address)}
            onFocus={() => setSelectedRegisterId(row.id)}
            onChange={(event) => updateRegisterFields(table.id, row.id, { value: event.target.value })}
            onPressEnter={() => {
              setSelectedRegisterId(undefined);
              void Promise.resolve(writeRegisterValue(row.id, row.value));
            }}
            onBlur={() => {
              setSelectedRegisterId(undefined);
              void Promise.resolve(writeRegisterValue(row.id, row.value));
            }}
          />
        ),
      },
      {
        title: 'Data Type',
        dataIndex: 'dataType',
        key: 'dataType',
        width: 140,
        render: (value: DataType, row) => {
          const validation = validateRegister(row);
          return (
            <Tooltip title={!validation.valid ? validation.message : undefined}>
              <Select
                value={value}
                size="small"
                status={!validation.valid ? 'error' : undefined}
                bordered={false}
                style={{ width: '100%' }}
                onChange={(nextType) => {
                  updateRegisterFields(table.id, row.id, { dataType: nextType });
                  queueMicrotask(() => {
                    void commitRegisterConfig(table.id, row.id);
                  });
                }}
                options={DATA_TYPE_OPTIONS.map((option) => ({ value: option, label: option }))}
              />
            </Tooltip>
          );
        },
      },
      {
        title: 'Quality',
        dataIndex: 'quality',
        key: 'quality',
        width: 100,
        render: (value: Quality) => {
          if (value === 'Good') return <span style={{ color: '#52c41a', fontWeight: 500, paddingLeft: 8 }}>Good</span>;
          if (value === 'Timeout') return <span style={{ color: '#faad14', fontWeight: 500, paddingLeft: 8 }}>Timeout</span>;
          return <span style={{ color: '#ff4d4f', fontWeight: 500, paddingLeft: 8 }}>Bad</span>;
        },
      },
    ],
    [activeProfile?.protocol, setSelectedRegisterId, addTrace, writeRegisterValue, table.id, table.name, updateRegisterFields, validateRegister, commitRegisterConfig]
  );

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: mode === 'light' ? '#fff' : '#141414', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <Table<RegisterRow>
          rowKey="id"
          size="small"
          bordered
          scroll={{ y: 'max-content', x: 'max-content' }}
          columns={registerColumns}
          dataSource={table.registers}
          pagination={false}
          locale={{
            emptyText: (
              <div style={{ padding: '32px 0', color: '#888' }}>
                No registers configured. Click "Add new row" below to begin.
              </div>
            ),
          }}
          onRow={(record) => ({
            onContextMenu: (e) => {
              e.preventDefault();
              setContextMenu({ open: true, x: e.clientX, y: e.clientY, recordId: record.id });
            },
          })}
        />
      </div>

      <Dropdown
        menu={{
          items: [
            {
              key: 'delete',
              label: 'Delete Row',
              danger: true,
              onClick: () => {
                if (contextMenu.recordId) {
                  removeRegister(table.id, contextMenu.recordId);
                }
                setContextMenu((s) => ({ ...s, open: false }));
              },
            },
          ],
        }}
        open={contextMenu.open}
        onOpenChange={(open) => !open && setContextMenu((s) => ({ ...s, open }))}
        trigger={['contextMenu']}
      >
        <div style={{ position: 'fixed', left: contextMenu.x, top: contextMenu.y, width: 1, height: 1 }} />
      </Dropdown>

      {/* Add row — full-width sticky footer */}
      <Popover
        open={popoverOpen}
        onOpenChange={(open) => {
          setPopoverOpen(open);
          if (open) setBulkStartAddr('');
        }}
        content={bulkPopoverContent}
        trigger="click"
        placement="topLeft"
        title={null}
      >
        <div
          role="button"
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '0 12px',
            height: 32,
            cursor: 'pointer',
            fontSize: 13,
            color: '#1677ff',
            borderTop: `1px solid ${mode === 'light' ? '#e4e7ec' : '#2a2a2a'}`,
            userSelect: 'none',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLDivElement).style.background = mode === 'light' ? '#f0f6ff' : '#111d2c';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLDivElement).style.background = 'transparent';
          }}
        >
          <PlusOutlined />
          Add new row
        </div>
      </Popover>
    </div>
  );
}

