import { Button, Divider, Flex, Layout, Typography, Tooltip } from 'antd';
import {
  ApiOutlined,
  FolderOpenOutlined,
  PlayCircleOutlined,
  SaveOutlined,
  PauseOutlined,
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
    isDirty,
  } = useHomeContext();

  const { mode, toggleTheme } = useAppTheme();

  const isDark = mode === 'dark';
  const isPolling = connection?.status === 'polling';
  const isConnecting = connection?.status === 'connecting';

  const bg = isDark ? '#161616' : '#ffffff';
  const border = isDark ? '#2a2a2a' : '#e4e7ec';
  const textMuted = isDark ? '#555' : '#b0b8c4';

  return (
    <Layout.Header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 14px',
        background: bg,
        borderBottom: `1px solid ${border}`,
        height: 48,
        lineHeight: '48px',
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      {/* LEFT */}
      <Flex align="center" gap={10}>
        {/* App name */}
        <Typography.Text
          strong
          style={{
            fontSize: 13,
            color: isDark ? '#c9d1d9' : '#1a2332',
            userSelect: 'none',
            marginRight: 4,
          }}
        >
          DBI.CommTest
        </Typography.Text>

        <Divider type="vertical" style={{ height: 20, margin: '0 2px', borderColor: border }} />

        {/* Start / Stop */}
        {isPolling ? (
          <Tooltip title="Stop polling" placement="bottom">
            <Button
              type="primary"
              danger
              icon={<PauseOutlined />}
              onClick={() => void disconnectCurrent()}
              size="small"
              style={{ fontWeight: 500 }}
            >
              Stop
            </Button>
          </Tooltip>
        ) : (
          <Tooltip title={!activeProfile ? 'Select a profile first' : 'Start polling'} placement="bottom">
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={() => void connectCurrent()}
              loading={isConnecting}
              disabled={!activeProfile}
              size="small"
              style={{ fontWeight: 500 }}
            >
              Start
            </Button>
          </Tooltip>
        )}

        {/* Settings */}
        <Tooltip title="Edit connection profile" placement="bottom">
          <Button
            type="text"
            icon={<ApiOutlined />}
            onClick={openEditProfile}
            disabled={!activeProfile}
            size="small"
            style={{ color: isDark ? '#8b949e' : '#57606a' }}
          >
            Settings
          </Button>
        </Tooltip>
      </Flex>

      {/* CENTER — Profile name */}
      <Flex align="center" gap={6} style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
        {activeProfile ? (
          <>
            <span
              style={{
                display: 'inline-block',
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: isPolling ? '#3fb950' : (isDark ? '#30363d' : '#d0d7de'),
                flexShrink: 0,
                transition: 'background 0.3s',
                boxShadow: isPolling ? '0 0 0 3px rgba(63,185,80,0.2)' : 'none',
              }}
            />
            <Typography.Text
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: isDark ? '#c9d1d9' : '#1a2332',
                maxWidth: 260,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {activeProfile.name}
            </Typography.Text>
          </>
        ) : (
          <Typography.Text style={{ fontSize: 12, color: textMuted }}>
            No profile
          </Typography.Text>
        )}
      </Flex>

      {/* RIGHT — Actions + theme */}
      <Flex align="center" gap={2}>
        <Tooltip title="New profile" placement="bottomRight">
          <Button
            type="text"
            size="small"
            icon={<PlusOutlined />}
            onClick={openCreateProfile}
            style={{ color: isDark ? '#8b949e' : '#57606a' }}
          />
        </Tooltip>
        <Tooltip title="Load profile" placement="bottomRight">
          <Button
            type="text"
            size="small"
            icon={<FolderOpenOutlined />}
            onClick={() => setProfileManagerOpen(true)}
            style={{ color: isDark ? '#8b949e' : '#57606a' }}
          />
        </Tooltip>
        <Tooltip title={isDirty ? "Save profile (Unsaved changes)" : "Save profile"} placement="bottomRight">
          <Button
            type={isDirty ? 'primary' : 'text'}
            size="small"
            icon={<SaveOutlined />}
            onClick={saveCurrentSnapshotAsProfile}
            disabled={!activeProfile}
            style={{ 
              color: isDirty ? '#fff' : (isDark ? '#8b949e' : '#57606a'),
              background: isDirty ? '#1677ff' : undefined,
              borderColor: isDirty ? '#1677ff' : 'transparent',
            }}
          />
        </Tooltip>

        <Divider type="vertical" style={{ height: 16, margin: '0 6px', borderColor: border }} />

        <Tooltip title={isDark ? 'Light mode' : 'Dark mode'} placement="bottomRight">
          <Button
            type="text"
            size="small"
            icon={<BulbOutlined style={{ fontSize: 15 }} />}
            onClick={toggleTheme}
            style={{ color: isDark ? '#8b949e' : '#57606a' }}
          />
        </Tooltip>
      </Flex>
    </Layout.Header>
  );
}
