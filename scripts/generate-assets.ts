/**
 * Brand Asset Generator for ParseBench
 * Generates OG images and favicon using project branding
 * 
 * Usage: bun run scripts/generate-assets.ts
 */

import sharp from 'sharp';
import { Resvg } from '@resvg/resvg-js';
import { writeFileSync } from 'fs';
import { join } from 'path';

const BRAND = {
  background: '#050505',
  panel: '#131010',
  foreground: '#fafafa',
  muted: '#71717a',
  accent: '#F8BC31', // CrafterStation yellow
  border: 'rgba(255, 255, 255, 0.1)',
  borderSolid: '#1a1a1a',
} as const;

// CrafterStation logo path (extracted from components/logos/crafter-station.tsx)
const CRAFTER_LOGO_PATH = 'M116.419 16.3268C109.59 11.5679 97.9222 5.96914 90.2388 3.72965C72.8798 -1.58913 59.1794 1.40491 50.114 4.56947C32.4704 10.7281 21.3721 18.8462 11.412 33.6828C-4.23949 56.6375 -1.96292 93.869 17.1035 114.864C21.3721 119.903 23.6487 119.063 40.1539 107.026C40.723 106.466 38.4465 102.827 35.0316 98.6278C27.3481 89.11 22.7949 71.754 25.0715 61.9563C32.4704 31.1634 70.3187 14.6472 94.7919 31.4433C100.199 35.0825 117.273 50.199 132.64 65.0356C155.691 86.8706 162.52 91.9094 168.212 91.3496C173.903 90.7897 175.895 88.8301 176.464 82.6715C177.318 75.9531 174.757 72.034 161.667 60.2767C152.845 52.1585 145.731 44.8802 145.731 43.4805C145.731 42.3608 151.707 37.6019 159.105 33.1229C206.914 3.1698 258.421 62.7961 218.581 101.987C213.459 107.026 204.353 112.345 198.377 114.024C191.547 115.704 159.959 117.104 120.688 117.104C47.2683 117.104 43.2842 117.943 23.9332 135.02C-0.824636 157.134 -6.51609 194.926 10.8429 222.359C33.3241 258.191 81.7016 267.149 115.85 241.675L128.372 232.157L142.885 241.675C166.504 257.351 185.571 260.431 208.621 252.872C254.722 237.476 271.796 179.809 241.916 141.178C238.501 136.979 236.794 136.699 232.241 138.939C218.297 146.777 218.581 146.217 226.834 163.013C233.094 175.89 234.233 180.929 232.81 190.727C228.826 215.361 210.044 231.877 186.14 231.877C167.643 231.877 161.667 228.238 127.518 195.486C109.59 178.689 93.0845 164.693 90.8079 164.693C86.5393 164.693 77.433 173.371 77.433 177.57C77.433 178.689 85.1165 187.647 94.7919 197.165L112.151 214.241L101.906 222.08C65.7655 249.233 14.2578 216.761 26.2098 174.211C29.9093 161.333 42.9996 147.057 55.5209 142.578C60.3586 140.618 90.2388 139.498 130.648 139.498C204.922 139.498 213.744 138.099 230.818 123.542C281.757 80.9919 252.161 0.930299 185.571 1.21023C166.22 1.21023 155.691 5.12933 137.762 18.2863L128.656 25.0048L116.419 16.3268Z';

function createCrafterLogoSvg(size: number, color: string = BRAND.accent): string {
  const scale = size / 257;
  return `
    <g transform="scale(${scale})">
      <path d="${CRAFTER_LOGO_PATH}" fill="${color}"/>
    </g>
  `;
}

// Generate particles matching ParticleBackground component
function generateParticles(width: number, height: number, count: number): string {
  const particles: string[] = [];
  const centerX = width / 2;
  const centerY = height / 2;
  const maxRadius = Math.max(centerX, centerY) * 1.5;
  
  // Simulate rotation angle (frozen in time for static image)
  const rotation = 0.3;
  
  for (let i = 0; i < count; i++) {
    const angle = (Math.random() * Math.PI * 2) + rotation;
    const radius = Math.pow(Math.random(), 0.5) * maxRadius;
    
    // Create density rings like the component
    const ringFactor = Math.sin(radius * 0.02) * 0.5 + 0.5;
    
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;
    const size = Math.random() * 1.5 + 0.5;
    const opacity = (0.3 + Math.random() * 0.7) * ringFactor;
    
    particles.push(`<circle cx="${x}" cy="${y}" r="${size}" fill="rgba(245, 245, 245, ${opacity})"/>`);
  }
  
  return particles.join('\n');
}

function createOgImageSvg(width: number, height: number): string {
  // Match UI structure: max-w-7xl (1280px) centered with mx-4 sm:mx-6
  // Scale down proportionally for OG image
  const maxPanelWidth = 1120; // 1280 - 160 (margins)
  const marginX = 40; // scaled margin
  const panelWidth = Math.min(maxPanelWidth, width - marginX * 2);
  const panelX = (width - panelWidth) / 2;
  
  const headerHeight = 60;
  const panelTop = 40;
  const panelHeight = height - panelTop - 40;
  
  const logoSize = 32; // w-8 h-8 = 32px
  
  return `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <!-- Solid background matching body background -->
      <rect width="${width}" height="${height}" fill="${BRAND.background}"/>
      
      <!-- Particles background (like ParticleBackground component) -->
      <g opacity="0.8">
        ${generateParticles(width, height, Math.floor((width * height) / 800))}
      </g>
      
      <!-- Margin lines container (fixed inset-x-0, centered) -->
      <g opacity="0.1">
        <line x1="${panelX}" y1="0" x2="${panelX}" y2="${height}" stroke="white" stroke-width="1"/>
        <line x1="${panelX + panelWidth}" y1="0" x2="${panelX + panelWidth}" y2="${height}" stroke="white" stroke-width="1"/>
      </g>
      
      <!-- Main panel (bg-[#131010]/80 border-x border-b border-white/10) -->
      <g>
        <!-- Panel background -->
        <rect 
          x="${panelX}" 
          y="${panelTop}" 
          width="${panelWidth}" 
          height="${panelHeight}" 
          fill="rgba(19, 16, 16, 0.8)"
        />
        
        <!-- Panel borders: left, right, bottom (no top) -->
        <line x1="${panelX}" y1="${panelTop}" x2="${panelX}" y2="${panelTop + panelHeight}" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>
        <line x1="${panelX + panelWidth}" y1="${panelTop}" x2="${panelX + panelWidth}" y2="${panelTop + panelHeight}" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>
        <line x1="${panelX}" y1="${panelTop + panelHeight}" x2="${panelX + panelWidth}" y2="${panelTop + panelHeight}" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>
        
        <!-- Header (bg-[#131010]/95 backdrop-blur-xl border-b border-white/10) -->
        <rect 
          x="${panelX}" 
          y="${panelTop}" 
          width="${panelWidth}" 
          height="${headerHeight}"
          fill="rgba(19, 16, 16, 0.95)"
        />
        <line 
          x1="${panelX}" 
          y1="${panelTop + headerHeight}" 
          x2="${panelX + panelWidth}" 
          y2="${panelTop + headerHeight}" 
          stroke="rgba(255,255,255,0.1)" 
          stroke-width="1"
        />
        
        <!-- Header content (px-6 sm:px-8 py-3) -->
        <g transform="translate(${panelX + 24}, ${panelTop + 12})">
          <!-- CrafterStation Logo -->
          <g transform="translate(0, 0)">
            ${createCrafterLogoSvg(logoSize, BRAND.accent)}
          </g>
          
          <!-- Header text (gap-3) -->
          <g transform="translate(${logoSize + 12}, 0)">
            <text 
              x="0" 
              y="14" 
              font-family="system-ui, -apple-system, sans-serif" 
              font-size="14" 
              font-weight="600" 
              fill="${BRAND.foreground}"
            >ParseBench</text>
            <text 
              x="0" 
              y="28" 
              font-family="system-ui, -apple-system, sans-serif" 
              font-size="12" 
              fill="${BRAND.muted}"
            >Document Parsing Playground</text>
          </g>
        </g>
        
        <!-- Main content area (centered in remaining space) -->
        <g transform="translate(${width / 2}, ${panelTop + headerHeight + (panelHeight - headerHeight) / 2 + 20})">
          <!-- Large centered logo -->
          <g transform="translate(-48, -100)">
            ${createCrafterLogoSvg(96, BRAND.accent)}
          </g>
          
          <!-- App name -->
          <text 
            x="0" 
            y="40" 
            font-family="system-ui, -apple-system, sans-serif" 
            font-size="64" 
            font-weight="700" 
            fill="${BRAND.foreground}" 
            text-anchor="middle"
            letter-spacing="-2"
          >ParseBench</text>
          
          <!-- Tagline -->
          <text 
            x="0" 
            y="80" 
            font-family="system-ui, -apple-system, sans-serif" 
            font-size="22" 
            fill="${BRAND.muted}" 
            text-anchor="middle"
          >Compare document parsing providers side-by-side</text>
          
          <!-- Provider badges (matching UI style) -->
          <g transform="translate(-200, 120)">
            <rect x="0" y="0" width="95" height="32" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)" stroke-width="1" rx="0"/>
            <text x="47.5" y="20" font-family="system-ui" font-size="12" fill="${BRAND.muted}" text-anchor="middle">LlamaParse</text>
            
            <rect x="105" y="0" width="85" height="32" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)" stroke-width="1" rx="0"/>
            <text x="147.5" y="20" font-family="system-ui" font-size="12" fill="${BRAND.muted}" text-anchor="middle">Mistral OCR</text>
            
            <rect x="200" y="0" width="75" height="32" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)" stroke-width="1" rx="0"/>
            <text x="237.5" y="20" font-family="system-ui" font-size="12" fill="${BRAND.muted}" text-anchor="middle">GPT-4o</text>
            
            <rect x="285" y="0" height="32" width="75" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)" stroke-width="1" rx="0"/>
            <text x="322.5" y="20" font-family="system-ui" font-size="12" fill="${BRAND.muted}" text-anchor="middle">Gemini</text>
          </g>
        </g>
      </g>
    </svg>
  `;
}

function createFaviconSvg(size: number): string {
  const padding = size * 0.12;
  const logoSize = size - padding * 2;
  
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#131010"/>
          <stop offset="100%" style="stop-color:${BRAND.background}"/>
        </linearGradient>
      </defs>
      <rect width="${size}" height="${size}" fill="url(#bgGrad)"/>
      <g transform="translate(${padding}, ${padding})">
        ${createCrafterLogoSvg(logoSize, BRAND.accent)}
      </g>
    </svg>
  `;
}

async function svgToPng(svg: string, width: number, height: number): Promise<Buffer> {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
  });
  const pngData = resvg.render();
  return pngData.asPng();
}

async function generateOgImages(): Promise<void> {
  const outputDir = join(process.cwd(), 'public');
  
  // OG Image (1200x630)
  console.log('Generating og.png (1200x630)...');
  const ogSvg = createOgImageSvg(1200, 630);
  const ogPng = await svgToPng(ogSvg, 1200, 630);
  writeFileSync(join(outputDir, 'og.png'), ogPng);
  console.log('  ✓ og.png');
  
  // Twitter OG Image (1200x600)
  console.log('Generating og-twitter.png (1200x600)...');
  const twitterSvg = createOgImageSvg(1200, 600);
  const twitterPng = await svgToPng(twitterSvg, 1200, 600);
  writeFileSync(join(outputDir, 'og-twitter.png'), twitterPng);
  console.log('  ✓ og-twitter.png');
}

async function generateFavicon(): Promise<void> {
  const outputDir = join(process.cwd(), 'public');
  const sizes = [16, 32, 48];
  
  console.log('Generating favicon.ico...');
  
  // Generate PNG for each size
  const pngBuffers: Buffer[] = [];
  for (const size of sizes) {
    const svg = createFaviconSvg(size);
    const png = await svgToPng(svg, size, size);
    pngBuffers.push(png);
  }
  
  // Create ICO file manually (simple approach: just use 32x32 as primary)
  // For proper multi-size ICO, use the 32x32 and let sharp handle it
  const favicon32Svg = createFaviconSvg(32);
  const favicon32Png = await svgToPng(favicon32Svg, 32, 32);
  
  // Use sharp to create favicon (will be PNG-based, browsers support this)
  await sharp(favicon32Png)
    .toFile(join(outputDir, 'favicon.ico'));
  console.log('  ✓ favicon.ico');
  
  // Also create apple-touch-icon and various sizes
  console.log('Generating apple-touch-icon.png (180x180)...');
  const appleSvg = createFaviconSvg(180);
  const applePng = await svgToPng(appleSvg, 180, 180);
  writeFileSync(join(outputDir, 'apple-touch-icon.png'), applePng);
  console.log('  ✓ apple-touch-icon.png');
  
  console.log('Generating favicon-16x16.png...');
  const favicon16Svg = createFaviconSvg(16);
  const favicon16Png = await svgToPng(favicon16Svg, 16, 16);
  writeFileSync(join(outputDir, 'favicon-16x16.png'), favicon16Png);
  console.log('  ✓ favicon-16x16.png');
  
  console.log('Generating favicon-32x32.png...');
  writeFileSync(join(outputDir, 'favicon-32x32.png'), favicon32Png);
  console.log('  ✓ favicon-32x32.png');
}

async function main(): Promise<void> {
  console.log('\n🎨 ParseBench Brand Asset Generator\n');
  console.log('Brand colors:');
  console.log(`  Background: ${BRAND.background}`);
  console.log(`  Foreground: ${BRAND.foreground}`);
  console.log(`  Accent: ${BRAND.accent}`);
  console.log('');
  
  await generateOgImages();
  console.log('');
  await generateFavicon();
  
  console.log('\n✅ All assets generated successfully!\n');
  console.log('Generated files:');
  console.log('  /public/og.png');
  console.log('  /public/og-twitter.png');
  console.log('  /public/favicon.ico');
  console.log('  /public/apple-touch-icon.png');
  console.log('  /public/favicon-16x16.png');
  console.log('  /public/favicon-32x32.png');
}

main().catch(console.error);
