import { Button, List, Modal } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useHomeContext } from '../../HomeContext';

export function ProfileManagerModal() {
  const {
    profiles,
    activeProfileId,
    profileManagerOpen,
    setProfileManagerOpen,
    applyProfileData,
    deleteProfileData,
    openCreateProfile,
  } = useHomeContext();

  return (
    <Modal
      title="Load Profile"
      open={profileManagerOpen}
      onCancel={() => setProfileManagerOpen(false)}
      footer={
        <Button 
          type="dashed" 
          icon={<PlusOutlined />} 
          onClick={() => {
            setProfileManagerOpen(false);
            openCreateProfile();
          }} 
          block
        >
          Create New Profile
        </Button>
      }
      width={500}
    >
      <List
        dataSource={profiles}
        renderItem={(profile) => (
          <List.Item
            actions={[
              <Button size="small" type="primary" onClick={() => applyProfileData(profile)}>
                Load
              </Button>,
              <Button
                size="small"
                danger
                onClick={() => deleteProfileData(profile)}
              >
                Delete
              </Button>,
            ]}
          >
            <List.Item.Meta
              title={
                <span
                  style={{
                    fontWeight: activeProfileId === profile.id ? 'bold' : 'normal',
                    color: activeProfileId === profile.id ? '#1677ff' : '#000',
                  }}
                >
                  {profile.name} {activeProfileId === profile.id && '(Active)'}
                </span>
              }
              description={`${profile.protocol} - ${profile.host}:${profile.port}`}
            />
          </List.Item>
        )}
      />
    </Modal>
  );
}
