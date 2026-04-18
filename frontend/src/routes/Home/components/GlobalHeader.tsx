import { Button, Divider, Flex, Layout, Typography, Tooltip } from 'antd';
import {
  ApiOutlined,
  FolderOpenOutlined,
  PlayCircleOutlined,
  SaveOutlined,
  StopOutlined,
  PlusOutlined,
  BulbOutlined,
} from '@ant-design/icons';
import { useHomeContext } from '../HomeContext';
import { useAppTheme } from '../../../ThemeContext';

export function GlobalHeader() {
  const {
    connection,
    connectCurrent,
    disconnectCurrent,
    openCreateProfile,
    openEditProfile,
    activeProfile,
    setProfileManagerOpen,
    saveCurrentSnapshotAsProfile,
  } = useHomeContext();

  const { mode, toggleTheme } = useAppTheme();

  return (
    <Layout.Header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        background: mode === 'light' ? '#fff' : '#141414',
        borderBottom: `1px solid ${mode === 'light' ? '#dbe2ea' : '#303030'}`,
        height: 56,
        lineHeight: '56px',
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      <Flex align="center" gap={16}>


        <Flex align="center" gap={8}>
          {connection?.status === 'polling' ? (
            <Tooltip title="Stop Connection" placement="bottom">
              <Button
                type="primary"
                danger
                icon={<StopOutlined />}
                onClick={() => void disconnectCurrent()}
              >
                Stop
              </Button>
            </Tooltip>
          ) : (
            <Tooltip title="Start Connection" placement="bottom">
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                onClick={() => void connectCurrent()}
                loading={connection?.status === 'connecting'}
                disabled={!activeProfile}
              >
                Start
              </Button>
            </Tooltip>
          )}

          <Divider type="vertical" style={{ height: 24, margin: '0 4px' }} />

          <Tooltip title="Edit Connection Profile" placement="bottom">
            <Button
              icon={<ApiOutlined />}
              onClick={openEditProfile}
              disabled={!activeProfile}
              style={activeProfile ? { color: '#1677ff', borderColor: '#1677ff', background: '#e6f4ff', fontWeight: 500 } : undefined}
            >
              Connect
            </Button>
          </Tooltip>
        </Flex>
      </Flex>

      <Flex align="center" gap={8} style={{ flexShrink: 0 }}>
        {activeProfile && (
          <div style={{ marginRight: 16, display: 'flex', flexDirection: 'column', lineHeight: '1.2', alignItems: 'flex-end', justifyContent: 'center' }}>
            <Typography.Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>
              Active Profile
            </Typography.Text>
            <Typography.Text strong style={{ fontSize: 13, color: '#1677ff' }}>
              {activeProfile.name}
            </Typography.Text>
          </div>
        )}

        <Tooltip title="Create New Profile" placement="bottomRight">
          <Button
            type="dashed"
            icon={<PlusOutlined style={{ fontSize: 16 }} />}
            onClick={openCreateProfile}
          />
        </Tooltip>
        <Tooltip title="Load Profile" placement="bottomRight">
          <Button
            type="default"
            icon={<FolderOpenOutlined style={{ fontSize: 16 }} />}
            onClick={() => setProfileManagerOpen(true)}
          />
        </Tooltip>
        <Tooltip title="Save Current Profile" placement="bottomRight">
          <Button
            type="primary"
            icon={<SaveOutlined style={{ fontSize: 16 }} />}
            onClick={saveCurrentSnapshotAsProfile}
            disabled={!activeProfile}
          />
        </Tooltip>
        
        <Divider type="vertical" style={{ height: 24, margin: '0 4px' }} />

        <Tooltip title={mode === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'} placement="bottomRight">
          <Button
            type="text"
            icon={<BulbOutlined style={{ fontSize: 18 }} />}
            onClick={toggleTheme}
          />
        </Tooltip>
      </Flex>
    </Layout.Header>
  );
}
