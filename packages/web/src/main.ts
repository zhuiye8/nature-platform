import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import zhCn from 'element-plus/es/locale/lang/zh-cn'

import App from './App.vue'
import router from './router'
import { registerPermissionDirective } from './directives/permission'
import './styles/design-tokens.css'
import './styles/global.scss'
import './styles/element-overrides.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(ElementPlus, { locale: zhCn })

registerPermissionDirective(app)

app.mount('#app')
