import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'
import globals from 'globals'
import tseslint from 'typescript-eslint'

// FSD: слой импортирует только слои ниже себя, чужой слайс — только через его index.ts
const layers = ['app', 'pages', 'widgets', 'features', 'entities', 'shared']

const publicApi = {
  group: ['@/*/*/**'],
  message: 'Импортируй слайс через его публичный API (index.ts), а не внутренние файлы.',
}

const layerRules = layers.map((layer, index) => ({
  files: [`src/${layer}/**/*.{ts,tsx}`],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          publicApi,
          ...(index > 0
            ? [
                {
                  group: layers.slice(0, index).map((upper) => `@/${upper}/**`),
                  message: `${layer} не может зависеть от слоёв выше: ${layers.slice(0, index).join(', ')}.`,
                },
              ]
            : []),
        ],
      },
    ],
  },
}))

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: { ecmaVersion: 2022, globals: globals.browser },
  },
  ...layerRules,
])
