// @ts-nocheck
import * as React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary: React Error Boundary for graceful error handling
 * Catches errors in child components and displays a fallback UI
 */
export default class ErrorBoundary extends React.Component<any, any> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    // Optionally reload the page
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center" style={{ background: '#fbf9f8' }}>
          <div className="bg-white rounded-xl border border-red-200 p-8 max-w-md text-center shadow-lg">
            <div className="mb-4 text-4xl" style={{ color: '#e67e22' }}>
              ⚠️
            </div>
            <h1 className="text-xl font-bold mb-2" style={{ color: '#1b1c1c' }}>
              エラーが発生しました
            </h1>
            <p className="text-sm text-stone-600 mb-6">
              申し訳ございません。予期せぬエラーが発生しました。ページを再読み込みしてください。
            </p>
            {this.state.error && (
              <p className="text-xs text-stone-400 mb-6 bg-stone-50 p-3 rounded text-left overflow-auto max-h-32">
                {this.state.error.toString()}
              </p>
            )}
            <button
              onClick={this.handleReset}
              className="px-6 py-2.5 rounded-full font-medium transition-all hover:scale-105 active:scale-95"
              style={{ background: '#e67e22', color: '#502600' }}
            >
              ページを再読み込み
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
