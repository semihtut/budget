import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-[100dvh] bg-slate-900 text-white p-6 text-center">
          <AlertTriangle className="w-16 h-16 text-red-400 mb-4" />
          <h1 className="text-xl font-bold mb-2">Bir sorun oluştu</h1>
          <p className="text-slate-400 text-sm mb-6">
            Uygulama beklenmedik bir hata ile karşılaştı.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="flex items-center gap-2 bg-blue-500 active:bg-blue-600 text-white rounded-xl px-5 py-3 font-semibold
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              <RefreshCw className="w-4 h-4" />
              Yeniden Dene
            </button>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.href = "/";
              }}
              className="flex items-center gap-2 bg-slate-700 active:bg-slate-600 text-white rounded-xl px-5 py-3 font-semibold
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              <Home className="w-4 h-4" />
              Ana Sayfa
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
