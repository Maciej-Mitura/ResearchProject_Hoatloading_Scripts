import { useCallback, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";

interface Props {
  content: string;
}

/**
 * Safe Markdown for assistant messages.
 * react-markdown does not render raw HTML by default.
 */
export function MarkdownMessage({ content }: Props) {
  return (
    <div className="md-body">
      <ReactMarkdown
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer noopener">
              {children}
            </a>
          ),
          code: ({ className, children, ...props }) => {
            const isBlock = Boolean(className) || String(children).includes("\n");
            if (!isBlock) {
              return (
                <code className="md-inline-code" {...props}>
                  {children}
                </code>
              );
            }
            return <CodeBlock className={className}>{children}</CodeBlock>;
          },
          pre: ({ children }) => <>{children}</>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function CodeBlock({
  className,
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  const text = String(children).replace(/\n$/, "");

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard may be unavailable */
    }
  }, [text]);

  return (
    <div className="md-code-wrap">
      <button type="button" className="md-copy" onClick={() => void onCopy()}>
        {copied ? "Copied" : "Copy"}
      </button>
      <pre className="md-code">
        <code className={className}>{text}</code>
      </pre>
    </div>
  );
}
