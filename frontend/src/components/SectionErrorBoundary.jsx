import React from "react";

export default class SectionErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Section failed to render:", error, errorInfo);
  }

  handleRetry = async () => {
    try {
      await this.props.onRetry?.();
      this.setState({ error: null });
    } catch (error) {
      console.error("Section retry failed:", error);
    }
  };

  render() {
    if (this.state.error) {
      return (
        <div className="banner" role="alert">
          <div>
            <b>This section could not be displayed</b>
            <span>{this.state.error.message || "An unexpected rendering error occurred."}</span>
          </div>
          <button className="btn" type="button" onClick={this.handleRetry}>
            Retry section
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
