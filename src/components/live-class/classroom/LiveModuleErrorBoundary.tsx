'use client';

import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  moduleName: string;
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class LiveModuleErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`[LiveModuleErrorBoundary:${this.props.moduleName}] Render error caught:`, error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-6 bg-[#0B0C0E] text-white">
          <div className="max-w-md w-full p-6 rounded-2xl bg-[#111216] border border-[#282A36] text-center space-y-4 shadow-xl">
            <div className="w-12 h-12 rounded-xl bg-[#FF9100]/10 border border-[#FF9100]/25 text-[#FF9100] flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">
                {this.props.moduleName} Module Temporarily Unavailable
              </h3>
              <p className="text-xs text-[#71717A] mt-1 leading-relaxed">
                A rendering issue was intercepted in this workspace. Your live lecture audio/video feed, chat, and participants remain active.
              </p>
            </div>
            <div className="pt-2 flex justify-center space-x-3">
              <button
                type="button"
                onClick={this.handleReset}
                className="inline-flex items-center space-x-2 py-2 px-4 rounded-xl bg-[#FF9100] hover:bg-[#E08000] text-black font-semibold text-xs transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reinitialize {this.props.moduleName}</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
