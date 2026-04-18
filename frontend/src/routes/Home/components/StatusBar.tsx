import { Badge, Layout, Space } from 'antd';
import { useMemo } from 'react';
import { useHomeContext } from '../HomeContext';
import { useAppTheme } from '../../../ThemeContext';

export function StatusBar() {
  const { connection, activeProfile, pollIntervalMs } = useHomeContext();
  const { mode } = useAppTheme();

  const connectionStatusUi = useMemo(() => {
    if (!connection) return { text: 'Stopped', color: 'default' as const };
    if (connection.status === 'polling') return { text: 'Polling', color: 'success' as const };
    if (connection.status === 'connecting') return { text: 'Starting', color: 'processing' as const };
    if (connection.status === 'error') return { text: 'Error', color: 'error' as const };
    return { text: 'Stopped', color: 'default' as const };
  }, [connection]);

  return (
    <Layout.Footer
      style={{
        padding: '0 16px',
        background: mode === 'light' ? '#fff' : '#141414',
        borderTop: `1px solid ${mode === 'light' ? '#dbe2ea' : '#303030'}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        minHeight: 32,
        lineHeight: '32px',
        flexShrink: 0,
      }}
    >
      <Space size={16} wrap>
        <Badge
          status={
            connection?.status === 'polling'
              ? 'success'
              : connection?.status === 'connecting'
                ? 'processing'
                : connection?.status === 'error'
                  ? 'error'
                  : 'default'
          }
          text={
            <span style={{ fontWeight: 500, fontSize: 12 }}>
              {connectionStatusUi.text.toUpperCase()}
            </span>
          }
        />
        {connection && (
          <span style={{ fontSize: 12, color: '#555' }}>Protocol: {connection.protocol}</span>
        )}
        {connection && (
          <span style={{ fontSize: 12, color: '#555' }}>
            Host: {activeProfile?.host}:{activeProfile?.port}
          </span>
        )}
        {connection?.status === 'polling' && (
          <span style={{ fontSize: 12, color: '#555' }}>Interval: {pollIntervalMs} ms</span>
        )}
        {connection?.lastCycleDurationMs !== undefined && (
          <span style={{ fontSize: 12, color: '#555' }}>Last cycle: {connection.lastCycleDurationMs} ms</span>
        )}
        {connection?.skippedPollCount ? (
          <span style={{ fontSize: 12, color: '#555' }}>Skipped: {connection.skippedPollCount}</span>
        ) : null}
        {connection?.pollErrorCount ? (
          <span style={{ fontSize: 12, color: '#555' }}>Errors: {connection.pollErrorCount}</span>
        ) : null}
      </Space>
      <Space size={16} wrap>
        {connection?.lastSuccessAt && (
          <span style={{ fontSize: 12, color: '#888' }}>Last success: {connection.lastSuccessAt}</span>
        )}
        {connection?.lastPollAt && (
          <span style={{ fontSize: 12, color: '#888' }}>Last poll: {connection.lastPollAt}</span>
        )}
        {connection?.lastError && (
          <span style={{ fontSize: 12, color: '#cf1322' }}>Error: {connection.lastError}</span>
        )}
      </Space>
    </Layout.Footer>
  );
}
