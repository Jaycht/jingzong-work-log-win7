import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
    this.props.onError?.();
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '100vh', gap: 16,
          color: '#6B7280', fontSize: 14,
        }}>
          <div style={{ fontSize: 40 }}>⚠️</div>
          <div>页面出现异常，请刷新后重试</div>
          <div style={{ fontSize: 12, color: '#9CA3AF', maxWidth: 400, textAlign: 'center' }}>
            {this.state.error?.message}
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              marginTop: 8, padding: '8px 24px', border: '1px solid #D8E1EA',
              borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 13,
              fontFamily: 'inherit',
            }}
          >
            重试
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
