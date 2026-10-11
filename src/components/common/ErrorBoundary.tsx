import { Component, type ReactNode } from "react";
import { TriangleAlert, RotateCcw } from "lucide-react";
import { Icon } from "./Icon";
import { Button } from "./Button";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  panelName?: string;
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

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.panelName ? `: ${this.props.panelName}` : ""}]`, error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div
          role="alert"
          style={{
            padding: "var(--space-16)",
            color: "var(--text-secondary)",
            fontSize: "var(--fs-body)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            gap: "var(--space-8)",
          }}
        >
          <Icon icon={TriangleAlert} size={20} style={{ color: "var(--error)" }} />
          <div style={{ fontSize: "var(--fs-headline)", lineHeight: "18px", fontWeight: 600, color: "var(--text-primary)" }}>
            {this.props.panelName ?? "Panel"} crashed
          </div>
          <div style={{ maxWidth: 300, textAlign: "center", wordBreak: "break-word" }}>
            {this.state.error?.message ?? "Unknown error"}
          </div>
          <Button
            icon={RotateCcw}
            style={{ marginTop: "var(--space-4)" }}
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Retry
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
