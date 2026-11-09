import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'dist2']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    // 테마 토큰으로 옮긴 파일에 hex 색상 클래스가 다시 들어오지 않게 막는다 (docs/tech-debt-audit-2026-11-09.md 5번).
    // 액션 버튼 색(bg-[#3D8EF8] 등)은 별도 단계에서 옮기므로 아직 허용한다.
    files: ['src/components/MonthlyDashboard.tsx'],
    rules: {
      'no-restricted-syntax': ['error', ...['Literal', 'TemplateElement'].map((node) => ({
        selector: `${node}[value${node === 'TemplateElement' ? '.raw' : ''}=/\\b(?:bg|text|border|from|to|via|ring|fill|stroke|outline|divide|placeholder|decoration)-\\[#(?!(?:3D8EF8|3182F6|244268|5AA0FF|2272EB)\\])[0-9A-Fa-f]{6}\\]/]`,
        message: 'hex 색상 클래스 대신 테마 토큰(bg-surface, text-muted, bg-tone-blue/15 등)을 쓰세요. src/index.css의 @theme 참고',
      }))],
    },
  },
])
