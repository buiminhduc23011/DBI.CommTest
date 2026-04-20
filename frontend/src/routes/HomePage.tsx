import { Layout, Tour, type TourProps } from 'antd';
import { useAppTheme } from '../ThemeContext';
import { HomeProvider, useHomeContext } from './Home/HomeContext';
import { GlobalHeader } from './Home/components/GlobalHeader';
import { StatusBar } from './Home/components/StatusBar';
import { ConnectionSettingsModal } from './Home/components/Modals/ConnectionSettingsModal';
import { ProfileManagerModal } from './Home/components/Modals/ProfileManagerModal';
import { MonitorTab } from './Home/components/Tabs/MonitorTab';

function HomeContent() {
  const { mode } = useAppTheme();
  const { showOnboarding, finishOnboarding } = useHomeContext();
  
  const tourSteps: TourProps['steps'] = [
    {
      title: 'Welcome to DBI CommTest',
      description: 'This industrial communication diagnostic utility allows you to monitor and interact with your PLC network in real-time. This brief tour will guide you through the core functionalities.',
      target: null, // Center of screen
    },
    {
      title: 'Connection Settings',
      description: 'The Connection Settings menu allows you to configure essential network parameters (IP Address, Port) and select standardized industrial protocols such as Modbus TCP, S7 Communication, or MC Protocol.',
      target: () => document.getElementById('tour-connection-settings') as HTMLElement,
    },
    {
      title: 'Profile Manager',
      description: 'The Profile Manager allows you to systematically store and manage settings for multiple controllers. Use this feature to save configurations and seamlessly switch between different PLC stations.',
      target: () => document.getElementById('tour-profile-manager') as HTMLElement,
    },
    {
      title: 'Multi-Watch Tables',
      description: 'The workspace supports creating and managing multiple Watch Tables simultaneously. You can organize, split, and navigate through isolated tabs to monitor distinct memory areas efficiently.',
      target: () => document.getElementById('tour-watch-tables') as HTMLElement,
    },
    {
      title: 'Bulk Add',
      description: 'The Bulk Add utility allows you to quickly generate a sequential block of memory registers. This feature minimizes manual entry when analyzing large continuous data blocks.',
      target: () => document.getElementById('tour-bulk-add') as HTMLElement,
    },
    {
      title: 'Write Data',
      description: "To manipulate physical device states, input your desired value into the 'Value' column and press Enter. The operation will instantly transmit the write command to the controller.",
      target: () => document.getElementById('tour-write-data') as HTMLElement,
    },
    {
      title: 'Start Engine',
      description: "Once configuration is complete, press 'Start' to initiate the continuous polling engine. The 'Quality' column will reflect the integrity and response status of the communication in real-time.",
      target: () => document.getElementById('tour-start-engine') as HTMLElement,
    }
  ];

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
        <div id="tour-watch-tables" style={{ flex: 1, padding: 0, overflow: 'auto', background: mode === 'light' ? '#fff' : '#141414', minHeight: 0 }}>
          <div style={{ padding: 0, height: '100%' }}>
            <MonitorTab />
          </div>
        </div>
      </Layout.Content>

      <StatusBar />

      <ConnectionSettingsModal />
      <ProfileManagerModal />

      <Tour
        open={showOnboarding}
        onClose={finishOnboarding}
        steps={tourSteps}
        prefixCls="ant-tour"
        mask={{
          color: 'rgba(0, 0, 0, 0.4)',
        }}
      />
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
