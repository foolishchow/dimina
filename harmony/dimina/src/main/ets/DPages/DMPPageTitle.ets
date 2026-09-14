import { DMPApp } from '../DApp/DMPApp'
import { DMPPageStyle } from './DMPPageStyle'
import { DMPWindowUtil } from '../Utils/DMPWindowUtils'
import { DMPPageRecord } from '../Navigator/DMPPageRecord'
import { DMPAppManager } from '../DApp/DMPAppManager'
import { DMPMenuButtonLayout } from '../Utils/DMPMenuButtonLayout'
import { DMPLogger } from '../EventTrack/DMPLogger'
import { Tags } from '../EventTrack/Tags'

@Component
export struct DMPPageTitle {
  @Prop
  pageRecord: DMPPageRecord
  @Prop
  appIndex: number
  @Prop
  webViewId: number
  private readonly titleHorizontalInset: number = DMPMenuButtonLayout.titleHorizontalInset

  aboutToAppear(): void {

  }

  build() {
    Column() {
      Blank()
        .height(px2vp(DMPWindowUtil.getTopSafeArea(DMPApp.getWindowStage())))
      Stack() {
        Text(this.getPageStyle(this.pageRecord)?.getTitleString() ?? '')
          .height('100%')
          .width('100%')
          .padding({ left: this.titleHorizontalInset, right: this.titleHorizontalInset })
          .fontSize(18)
          .fontColor(this.getPageStyle(this.pageRecord)?.getTitleTextColor() ?? '#000000')
          .fontWeight('500')
          .textAlign(TextAlign.Center)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })

        if (this.showBackButton()) {
          Image($r(this.getPageStyle(this.pageRecord)?.isStatusBarDarkMode() ? 'app.media.ic_dmp_back_black' :
            'app.media.ic_dmp_back_white'))
            .width(55)
            .height(55)
            .padding(15)
            .position({ x: 0, y: 0 })
            .accessibilityText('返回')
            .onClick(() => { this.goBack() })
        }
        // 返回首页按钮独立判定：homeButton: true 的内页与返回箭头并存
        // （微信实测样式），此时让出左槽紧随箭头之后
        if (this.showHomeButton()) {
          // 图形使用 vp 布局，SVG viewBox 负责缩放路径，避免把物理 px 路径当成 vp。
          Stack({ alignContent: Alignment.Center }) {
            Circle()
              .width(32)
              .height(32)
              .fill(this.getPageStyle(this.pageRecord)?.isStatusBarDarkMode() ? '#D6D6D6' : 'rgba(255,255,255,0.24)')
            Image($r('app.media.ic_dmp_home'))
              .width(22)
              .height(22)
              .fillColor(this.getPageStyle(this.pageRecord)?.getTitleTextColor() ?? '#000000')
          }
            .width(55)
            .height(55)
            .position({ x: this.showBackButton() ? 55 : 0, y: 0 })
            .accessibilityText('返回小程序首页')
            .onClick(() => {
              this.goHome()
            })
        }
      }
      .width('100%')
      .height(55)
      .alignContent(Alignment.Center)
    }.width('100%')
    .backgroundColor(this.getPageStyle(this.pageRecord)?.getNavigationBarBackGroundColor() ?? '#ffffff')
  }

  private getPageStyle(_: DMPPageRecord): DMPPageStyle | undefined {
    const pageRecord =
      DMPAppManager.sharedInstance().getApp(this.appIndex)?.navigatorManager.getPageRecordById(this.webViewId)
    if (pageRecord) {
      return pageRecord.pageStyle
    }
    return undefined;
  }

  // 隐藏胶囊时始终提供返回入口，栈底点击退出到宿主。默认胶囊模式下，tabBar 页不显示；
  // 栈深 > 1 显示；栈底页面仅当嵌入 web-view（同层渲染）自身有可回退历史时保留箭头
  // （点击优先回退嵌入历史，见 onClick）。读 pageRecord.embeddedCanGoBack 镜像而非直接
  // 轮询 controller——镜像赋值本身就是标题栏的重建信号（见 EmbedWebView.syncEmbeddedHistoryState），
  // 保证箭头随嵌入历史出现/消失。栈底箭头与返回首页按钮互斥，见 shouldShowHomeButton
  private showBackButton(): boolean {
    const app = DMPAppManager.sharedInstance().getApp(this.appIndex)
    if (!app) {
      return true // app 尚不可用时维持既有箭头展示，不误藏
    }
    if (!DMPAppManager.sharedInstance().showCapsule) {
      return true
    }
    const pageRecord = app.navigatorManager.getPageRecordById(this.webViewId)
    const pagePath = pageRecord?.pagePath
    if (pagePath && app.bundleManager.getJsAppModuleConfig()?.isTabBarPage(pagePath)) {
      return false
    }
    if (app.navigatorManager.getPageCountForWebViewId(this.webViewId) > 1) {
      return true
    }
    return pageRecord?.embeddedCanGoBack === true
  }

  private goBack(): void {
    const app = DMPAppManager.sharedInstance().getApp(this.appIndex)
    if (app && !DMPAppManager.sharedInstance().showCapsule &&
      app.navigatorManager.getPageCountForWebViewId(this.webViewId) <= 1) {
      DMPAppManager.sharedInstance().exitMiniProgram(app, async () => {}).catch((error: Error) => {
        DMPLogger.e(Tags.DMP_PAGE, `navigation close failed: ${error.message}`)
      })
      return
    }
    const embedController =
      DMPAppManager.sharedInstance().getApp(this.appIndex)?.getWebController(this.webViewId)?.subController
    if (embedController?.accessBackward()) {
      embedController.backward()
    } else {
      DMPAppManager.sharedInstance().getApp(this.appIndex)?.navigatorManager.getCurNavigator()?.pop()
    }
  }

  private showHomeButton(): boolean {
    return this.getPageStyle(this.pageRecord)?.shouldShowHomeButton(this.webViewId) ?? false
  }

  // 路由判定收敛在 DMPNavigator.navigateHome（switchTab / redirectTo 的选择），标题栏只发起
  private goHome(): void {
    const navigator = DMPAppManager.sharedInstance().getApp(this.appIndex)?.navigatorManager.getCurNavigator()
    navigator?.navigateHome().catch((err: Error) => {
      DMPLogger.e(Tags.NAVIGATOR, `navigateHome failed: ${err?.message ?? err}`)
    })
  }
}
