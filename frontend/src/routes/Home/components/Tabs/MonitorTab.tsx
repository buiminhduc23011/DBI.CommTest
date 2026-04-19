import { PlusOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons';
import { Layout, Model, TabNode, IJsonModel, Actions, Action, DockLocation, BorderNode, ITabSetRenderValues, TabSetNode } from 'flexlayout-react';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import 'flexlayout-react/style/light.css';
import { useHomeContext } from '../../HomeContext';
import { WatchTablePanel } from './WatchTablePanel';
import { id } from '../../utils';

function buildModelJson(watchTables: { id: string; name: string }[]): IJsonModel {
  return {
    global: {
      tabEnableClose: true,
      tabEnableRename: true,
      tabSetEnableMaximize: true,
    },
    borders: [],
    layout: {
      type: 'row',
      weight: 100,
      children: [
        {
          type: 'tabset',
          weight: 50,
          children: watchTables.map((t) => ({
            type: 'tab',
            id: t.id,
            name: t.name,
            component: 'WatchTable',
          })),
        },
      ],
    },
  };
}

export function MonitorTab() {
  const { watchTables, setWatchTables } = useHomeContext();
  const [model, setModel] = useState<Model | null>(null);
  const layoutRef = useRef<Layout>(null);

  const tableSignature = useMemo(
    () => JSON.stringify(watchTables.map((table) => ({ id: table.id, name: table.name }))),
    [watchTables]
  );

  useEffect(() => {
    const modelJson = buildModelJson(watchTables.map((table) => ({ id: table.id, name: table.name })));
    setModel(Model.fromJson(modelJson));
  }, [tableSignature]);

  const addTable = (targetTabsetId?: string) => {
    const newId = id();
    const newName = `Watch Table ${watchTables.length + 1}`;

    setWatchTables((prev) => [
      ...prev,
      {
        id: newId,
        name: newName,
        registers: [],
      },
    ]);

    if (model) {
      const activeTabset = targetTabsetId || model.getActiveTabset()?.getId() || model.getRoot().getChildren()[0]?.getId() || '';
      model.doAction(Actions.addNode({
        type: 'tab',
        id: newId,
        name: newName,
        component: 'WatchTable',
      }, activeTabset, DockLocation.CENTER, -1));
    }
  };

  const factory = (node: TabNode) => {
    if (node.getComponent() === 'WatchTable') {
      const table = watchTables.find((t) => t.id === node.getId());
      if (!table) return <div style={{ padding: 16 }}>Table not found in state</div>;
      return <WatchTablePanel table={table} />;
    }
    return null;
  };

  const onAction = (action: Action) => {
    if (action.type === Actions.DELETE_TAB) {
      const tableId = action.data.node;
      setWatchTables((prev) => prev.filter((t) => t.id !== tableId));
    } else if (action.type === Actions.RENAME_TAB) {
      const tableId = action.data.node;
      const newName = action.data.text;
      setWatchTables((prev) => prev.map((t) => t.id === tableId ? { ...t, name: newName } : t));
    }
    return action;
  };

  const scrollTabbar = (e: React.MouseEvent, direction: number) => {
    e.stopPropagation();
    e.preventDefault();
    const btn = e.currentTarget as HTMLElement;
    const tabset = btn.closest('.flexlayout__tabset');
    if (tabset) {
      const inner = tabset.querySelector('.flexlayout__tabset_tabbar_inner') as HTMLElement | null;
      inner?.scrollBy({ left: direction * 150, behavior: 'smooth' });
    }
  };

  const onRenderTabSet = (tabSetNode: TabSetNode | BorderNode, renderState: ITabSetRenderValues) => {
    if (tabSetNode.getType() === 'tabset') {
      renderState.buttons.push(
        <div key="scroll-left" style={{ display: 'flex', alignItems: 'center', margin: '0 2px', cursor: 'pointer', padding: '0 4px' }} onClick={(e) => scrollTabbar(e, -1)}>
          <LeftOutlined style={{ fontSize: '13px', color: '#666' }} />
        </div>,
        <div key="scroll-right" style={{ display: 'flex', alignItems: 'center', margin: '0 2px', cursor: 'pointer', padding: '0 4px' }} onClick={(e) => scrollTabbar(e, 1)}>
          <RightOutlined style={{ fontSize: '13px', color: '#666' }} />
        </div>,
        <div key="add-btn" style={{ display: 'flex', alignItems: 'center', margin: '0 6px 0 2px', cursor: 'pointer', padding: '0 4px' }} onClick={() => addTable(tabSetNode.getId())}>
          <PlusOutlined style={{ fontSize: '14px', color: '#666' }} />
        </div>
      );
    }
  };

  if (!model) return null;

  return (
    <div style={{ height: '100%', width: '100%', position: 'relative' }}>
      <style>
        {`
          .flexlayout__layout .flexlayout__tab_button_textbox {
            border: 1px solid #1677ff !important;
            border-radius: 2px !important;
            padding: 0 4px !important;
            height: 22px;
            background-color: transparent !important;
            color: inherit !important;
            box-shadow: none !important;
            outline: none;
            font-family: inherit !important;
            font-size: 13px !important;
            margin: 0;
            width: 100px;
          }
          .flexlayout__layout .flexlayout__tab_button_textbox::selection {
            background-color: #1677ff;
            color: white;
          }
        `}
      </style>
      <Layout
        ref={layoutRef}
        model={model}
        factory={factory}
        onAction={onAction}
        onRenderTabSet={onRenderTabSet}
      />
    </div>
  );
}
