import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[THE GRAND CHESS ROOM] Error caught by boundary:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#121316] p-4 text-[#202226]">
          <div className="w-full max-w-md bg-[#f7f7f4] border border-[#c6a45c]/40 rounded-3xl p-6 sm:p-8 shadow-2xl text-center">
            <div className="p-4 rounded-full bg-amber-100 border-2 border-amber-500 text-amber-700 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <AlertCircle className="w-8 h-8" />
            </div>

            <h2 className="text-xl sm:text-2xl font-serif font-extrabold tracking-wide text-[#202226] mb-2">
              SOMETHING WENT UNEXPECTED
            </h2>

            <p className="text-xs text-[#666762] mb-6">
              A temporary interface issue occurred. Your game session can be recovered immediately.
            </p>

            <button
              onClick={this.handleReload}
              className="w-full py-3 rounded-xl bg-[#c6a45c] hover:bg-[#b5934a] text-white font-serif font-bold text-xs uppercase tracking-wider transition-all shadow-glow-gold flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reload Game</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
