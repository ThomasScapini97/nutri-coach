import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 flex flex-col items-center justify-center bg-white px-6 text-center">
          <div className="text-4xl mb-4">🥗</div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Something went wrong</h2>
          <p className="text-sm text-gray-400 mb-6">An unexpected error occurred. Your data is safe.</p>
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2 rounded-full bg-green-600 text-white text-sm font-medium"
          >
            Reload app
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
