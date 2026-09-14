import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'
import { expect, it, vi } from 'vitest'

it('Harmony title returns hidden-capsule roots to host while preserving detail and embedded history', () => {
 const source = fs.readFileSync(path.resolve(import.meta.dirname, '../../../../harmony/dimina/src/main/ets/DPages/DMPPageTitle.ets'), 'utf8')
 const methods = source.slice(source.indexOf('  private showBackButton()'), source.indexOf('  private showHomeButton()'))
 const code = ts.transpileModule(`class Title { appIndex = 1; webViewId = 2; ${methods} }; globalThis.Title = Title`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
 let depth = 1
 let tab = false
 let embedded = false
 const backward = vi.fn()
 const pop = vi.fn()
 const app = {
  navigatorManager: { getPageCountForWebViewId: () => depth, getPageRecordById: () => ({ pagePath: 'index', embeddedCanGoBack: embedded }), getCurNavigator: () => ({ pop }) },
  bundleManager: { getJsAppModuleConfig: () => ({ isTabBarPage: () => tab }) },
  getWebController: () => ({ subController: { accessBackward: () => embedded, backward } }),
 }
 const manager = { showCapsule: true, getApp: () => app, exitMiniProgram: vi.fn(() => Promise.resolve()) }
 const context: any = { DMPAppManager: { sharedInstance: () => manager }, DMPLogger: { e: vi.fn() }, Tags: {} }
 vm.runInNewContext(code, context)
 const title = new context.Title()
 expect(title.showBackButton()).toBe(false)
 manager.showCapsule = false
 expect(title.showBackButton()).toBe(true)
 tab = true
 expect(title.showBackButton()).toBe(true)
 title.goBack()
 expect(manager.exitMiniProgram).toHaveBeenCalledTimes(1)
 expect(pop).not.toHaveBeenCalled()
 depth = 2
 title.goBack()
 expect(pop).toHaveBeenCalledTimes(1)
 expect(manager.exitMiniProgram).toHaveBeenCalledTimes(1)
 embedded = true
 title.goBack()
 expect(backward).toHaveBeenCalledTimes(1)
 manager.showCapsule = true
 expect(title.showBackButton()).toBe(false)
 tab = false
 depth = 1
 expect(title.showBackButton()).toBe(true)
 title.goBack()
 expect(backward).toHaveBeenCalledTimes(2)
})
