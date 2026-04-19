import { Component, type ReactNode, type ErrorInfo } from 'react';
import { AlertTriangle } from 'lucide-react';
import styles from './ErrorBoundary.module.css';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  private handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <AlertTriangle size={40} className={styles.icon} />
          <h2 className={styles.title}>Что-то пошло не так</h2>
          <p className={styles.message}>
            Произошла непредвиденная ошибка. Попробуйте повторить действие или вернуться на главную.
          </p>
          {this.state.error && (
            <details className={styles.details}>
              <summary className={styles.summary}>Подробности</summary>
              <pre className={styles.stack}>{this.state.error.message}</pre>
            </details>
          )}
          <div className={styles.actions}>
            <button className={styles.btnSecondary} onClick={this.handleReset}>
              Попробовать снова
            </button>
            <button className={styles.btnPrimary} onClick={this.handleGoHome}>
              На главную
            </button>
          </div>
        </div>
      </div>
    );
  }
}
