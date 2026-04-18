import { Layout } from 'antd';
import { useAppTheme } from '../ThemeContext';
import { HomeProvider } from './Home/HomeContext';
import { GlobalHeader } from './Home/components/GlobalHeader';
import { StatusBar } from './Home/components/StatusBar';
import { ConnectionSettingsModal } from './Home/components/Modals/ConnectionSettingsModal';
import { ProfileManagerModal } from './Home/components/Modals/ProfileManagerModal';
import { MonitorTab } from './Home/components/Tabs/MonitorTab';

function HomeContent() {
  const { mode } = useAppTheme();
  
  return (
    <Layout style={{ flex: 1, width: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <GlobalHeader />

      <Layout.Content
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          overflow: 'hidden',
          background: mode === 'light' ? '#f5f7fb' : '#000',
          minHeight: 0,
        }}
      >
        <div style={{ flex: 1, padding: 0, overflow: 'auto', background: mode === 'light' ? '#fff' : '#141414', minHeight: 0 }}>
          <div style={{ padding: 0, height: '100%' }}>
            <MonitorTab />
          </div>
        </div>
      </Layout.Content>

      <StatusBar />

      <ConnectionSettingsModal />
      <ProfileManagerModal />
    </Layout>
  );
}

export default function HomePage() {
  return (
    <HomeProvider>
      <HomeContent />
    </HomeProvider>
  );
}
