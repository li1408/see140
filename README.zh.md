# see140

see140 是一个本地摄像头手势绘画网页。项目使用 Next.js、MediaPipe 和 Three.js，把手部动作转换成 3D 画布上的线条与物理效果。

线上访问：https://li1408.github.io/see140/

## 功能

- 黑白主题切换。
- 摄像头画面作为背景。
- 基于指尖位置绘画，并带校准流程。
- 双手缩放画布。
- 画板模式和重力模式。
- 清除线条时的粒子消散效果。
- 开场加载动画：圆环加载完成后点击继续，再通过浏览器窗口展开和白色页面转场进入主界面。

## 本地启动

直接双击一键启动脚本：

```powershell
.\start-see140.cmd
```

也可以手动启动：

```powershell
npm install
npm run dev
```

然后打开：

```text
http://127.0.0.1:3000/
```

浏览器询问摄像头权限时选择允许。

## 主要文件夹

- `src/` - Next.js 主项目代码。
- `public/` - 静态资源。
- `startup-animation-prototype/` - 原生 HTML/CSS/JS 开场动画原型。
- `docs/` - 项目说明和辅助文档。
