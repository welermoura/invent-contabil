import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-50 text-red-900 border border-red-200 rounded">
          <h2 className="text-lg font-bold">Erro no sistema de notificações</h2>
          <p className="text-sm">Por favor, recarregue a página ou verifique se o navegador suporta notificações.</p>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
