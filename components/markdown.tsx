'use client';

import { memo, type ComponentProps } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';

function Code({ className, children, ...props }: ComponentProps<'code'>) {
  const match = /language-(\w+)/.exec(className || '');
  return match ? (
    <SyntaxHighlighter style={oneDark} language={match[1]} PreTag="div">
      {String(children).replace(/\n$/, '')}
    </SyntaxHighlighter>
  ) : (
    <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded" {...props}>
      {children}
    </code>
  );
}

export const Markdown = memo(function Markdown({ text }: { text: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ code: Code }}>
        {text}
      </ReactMarkdown>
    </div>
  );
});
