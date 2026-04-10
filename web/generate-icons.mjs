// Run once: node generate-icons.mjs
// Generates PWA icons for the entregador app

import { createCanvas } from 'canvas';
import { writeFileSync } from 'fs';

function generateIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const r = size * 0.15; // corner radius

  // Background
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(size - r, 0);
  ctx.quadraticCurveTo(size, 0, size, r);
  ctx.lineTo(size, size - r);
  ctx.quadraticCurveTo(size, size, size - r, size);
  ctx.lineTo(r, size);
  ctx.quadraticCurveTo(0, size, 0, size - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
  ctx.fillStyle = '#0d1117';
  ctx.fill();

  // Green circle accent
  ctx.beginPath();
  ctx.arc(size / 2, size * 0.42, size * 0.28, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(34,197,94,0.1)';
  ctx.fill();

  // TG text
  ctx.fillStyle = '#22c55e';
  ctx.font = `900 ${size * 0.36}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('TG', size / 2, size * 0.42);

  // Bottom label
  ctx.fillStyle = '#4b5563';
  ctx.font = `700 ${size * 0.09}px Arial`;
  ctx.fillText('ENTREGAS', size / 2, size * 0.75);

  // Green dot
  ctx.beginPath();
  ctx.arc(size / 2, size * 0.86, size * 0.04, 0, Math.PI * 2);
  ctx.fillStyle = '#22c55e';
  ctx.fill();

  return canvas.toBuffer('image/png');
}

try {
  writeFileSync('./public/icon-tg-192.png', generateIcon(192));
  writeFileSync('./public/icon-tg-512.png', generateIcon(512));
  console.log('Icons generated: public/icon-tg-192.png, public/icon-tg-512.png');
} catch (e) {
  console.error('Failed to generate icons (canvas not installed):', e.message);
  console.log('Install: npm install canvas');
}
