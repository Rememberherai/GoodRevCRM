'use client';

import { QRCodeSVG } from 'qrcode.react';

export function TicketQrCode({ value, size }: { value: string; size: number }) {
  return <QRCodeSVG value={value} size={size} />;
}
