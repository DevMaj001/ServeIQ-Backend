import { Injectable } from '@nestjs/common';

const PDFDocument = require('pdfkit');

export interface ReceiptData {
  business?: {
    name?: string;
    address?: string;
    phone?: string;
    email?: string;
  } | null;
  branch?: { name?: string; address?: string } | null;
  tab?: { id: string; table_id: string } | null;
  table?: { label?: string } | null;
  waiter?: { full_name?: string } | null;
  bill: {
    subtotal_kobo: number;
    service_charge_kobo: number;
    discount_kobo: number;
    total_kobo: number;
    payment_method?: string;
    payment_reference?: string;
    paid_at?: Date;
    issued_by: string;
  };
  orders: Array<{
    menu_item?: { name?: string } | null;
    quantity: number;
    subtotal_kobo: number;
  }>;
  receipt_number: string;
}

@Injectable()
export class ReceiptService {
  generatePdf(data: ReceiptData): Buffer {
    const doc = new PDFDocument({ margin: 30, size: [226, 'auto'] });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    const koboToNaira = (kobo: number) => `₦${(kobo / 100).toFixed(2)}`;
    const businessName = data.business?.name || 'Business';
    const branchName = data.branch?.name || '';
    const tableLabel = data.table?.label || '';
    const waiterName = data.waiter?.full_name || '';

    // Header
    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .text(businessName, { align: 'center' });
    if (branchName)
      doc.fontSize(8).font('Helvetica').text(branchName, { align: 'center' });
    doc
      .fontSize(7)
      .text(`Receipt: ${data.receipt_number}`, { align: 'center' });
    if (data.bill.paid_at) {
      doc.fontSize(7).text(new Date(data.bill.paid_at).toLocaleString(), {
        align: 'center',
      });
    }
    doc.moveDown(0.3);

    // Separator
    doc.fontSize(7).text('─'.repeat(28), { align: 'center' });
    doc.moveDown(0.3);

    // Table / Waiter
    doc.fontSize(7).text(`Table: ${tableLabel}     Waiter: ${waiterName}`);
    doc.moveDown(0.3);

    // Separator
    doc.fontSize(7).text('─'.repeat(28), { align: 'center' });
    doc.moveDown(0.3);

    // Order Items header
    doc.font('Helvetica-Bold').fontSize(7);
    doc.text('Item', { continued: true });
    doc.text('Qty', { width: 30, align: 'right', continued: true });
    doc.text('Amount', { width: 55, align: 'right' });
    doc.font('Helvetica');

    doc.fontSize(7).text('─'.repeat(28), { align: 'center' });
    doc.moveDown(0.2);

    for (const order of data.orders) {
      const name = order.menu_item?.name || 'Item';
      const truncated = name.length > 16 ? name.substring(0, 14) + '..' : name;

      doc.fontSize(7);
      doc.text(truncated, { continued: true });
      doc.text(`${order.quantity}`, {
        width: 30,
        align: 'right',
        continued: true,
      });
      doc.text(koboToNaira(order.subtotal_kobo), { width: 55, align: 'right' });
    }

    doc.moveDown(0.2);
    doc.fontSize(7).text('─'.repeat(28), { align: 'center' });
    doc.moveDown(0.2);

    // Totals
    doc.font('Helvetica');
    doc.fontSize(7).text(`Subtotal:`, { continued: true });
    doc.text(koboToNaira(data.bill.subtotal_kobo), {
      width: 70,
      align: 'right',
    });

    doc.fontSize(7).text(`Service Charge:`, { continued: true });
    doc.text(koboToNaira(data.bill.service_charge_kobo), {
      width: 70,
      align: 'right',
    });

    if (data.bill.discount_kobo > 0) {
      doc.fontSize(7).text(`Discount:`, { continued: true });
      doc.text(`-${koboToNaira(data.bill.discount_kobo)}`, {
        width: 70,
        align: 'right',
      });
    }

    doc.moveDown(0.2);
    doc.fontSize(9).font('Helvetica-Bold').text(`Total:`, { continued: true });
    doc.text(koboToNaira(data.bill.total_kobo), { width: 70, align: 'right' });

    doc.moveDown(0.3);
    doc.fontSize(7).font('Helvetica');

    // Payment info
    if (data.bill.payment_method) {
      doc.text(`Paid via: ${data.bill.payment_method.toUpperCase()}`, {
        align: 'center',
      });
    }
    if (data.bill.payment_reference) {
      doc.text(`Ref: ${data.bill.payment_reference}`, { align: 'center' });
    }

    doc.moveDown(0.5);
    doc.fontSize(7).text('Thank you for your patronage!', { align: 'center' });

    doc.end();

    return Buffer.concat(chunks);
  }
}
