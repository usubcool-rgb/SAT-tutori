import katex from "katex";

interface MathTextProps {
  text: string;
  className?: string;
  block?: boolean;
}

function renderMathSegments(text: string): string {
  const segments: string[] = [];
  let i = 0;

  while (i < text.length) {
    // Block math: $$...$$ or \[...\]
    if (text.slice(i, i + 2) === "$$") {
      const end = text.indexOf("$$", i + 2);
      if (end !== -1) {
        const math = text.slice(i + 2, end);
        try {
          segments.push(katex.renderToString(math, { displayMode: true, throwOnError: false }));
        } catch {
          segments.push(`<span class="text-red-500">$$${math}$$</span>`);
        }
        i = end + 2;
        continue;
      }
    }

    if (text.slice(i, i + 2) === "\\[") {
      const end = text.indexOf("\\]", i + 2);
      if (end !== -1) {
        const math = text.slice(i + 2, end);
        try {
          segments.push(katex.renderToString(math, { displayMode: true, throwOnError: false }));
        } catch {
          segments.push(`<span class="text-red-500">\\[${math}\\]</span>`);
        }
        i = end + 2;
        continue;
      }
    }

    // Inline math: $...$ or \(...\)
    if (text[i] === "$" && text[i - 1] !== "$" && text[i + 1] !== "$") {
      const end = text.indexOf("$", i + 1);
      if (end !== -1 && text[end + 1] !== "$") {
        const math = text.slice(i + 1, end);
        try {
          segments.push(katex.renderToString(math, { displayMode: false, throwOnError: false }));
        } catch {
          segments.push(`<span class="text-red-500">$${math}$</span>`);
        }
        i = end + 1;
        continue;
      }
    }

    if (text.slice(i, i + 2) === "\\(") {
      const end = text.indexOf("\\)", i + 2);
      if (end !== -1) {
        const math = text.slice(i + 2, end);
        try {
          segments.push(katex.renderToString(math, { displayMode: false, throwOnError: false }));
        } catch {
          segments.push(`<span class="text-red-500">\\(${math}\\)</span>`);
        }
        i = end + 2;
        continue;
      }
    }

    // Collect plain text until next potential math delimiter
    let j = i + 1;
    while (j < text.length) {
      if (
        text[j] === "$" ||
        text.slice(j, j + 2) === "\\(" ||
        text.slice(j, j + 2) === "\\["
      ) {
        break;
      }
      j++;
    }
    segments.push(
      text
        .slice(i, j)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
    );
    i = j;
  }

  return segments.join("");
}

export function MathText({ text, className = "", block = false }: MathTextProps) {
  const html = renderMathSegments(text);
  const Tag = block ? "div" : "span";
  return (
    <Tag
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
