import DefaultTheme from 'vitepress/theme'
import './custom.css'
import BookFigure from './components/BookFigure.vue'
import CaseMeta from './components/CaseMeta.vue'
import ChapterContext from './components/ChapterContext.vue'
import ChapterDeliverables from './components/ChapterDeliverables.vue'
import EvidencePanel from './components/EvidencePanel.vue'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('BookFigure', BookFigure)
    app.component('CaseMeta', CaseMeta)
    app.component('ChapterContext', ChapterContext)
    app.component('ChapterDeliverables', ChapterDeliverables)
    app.component('EvidencePanel', EvidencePanel)
  },
}
