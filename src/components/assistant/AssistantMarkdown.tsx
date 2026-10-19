import React, { useState } from 'react';
import { Copy, Check, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

interface AssistantMarkdownProps {
  content: string;
  className?: string;
}

/**
 * Robust, XSS-safe markdown renderer for assistant responses.
 * Parses headings, bullet/numbered lists, bold/italic, code blocks,
 * inline code, blockquotes, and links without dangerouslySetInnerHTML.
 */
export const AssistantMarkdown: React.FC<AssistantMarkdownProps> = ({ content, className = '' }) => {
  if (!content) return null;

  // Split lines and parse blocks
  const blocks = parseMarkdownBlocks(content);

  return (
    <div className={`space-y-2 text-sm leading-relaxed text-foreground/90 ${className}`}>
      {blocks.map((block, idx) => (
        <React.Fragment key={idx}>{renderBlock(block, idx)}</React.Fragment>
      ))}
    </div>
  );
};

type Block =
  | { type: 'heading'; level: number; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'codeblock'; language: string; code: string }
  | { type: 'blockquote'; text: string }
  | { type: 'paragraph'; text: string };

function parseMarkdownBlocks(rawText: string): Block[] {
  const lines = rawText.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block ```
    if (line.trim().startsWith('```')) {
      const lang = line.trim().slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      blocks.push({
        type: 'codeblock',
        language: lang,
        code: codeLines.join('\n'),
      });
      i++;
      continue;
    }

    // Headings #, ##, ###, ####
    const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length,
        text: headingMatch[2].trim(),
      });
      i++;
      continue;
    }

    // Blockquote >
    if (line.trim().startsWith('>')) {
      const quoteLines: string[] = [line.trim().replace(/^>\s?/, '')];
      i++;
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      blocks.push({
        type: 'blockquote',
        text: quoteLines.join(' '),
      });
      continue;
    }

    // Unordered list item: - or *
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, '').trim());
        i++;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }

    // Ordered list item: 1. or 2.
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, '').trim());
        i++;
      }
      blocks.push({ type: 'ol', items });
      continue;
    }

    // Empty line
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Normal paragraph lines until empty or other block
    const pLines: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].trim().startsWith('```') &&
      !lines[i].trim().startsWith('#') &&
      !lines[i].trim().startsWith('>') &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i])
    ) {
      pLines.push(lines[i]);
      i++;
    }
    blocks.push({
      type: 'paragraph',
      text: pLines.join(' '),
    });
  }

  return blocks;
}

function renderBlock(block: Block, key: number): React.ReactNode {
  switch (block.type) {
    case 'heading': {
      const HeadingTag = `h${block.level}` as keyof JSX.IntrinsicElements;
      const headingClasses: Record<number, string> = {
        1: 'text-lg font-bold text-foreground mt-3 mb-1 border-b border-border/50 pb-1',
        2: 'text-base font-bold text-foreground mt-2 mb-1',
        3: 'text-sm font-semibold text-foreground/95 mt-2 mb-0.5',
        4: 'text-xs font-semibold text-foreground/90 mt-1 mb-0.5 uppercase tracking-wider',
      };
      return (
        <HeadingTag key={key} className={headingClasses[block.level] || headingClasses[3]}>
          {renderInline(block.text)}
        </HeadingTag>
      );
    }

    case 'ul':
      return (
        <ul key={key} className="list-disc list-inside space-y-1 my-1.5 pl-1 marker:text-primary">
          {block.items.map((item, idx) => (
            <li key={idx} className="text-foreground/90 leading-relaxed">
              {renderInline(item)}
            </li>
          ))}
        </ul>
      );

    case 'ol':
      return (
        <ol key={key} className="list-decimal list-inside space-y-1 my-1.5 pl-1 marker:font-semibold marker:text-primary">
          {block.items.map((item, idx) => (
            <li key={idx} className="text-foreground/90 leading-relaxed">
              {renderInline(item)}
            </li>
          ))}
        </ol>
      );

    case 'blockquote':
      return (
        <blockquote
          key={key}
          className="border-l-2 border-primary/60 bg-muted/40 px-3 py-1.5 my-2 rounded-r italic text-foreground/85"
        >
          {renderInline(block.text)}
        </blockquote>
      );

    case 'codeblock':
      return <CodeBlock key={key} language={block.language} code={block.code} />;

    case 'paragraph':
      return (
        <p key={key} className="leading-relaxed">
          {renderInline(block.text)}
        </p>
      );

    default:
      return null;
  }
}

/**
 * Render inline tokens: **bold**, *italic*, `code`, [link](url), etc.
 */
export function renderInline(text: string): React.ReactNode[] {
  // Regex pattern matching links, code, bold/italic
  const tokenRegex = /(\[([^\]]+)\]\(([^)]+)\)|`([^`]+)`|\*\*\*([^*]+)\*\*\*|\*\*([^*]+)\*\*|\*([^*]+)\*|__([^_]+)__|~~([^~]+)~~)/g;

  const result: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      result.push(text.slice(lastIndex, match.index));
    }

    const [full, , linkText, linkUrl, inlineCode, boldItalic, boldText, italicText, underlineBold, strikethrough] =
      match;

    if (linkText && linkUrl) {
      // Safe URL check: ignore javascript: or data:
      const isInternal = linkUrl.startsWith('/') || linkUrl.startsWith('#');
      const isSafeExternal = /^https?:\/\//i.test(linkUrl) || /^mailto:/i.test(linkUrl);

      if (isInternal) {
        result.push(
          <Link
            key={match.index}
            to={linkUrl}
            className="text-primary hover:text-accent font-medium underline underline-offset-2 transition-colors inline-flex items-center gap-0.5"
          >
            {linkText}
          </Link>
        );
      } else if (isSafeExternal) {
        result.push(
          <a
            key={match.index}
            href={linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:text-accent font-medium underline underline-offset-2 transition-colors inline-flex items-center gap-0.5"
          >
            {linkText}
            <ExternalLink className="w-3 h-3 inline ml-0.5 opacity-70" />
          </a>
        );
      } else {
        result.push(linkText);
      }
    } else if (inlineCode) {
      result.push(
        <code
          key={match.index}
          className="bg-muted px-1.5 py-0.5 rounded text-[13px] font-mono text-accent font-medium border border-border/40"
        >
          {inlineCode}
        </code>
      );
    } else if (boldItalic) {
      result.push(
        <strong key={match.index} className="font-bold italic text-foreground">
          {boldItalic}
        </strong>
      );
    } else if (boldText || underlineBold) {
      result.push(
        <strong key={match.index} className="font-bold text-foreground">
          {boldText || underlineBold}
        </strong>
      );
    } else if (italicText) {
      result.push(
        <em key={match.index} className="italic text-foreground/90">
          {italicText}
        </em>
      );
    } else if (strikethrough) {
      result.push(
        <del key={match.index} className="line-through text-muted-foreground">
          {strikethrough}
        </del>
      );
    } else {
      result.push(full);
    }

    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex));
  }

  return result;
}

function CodeBlock({ language, code }: { language?: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="my-2 rounded-lg border border-border/60 bg-slate-950/80 overflow-hidden shadow-inner text-xs font-mono">
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/30 border-b border-border/40 text-[11px] text-muted-foreground">
        <span className="font-semibold uppercase tracking-wider">{language || 'text'}</span>
        <button
          onClick={handleCopy}
          type="button"
          className="flex items-center gap-1 hover:text-foreground transition-colors px-1.5 py-0.5 rounded hover:bg-card"
          aria-label="Copy code"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-3 overflow-x-auto text-slate-200 leading-relaxed font-mono text-[12px]">
        <code>{code}</code>
      </pre>
    </div>
  );
}
