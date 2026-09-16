import type { ReactNode } from "react";

/**
 * A deliberately small Markdown subset, rendered straight to React elements.
 *
 * Nothing here ever produces an HTML string, so there is no `dangerouslySetInnerHTML`
 * and no XSS surface: React escapes every text node, and only the element types
 * listed below can ever be created.
 *
 * Blocks:  # ## ###   >quote   ```code```   - list   1. list   ---
 *          ![alt](url)   @[video](url)
 * Inline:  **bold**  *italic*  `code`  [text](url)
 */

/** Only http(s), root-relative, and mailto links survive. Blocks `javascript:` URLs. */
function safeHref(raw: string): string | null {
  const href = raw.trim();
  if (/^https?:\/\//i.test(href)) return href;
  if (/^mailto:/i.test(href)) return href;
  if (href.startsWith("/") && !href.startsWith("//")) return href;
  if (href.startsWith("#")) return href;
  return null;
}

function safeMediaSrc(raw: string): string | null {
  const src = raw.trim();
  if (/^https?:\/\//i.test(src)) return src;
  if (src.startsWith("/") && !src.startsWith("//")) return src;
  return null;
}

const INLINE = /(\*\*[^*]+\*\*)|(\*[^*]+\*)|(`[^`]+`)|(\[[^\]]*\]\([^)\s]+\))/g;

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  INLINE.lastIndex = 0;
  while ((match = INLINE.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    const token = match[0];
    const key = `${keyPrefix}-i${i++}`;

    if (token.startsWith("**")) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("`")) {
      nodes.push(<code key={key}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith("[")) {
      const split = token.indexOf("](");
      const label = token.slice(1, split);
      const href = safeHref(token.slice(split + 2, -1));
      nodes.push(
        href ? (
          <a key={key} href={href} target="_blank" rel="noopener noreferrer">
            {label || href}
          </a>
        ) : (
          <span key={key}>{label}</span>
        )
      );
    } else {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>);
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

export function Markdown({ source }: { source: string }) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];

  let paragraph: string[] = [];
  let listItems: string[] = [];
  let listOrdered = false;
  let key = 0;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    const text = paragraph.join(" ");
    blocks.push(<p key={`p${key}`}>{renderInline(text, `p${key++}`)}</p>);
    paragraph = [];
  };

  const flushList = () => {
    if (!listItems.length) return;
    const items = listItems.map((item, idx) => (
      <li key={idx}>{renderInline(item, `l${key}-${idx}`)}</li>
    ));
    blocks.push(
      listOrdered ? <ol key={`l${key++}`}>{items}</ol> : <ul key={`l${key++}`}>{items}</ul>
    );
    listItems = [];
  };

  const flushAll = () => {
    flushParagraph();
    flushList();
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Fenced code block — consumed verbatim, never parsed for inline markup.
    if (trimmed.startsWith("```")) {
      flushAll();
      const lang = trimmed.slice(3).trim();
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        code.push(lines[i]);
        i++;
      }
      blocks.push(
        <pre key={`c${key++}`} data-lang={lang || undefined}>
          <code>{code.join("\n")}</code>
        </pre>
      );
      continue;
    }

    if (!trimmed) {
      flushAll();
      continue;
    }

    // Video: @[video](url)
    const video = /^@\[video\]\(([^)\s]+)\)$/.exec(trimmed);
    if (video) {
      flushAll();
      const src = safeMediaSrc(video[1]);
      if (src) {
        blocks.push(
          <figure key={`v${key++}`} className="media">
            <video src={src} controls playsInline preload="metadata" />
          </figure>
        );
      }
      continue;
    }

    // Image on its own line: ![alt](url)
    const image = /^!\[([^\]]*)\]\(([^)\s]+)\)$/.exec(trimmed);
    if (image) {
      flushAll();
      const src = safeMediaSrc(image[2]);
      if (src) {
        blocks.push(
          <figure key={`f${key++}`} className="media">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={image[1]} loading="lazy" />
            {image[1] ? <figcaption>{image[1]}</figcaption> : null}
          </figure>
        );
      }
      continue;
    }

    if (/^---+$/.test(trimmed)) {
      flushAll();
      blocks.push(<hr key={`h${key++}`} />);
      continue;
    }

    const heading = /^(#{1,3})\s+(.*)$/.exec(trimmed);
    if (heading) {
      flushAll();
      const level = heading[1].length;
      const content = renderInline(heading[2], `h${key}`);
      const Tag = (["h2", "h3", "h4"] as const)[level - 1];
      blocks.push(<Tag key={`h${key++}`}>{content}</Tag>);
      continue;
    }

    if (trimmed.startsWith("> ")) {
      flushAll();
      blocks.push(
        <blockquote key={`q${key}`}>
          {renderInline(trimmed.slice(2), `q${key++}`)}
        </blockquote>
      );
      continue;
    }

    const bullet = /^[-*]\s+(.*)$/.exec(trimmed);
    const numbered = /^\d+\.\s+(.*)$/.exec(trimmed);
    if (bullet || numbered) {
      flushParagraph();
      const ordered = Boolean(numbered);
      if (listItems.length && ordered !== listOrdered) flushList();
      listOrdered = ordered;
      listItems.push((bullet ?? numbered)![1]);
      continue;
    }

    flushList();
    paragraph.push(trimmed);
  }

  flushAll();
  return <div className="prose">{blocks}</div>;
}
