import React, { useEffect, useState } from 'react';
import { Marked, type TokenizerExtension, type RendererExtension } from 'marked';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import hljs from 'highlight.js';
import 'highlight.js/styles/github.css';
import DOMPurify from 'isomorphic-dompurify';

const marked = new Marked({
  gfm: true,
  breaks: true,
});

const katexBlockExtension: TokenizerExtension & RendererExtension = {
  name: 'katexBlock',
  level: 'block',
  start(src: string) {
    const match = src.match(/(\${2}|\\\[)/);
    return match ? match.index : -1;
  },
  tokenizer(src: string) {
    const rule1 = /^\${2}([\s\S]+?)\${2}/;
    const match1 = rule1.exec(src);
    if (match1) {
      return {
        type: 'katexBlock',
        raw: match1[0],
        text: match1[1].trim(),
        displayMode: true,
      };
    }

    const rule2 = /^\\\[([\s\S]+?)\\\]/;
    const match2 = rule2.exec(src);
    if (match2) {
      return {
        type: 'katexBlock',
        raw: match2[0],
        text: match2[1].trim(),
        displayMode: true,
      };
    }
    return undefined;
  },
  renderer(token: any) {
    return katex.renderToString(token.text, {
      throwOnError: false,
      displayMode: token.displayMode,
    });
  },
};

const katexInlineExtension: TokenizerExtension & RendererExtension = {
  name: 'katexInline',
  level: 'inline',
  start(src: string) {
    const match = src.match(/(\$|\\\()/);
    return match ? match.index : -1;
  },
  tokenizer(src: string) {
    const rule1 = /^\$([^$]+?)\$/;
    const match1 = rule1.exec(src);
    if (match1) {
      return {
        type: 'katexInline',
        raw: match1[0],
        text: match1[1].trim(),
        displayMode: false,
      };
    }

    const rule2 = /^\\\(([\s\S]+?)\\\)/;
    const match2 = rule2.exec(src);
    if (match2) {
      return {
        type: 'katexInline',
        raw: match2[0],
        text: match2[1].trim(),
        displayMode: false,
      };
    }
    return undefined;
  },
  renderer(token: any) {
    return katex.renderToString(token.text, {
      throwOnError: false,
      displayMode: token.displayMode,
    });
  },
};

marked.use({
  extensions: [katexBlockExtension, katexInlineExtension],
  walkTokens: (token) => {
    if (token.type === 'code') {
      const language = hljs.getLanguage(token.lang) ? token.lang : 'plaintext';
      token.text = hljs.highlight(token.text, { language }).value;
    }
  },
});

interface MarkdownRendererProps {
  content: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  const [html, setHtml] = useState('');

  useEffect(() => {
    const parsed = marked.parse(content);
    const sanitized = DOMPurify.sanitize(parsed as string);
    setHtml(sanitized);
  }, [content]);

  return <div style={{ userSelect: 'text' }} dangerouslySetInnerHTML={{ __html: html }} />;
};

export default MarkdownRenderer; 