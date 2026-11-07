import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('CS2 Mix Hub ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReload = () => {
    // Clear any broken parameters and reload clean
    window.location.reload(true);
  };

  handleGoHome = () => {
    window.location.href = window.location.origin;
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#070a12] text-slate-100 flex items-center justify-center p-4 font-sans">
          <div className="max-w-md w-full bg-slate-900/90 border border-amber-500/40 rounded-3xl p-6 text-center shadow-2xl backdrop-blur relative overflow-hidden">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={28} />
            </div>

            <h2 className="text-xl font-black font-heading text-white uppercase tracking-wider mb-2">
              Recuperação do Sistema
            </h2>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">
              Ocorreu uma pequena falha na renderização da tela. Clique abaixo para restabelecer a conexão com a sala.
            </p>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
              >
                <RefreshCw size={14} />
                <span>Recarregar Tela</span>
              </button>

              <button
                type="button"
                onClick={this.handleGoHome}
                className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <Home size={14} />
                <span>Início</span>
              </button>
            </div>

            {this.state.error?.message && (
              <details className="mt-4 text-left">
                <summary className="text-[10px] text-slate-500 cursor-pointer hover:text-slate-400 font-mono">
                  Detalhes técnicos do erro
                </summary>
                <pre className="mt-2 p-2 rounded-lg bg-black/60 border border-slate-800 text-[10px] font-mono text-rose-300 overflow-x-auto whitespace-pre-wrap">
                  {this.state.error.message}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
