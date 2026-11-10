import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'

function checkInitialLessonLoading(): Plugin {
  return {
    name: 'check-initial-lesson-loading',
    apply: 'build',
    generateBundle(_, bundle) {
      const pending = Object.values(bundle)
        .filter(output => output.type === 'chunk' && output.isEntry)
        .map(output => output.fileName)
      const visited = new Set<string>()
      const unexpected = new Set<string>()

      while (pending.length) {
        const file = pending.pop()!
        if (visited.has(file)) continue
        visited.add(file)
        const chunk = bundle[file]
        if (chunk?.type !== 'chunk') continue
        pending.push(...chunk.imports)

        for (const id of Object.keys(chunk.modules)) {
          const modulePath = id.replaceAll('\\', '/').split('?')[0]
          const page = modulePath.match(/(?:^|\/)src\/pages\/([^/]+\.tsx)$/)?.[1]
          const domain = modulePath.match(/(?:^|\/)src\/domain\/([^/]+\.ts)$/)?.[1]
          const challenge = /(?:^|\/)src\/data\/(?:challenges|[^/]+Challenges)\.ts$/.test(modulePath)
          // The home page runs its own variables demo. Other course code should load with its route.
          const simulator = domain && !domain.endsWith('Config.ts') && !['index.ts', 'types.ts', 'variables.ts'].includes(domain)
          if ((page && page !== 'HomePage.tsx') || simulator || challenge) {
            unexpected.add(modulePath.replace(/^.*\/src\//, 'src/'))
          }
        }
      }

      if (unexpected.size) {
        this.error(`Course code is loaded before its route:\n${[...unexpected].sort().join('\n')}`)
      }
    },
  }
}

export default defineConfig({
  base: '/WoiZhiCheng_Learn_C_Programming/',
  plugins: [react(), checkInitialLessonLoading()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    css: true,
  },
})
