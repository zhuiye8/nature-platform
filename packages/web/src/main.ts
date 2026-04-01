import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'

import App from './App.vue'
import router from './router'
import { registerPermissionDirective } from './directives/permission'
import './styles/design-tokens.css'
import './styles/global.scss'
import './styles/element-overrides.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(ElementPlus)

registerPermissionDirective(app)

app.mount('#app')
