import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Database, User } from "lucide-react";
import { useCallback, type ReactNode } from "react";
import type { ChatMessage as ChatMessageType } from "@/lib/chat-stream";
import { PaginatedTable } from "./PaginatedTable";
import { InlineBarChart } from "./InlineBarChart";
import { StatDistributionChart, isStatTable } from "./StatDistributionChart";

interface ChatMessageProps {
  message: ChatMessageType;
  isStreaming?: boolean;
}

function extractTableData(node: ReactNode): { headers: string[]; rows: string[][] } | null {
  const headers: string[] = [];
  const rows: string[][] = [];
  const children = Array.isArray(node) ? node : [node];
  for (const section of children) {
    if (!section || typeof section !== "object" || !("props" in section)) continue;
    const sectionChildren = Array.isArray(section.props.children) ? section.props.children : [section.props.children];
    for (const row of sectionChildren) {
      if (!row || typeof row !== "object" || !("props" in row)) continue;
      const cells = Array.isArray(row.props.children) ? row.props.children : [row.props.children];
      const cellTexts = cells
        .filter((c: any) => c && typeof c === "object" && "props" in c)
        .map((c: any) => extractText(c.props.children));
      if (section.type === "thead" || section.props?.className?.includes("thead")) {
        headers.push(...cellTexts);
      } else {
        if (cellTexts.length > 0) rows.push(cellTexts);
      }
    }
  }
  if (headers.length === 0 && rows.length > 0) headers.push(...rows.shift()!);
  return headers.length > 0 ? { headers, rows } : null;
}

function extractText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (node && typeof node === "object" && "props" in node) return extractText((node as any).props.children);
  return "";
}

export function ChatMessage({ message, isStreaming }: ChatMessageProps) {
  const isUser = message.role === "user";

  const renderTable = useCallback(({ children, ...props }: any) => {
    const data = extractTableData(children);
    if (!data || data.headers.length === 0) return <table {...props}>{children}</table>;
    if (isStatTable(data.headers)) {
      return <StatDistributionChart headers={data.headers} rows={data.rows} />;
    }
    return (
      <>
        <InlineBarChart headers={data.headers} rows={data.rows} />
        <PaginatedTable headers={data.headers} rows={data.rows} />
      </>
    );
  }, []);

  return (
    <div
      className="flex gap-3 px-4 py-4 animate-in fade-in slide-in-from-bottom-2 duration-300"
      style={{ backgroundColor: isUser ? "hsl(var(--secondary) / 0.3)" : undefined }}
    >
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
          isUser ? "bg-secondary text-secondary-foreground" : "bg-primary/10 text-primary"
        }`}
      >
        {isUser ? <User className="h-4 w-4" /> : <Database className="h-4 w-4" />}
      </div>

      <div className="min-w-0 flex-1 text-sm leading-relaxed">
        {isUser ? (
          <p className="text-foreground">{message.content}</p>
        ) : (
          <div className="prose prose-sm prose-invert max-w-none text-foreground/90">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{ table: renderTable }}
            >
              {message.content}
            </ReactMarkdown>
            {isStreaming && (
              <span className="inline-block ml-0.5 w-2 h-4 bg-primary align-middle animate-pulse" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
