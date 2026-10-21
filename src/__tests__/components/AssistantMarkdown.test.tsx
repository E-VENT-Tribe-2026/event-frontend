import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AssistantMarkdown } from '@/components/assistant/AssistantMarkdown';

describe('AssistantMarkdown', () => {
  it('renders headings correctly (h1, h2, h3)', () => {
    const content = `# Main Heading\n## Secondary Heading\n### Tertiary Heading`;
    render(<AssistantMarkdown content={content} />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Main Heading');
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Secondary Heading');
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Tertiary Heading');
  });

  it('renders unordered and ordered lists', () => {
    const content = `- First item\n- Second item\n\n1. Numbered one\n2. Numbered two`;
    render(<AssistantMarkdown content={content} />);

    expect(screen.getByText('First item')).toBeInTheDocument();
    expect(screen.getByText('Second item')).toBeInTheDocument();
    expect(screen.getByText('Numbered one')).toBeInTheDocument();
    expect(screen.getByText('Numbered two')).toBeInTheDocument();
  });

  it('renders bold, italic, and inline code formatting', () => {
    const content = `This is **bold text** and *italic text* with \`inline code\`.`;
    render(<AssistantMarkdown content={content} />);

    const boldEl = screen.getByText('bold text');
    expect(boldEl.tagName).toBe('STRONG');

    const italicEl = screen.getByText('italic text');
    expect(italicEl.tagName).toBe('EM');

    const codeEl = screen.getByText('inline code');
    expect(codeEl.tagName).toBe('CODE');
  });

  it('renders safe internal and external markdown links', () => {
    const content = `Visit [Home](/home) or [Website](https://example.com).`;
    render(
      <BrowserRouter>
        <AssistantMarkdown content={content} />
      </BrowserRouter>
    );

    const internalLink = screen.getByRole('link', { name: /home/i });
    expect(internalLink).toHaveAttribute('href', '/home');

    const externalLink = screen.getByRole('link', { name: /website/i });
    expect(externalLink).toHaveAttribute('href', 'https://example.com');
    expect(externalLink).toHaveAttribute('target', '_blank');
  });

  it('renders fenced code blocks', () => {
    const content = `\`\`\`javascript\nconst greet = "hello";\nconsole.log(greet);\n\`\`\``;
    render(<AssistantMarkdown content={content} />);

    expect(screen.getByText(/const greet = "hello";/)).toBeInTheDocument();
    expect(screen.getByText(/javascript/i)).toBeInTheDocument();
  });
});
