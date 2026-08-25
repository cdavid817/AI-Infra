# 视觉资产

新图进入本目录；旧 `diagrams/` 与 `images/` 在章节迁移时再登记，不做一次性移动。

- `source/`：可编辑源码或生成配置；
- `data/`：定量图输入，必须写单位；
- `generated/`：离线生成的发布产物；
- `scripts/`：固定输入、无网络依赖的生成脚本；
- `manifest.yaml`：图的用途、来源、alt、图注和状态。

运行 `npm run visuals:build` 重新生成，运行 `npm run docs:check:visuals` 检查台账与正文引用。
