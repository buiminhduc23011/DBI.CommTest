import { Form, Input, InputNumber, Modal, Select, Row, Col } from 'antd';
import { useHomeContext } from '../../HomeContext';
import { PROTOCOL_OPTIONS } from '../../constants';
import { ProfileFormValue } from '../../types';

export function ConnectionSettingsModal() {
  const { profileModalOpen, setProfileModalOpen, saveProfileFromModal, profileForm } = useHomeContext();
  const protocol = Form.useWatch('protocol', profileForm);

  const isSiemens = protocol?.startsWith('Siemens');
  const isMitsubishi = protocol?.startsWith('Mitsubishi');
  const isModbusOrDelta = protocol === 'Modbus TCP' || protocol?.startsWith('Delta');

  return (
    <Modal
      title="Connection Settings"
      open={profileModalOpen}
      onCancel={() => setProfileModalOpen(false)}
      onOk={() => void saveProfileFromModal()}
      okText="Save"
    >
      <Form<ProfileFormValue> form={profileForm} layout="vertical">
        <Form.Item name="name" label="Profile Name" rules={[{ required: true, message: 'Nhập tên profile' }]}>
          <Input />
        </Form.Item>

        <Row gutter={16}>
          <Col span={24}>
            <Form.Item name="protocol" label="Protocol" rules={[{ required: true }]}>
              <Select options={PROTOCOL_OPTIONS.map((option) => ({ value: option, label: option }))} />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={10}>
            <Form.Item
              name="host"
              label="IP"
              rules={[
                { required: true, message: 'Nhập IP' },
                {
                  pattern: /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
                  message: 'Sai định dạng IPv4',
                },
              ]}
            >
              <Input />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="port" label="Port" rules={[{ required: true, message: 'Nhập port' }]}>
              <InputNumber min={1} max={65535} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name="pollIntervalMs"
              label="Poll Interval (ms)"
              rules={[{ required: true }]}
            >
              <InputNumber min={200} step={100} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>

        {isSiemens && (
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="rack" label="Rack" rules={[{ required: true }]}>
                <InputNumber min={0} max={15} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="slot" label="Slot" rules={[{ required: true }]}>
                <InputNumber min={0} max={31} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        )}

        {isMitsubishi && (
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="networkNo" label="Network No." rules={[{ required: true }]}>
                <InputNumber min={0} max={255} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="stationNo" label="Station No." rules={[{ required: true }]}>
                <InputNumber min={0} max={255} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        )}

        {isModbusOrDelta && (
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="stationId" label="Station ID" rules={[{ required: true }]}>
                <InputNumber min={0} max={255} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        )}
      </Form>
    </Modal>
  );
}
