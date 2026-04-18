import { Button, Input, Select, Space, Table, TableColumnsType, Tooltip } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useMemo } from 'react';
import { useHomeContext } from '../../HomeContext';
import { useAppTheme } from '../../../../ThemeContext';
import { DATA_TYPE_OPTIONS, RW_OPTIONS } from '../../constants';
import { DataType, Quality, RegisterRow, RwMode, WatchTable } from '../../types';

interface Props {
  table: WatchTable;
}

export function WatchTablePanel({ table }: Props) {
  const {
    activeProfile,
    setSelectedRegisterId,
    writeRegisterValue,
    addTrace,
    removeRegister,
    addRegister,
    updateRegisterFields,
    validateRegister,
    commitRegisterConfig,
  } = useHomeContext();

  const { mode } = useAppTheme();

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
            <Tooltip title={!validation.valid ? validation.message : activeProfile?.protocol}>
              <Input
                value={value}
                size="small"
                bordered={false}
                status={!validation.valid ? 'error' : undefined}
                style={{ width: '100%', borderRadius: 0, backgroundColor: 'transparent' }}
                onFocus={() => setSelectedRegisterId(row.id)}
                onChange={(event) => updateRegisterFields(table.id, row.id, { address: event.target.value.toUpperCase() })}
                onPressEnter={() => void commitRegisterConfig(table.id, row.id)}
                onBlur={() => void commitRegisterConfig(table.id, row.id)}
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
            disabled={row.rwMode !== 'W'}
            onFocus={() => setSelectedRegisterId(row.id)}
            onChange={(event) => updateRegisterFields(table.id, row.id, { value: event.target.value })}
            onPressEnter={() => {
              void Promise.resolve(writeRegisterValue(row.id, row.value));
            }}
            onBlur={() => {
              if (row.rwMode === 'W') {
                void Promise.resolve(writeRegisterValue(row.id, row.value));
              }
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
        title: 'RW',
        dataIndex: 'rwMode',
        key: 'rwMode',
        width: 80,
        render: (value: RwMode, row) => (
          <Select
            value={value}
            size="small"
            bordered={false}
            style={{ width: '100%' }}
            onChange={(nextRw) => {
              updateRegisterFields(table.id, row.id, { rwMode: nextRw });
              queueMicrotask(() => {
                void commitRegisterConfig(table.id, row.id);
              });
            }}
            options={RW_OPTIONS.map((option) => ({ value: option, label: option }))}
          />
        ),
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
      {
        title: 'Last Update',
        dataIndex: 'lastUpdate',
        key: 'lastUpdate',
        width: 120,
      },
      {
        title: 'Actions',
        key: 'actions',
        width: 100,
        render: (_, row) => (
          <Space size={8}>
            <Button size="small" onClick={() => removeRegister(table.id, row.id)} danger>
              Delete
            </Button>
          </Space>
        ),
      },
    ],
    [activeProfile?.protocol, setSelectedRegisterId, addTrace, writeRegisterValue, removeRegister, table.id, table.name, updateRegisterFields, validateRegister, commitRegisterConfig]
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
                No registers configured. Click "Add Register" below to begin.
              </div>
            ),
          }}
          footer={() => (
            <div
              style={{
                padding: '4px 8px',
                cursor: 'pointer',
                color: '#1677ff',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              onClick={() => addRegister(table.id)}
            >
              <PlusOutlined /> <span>Add new row</span>
            </div>
          )}
        />
      </div>
    </div>
  );
}
