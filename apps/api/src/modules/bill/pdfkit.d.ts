declare module 'pdfkit' {
  interface PDFDocumentOptions {
    margin?: number;
    size?: string | [number, string | number];
    bufferPages?: boolean;
    [key: string]: unknown;
  }

  interface TextOptions {
    align?: 'left' | 'center' | 'right' | 'justify';
    width?: number;
    continued?: boolean;
    [key: string]: unknown;
  }

  class PDFDocument {
    constructor(options?: PDFDocumentOptions);
    on(event: string, listener: (...args: any[]) => void): this;
    fontSize(size: number): this;
    font(name: string): this;
    text(text: string, options?: TextOptions): this;
    moveDown(space?: number): this;
    end(): void;
  }

  export = PDFDocument;
}
