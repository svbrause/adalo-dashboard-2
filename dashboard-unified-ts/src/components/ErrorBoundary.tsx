import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Catches React render errors and reports them so we have visibility in production.
 * Reports to console and, when available, PostHog (or set window.reportError for Sentry etc.).
 */
export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    const message = error?.message ?? String(error);
    const stack = error?.stack;
    console.error("[ErrorBoundary]", message, info.componentStack, stack);

    // PostHog: capture as exception event for visibility in product analytics
    const win = typeof window !== "undefined" ? window : null;
    if (win && "posthog" in win && typeof (win as Window & { posthog: { capture: (e: string, p: object) => void } }).posthog.capture === "function") {
      try {
        (win as Window & { posthog: { capture: (e: string, p: object) => void } }).posthog.capture("application_error", {
          $exception_message: message,
          $exception_type: error?.name,
          component_stack: info.componentStack?.slice(0, 500),
        });
      } catch {
        // ignore
      }
    }

    // Optional: custom reporter (e.g. Sentry)
    if (win && "reportError" in win && typeof (win as Window & { reportError: (err: Error, info: ErrorInfo) => void }).reportError === "function") {
      try {
        (win as Window & { reportError: (err: Error, info: ErrorInfo) => void }).reportError(error, info);
      } catch {
        // ignore
      }
    }
  }

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div
          style={{
            padding: "2rem",
            textAlign: "center",
            fontFamily: "system-ui, sans-serif",
          }}
          role="alert"
        >
          <h2 style={{ marginBottom: "1rem" }}>Something went wrong</h2>
          <p style={{ color: "#666", marginBottom: "1rem" }}>
            We've been notified and are looking into it. Please refresh the page or try again later.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: "0.5rem 1rem",
              cursor: "pointer",
              background: "#0d9488",
              color: "white",
              border: "none",
              borderRadius: "4px",
            }}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
