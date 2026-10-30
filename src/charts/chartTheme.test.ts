import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DARK_COLORS, LIGHT_COLORS, buildEChartsTheme, type ChartColors } from './chartTheme'

const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8')

/** `--name: #hex` pairs from the first `:root { … }` block after `marker` in index.css. */
function tokens(marker: string): Record<string, string> {
  const start = css.indexOf(':root', css.indexOf(marker))
  const block = css.slice(start, css.indexOf('}', start))
  return Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2].toLowerCase()]))
}

const light = tokens('/* Design tokens')
const dark = tokens('prefers-color-scheme: dark')

/** WCAG 2 relative luminance and contrast ratio. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

describe.each([
  ['light', light, LIGHT_COLORS],
  ['dark', dark, DARK_COLORS],
] as [string, Record<string, string>, ChartColors][])('%s color scheme', (_, cssTokens, palette) => {
  it('chart palette matches the CSS design tokens', () => {
    for (const [key, value] of Object.entries(palette)) {
      expect(cssTokens[key], `--${key}`).toBe(value.toLowerCase())
    }
  })

  it.each(['text', 'muted', 'accent', 'danger'])('%s text meets WCAG AA (4.5:1) on page and card backgrounds', (token) => {
    expect(contrast(cssTokens[token], cssTokens.bg)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(cssTokens[token], cssTokens.surface)).toBeGreaterThanOrEqual(4.5)
  })

  it('button text meets WCAG AA on the accent color', () => {
    expect(contrast(cssTokens['accent-contrast'], cssTokens.accent)).toBeGreaterThanOrEqual(4.5)
  })
})

describe('buildEChartsTheme', () => {
  it('styles tooltips and axes from the palette', () => {
    const theme = buildEChartsTheme(DARK_COLORS)
    expect(theme.tooltip.backgroundColor).toBe(DARK_COLORS.surface)
    expect(theme.valueAxis.axisLabel.color).toBe(DARK_COLORS.muted)
  })
})
