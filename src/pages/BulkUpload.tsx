import { Component, ReactNode } from "react";
import { BulkCreatorUpload } from "@/components/campaign/BulkCreatorUpload";

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: any) { console.error("BulkUpload crash:", error, info); }
  render() {
    if (this.state.error) {
      return (
        <div className="p-8 border border-red-500/40 bg-red-500/5 text-sm">
          <div className="font-serif text-2xl mb-2">Something broke while parsing that file.</div>
          <div className="text-muted-foreground mb-3">{this.state.error.message}</div>
          <button onClick={() => this.setState({ error: null })} className="px-3 py-1 border border-border text-xs uppercase tracking-wider">Reset</button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function BulkUploadPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <div className="text-xs uppercase tracking-wider text-yellow-500 mb-1">Maggi #MadeWithMaggi</div>
        <h1 className="font-serif text-4xl">Add Creators in Bulk</h1>
        <p className="text-muted-foreground text-sm mt-1">Drop your KOL list. We enrich, score, and group it against your active brief — live.</p>
      </div>
      <ErrorBoundary>
        <BulkCreatorUpload />
      </ErrorBoundary>
    </div>
  );
}
