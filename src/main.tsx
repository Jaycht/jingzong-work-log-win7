import React from 'react';
import ReactDOM from 'react-dom/client';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import 'antd/dist/reset.css';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import { migrateLocalStorageToIndexedDB } from './store/massStore';
import './index.css';

dayjs.locale('zh-cn');

// 启动时将旧 localStorage 数据迁移到 IndexedDB
migrateLocalStorageToIndexedDB();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
