// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: {
          50: 'oklch(97% 0.014 254.604)',     // #eff6ff
          100: 'oklch(93.2% 0.032 255.585)', // #dbeafe
          200: 'oklch(88.2% 0.059 254.128)', // #bfdbfe
          300: 'oklch(80.9% 0.105 251.813)', // #93c5fd
          400: 'oklch(70.7% 0.165 254.624)', // #60a5fa
          500: 'oklch(62.3% 0.214 259.815)', // #3b82f6
          600: 'oklch(54.6% 0.245 262.881)', // #2563eb
          700: 'oklch(48.8% 0.243 264.376)', // #1d4ed8
          800: 'oklch(42.4% 0.199 265.638)', // #1e40af
          900: 'oklch(37.9% 0.146 265.522)', // #1e3a8a
          950: 'oklch(28.2% 0.091 267.935)'  // #172554
        },
        neutral: { // Aliased from 'slate'
          50: 'oklch(98.4% 0.003 247.858)',  // #f8fafc
          100: 'oklch(96.8% 0.007 247.896)', // #f1f5f9
          200: 'oklch(92.9% 0.013 255.508)', // #e2e8f0
          300: 'oklch(86.9% 0.022 252.894)', // #cbd5e1
          400: 'oklch(70.4% 0.04 256.788)',  // #94a3b8
          500: 'oklch(55.4% 0.046 257.417)', // #64748b
          600: 'oklch(44.6% 0.043 257.281)', // #475569
          700: 'oklch(37.2% 0.044 257.287)', // #334155
          800: 'oklch(27.9% 0.041 260.031)', // #1e293b
          900: 'oklch(20.8% 0.042 265.755)', // #0f172a
          950: 'oklch(12.9% 0.042 264.695)'  // #020617
        }
      }
    }
  }
}


Semantic Color Mappings

The template uses semantic aliases (e.g., bg-elevated, text-default) which map to the neutral (slate) palette.

Light Mode Mappings

Page Background: white

Card Background (bg-elevated): neutral-50 (#f8fafc)

Default Text (text-default): neutral-700 (#334155)

Main Text (text-highlighted): neutral-900 (#0f172a)

Muted Text (text-muted): neutral-500 (#64748b)

Button Text (text-inverted on bg-primary): white

Dark Mode Mappings

Page Background: neutral-950 (#020617)

Card Background (bg-elevated): neutral-900 (#0f172a)

Default Text (text-default): neutral-200 (#e2e8f0)

Main Text (text-highlighted): white or neutral-50 (#f8fafc)

Muted Text (text-muted): neutral-400 (#94a3b8)

Button Text (text-inverted on bg-primary): neutral-900 (#0f172a)