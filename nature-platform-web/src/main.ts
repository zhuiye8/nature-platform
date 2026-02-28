/**
 * @input createApp from vue, Pinia store, Element Plus zh-CN locale plus message/message-box/notification styles, dayjs locale, app router, and global style/theme layers
 * @output Frontend bootstrap entry that mounts SPA runtime with Chinese UI locale, service-component styles, and state/navigation/permission plugins
 * @position Web runtime startup layer connecting app shell, locale policy, service popups styling, routing, resource-aware permission directives, and global theme/state setup
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
import { createApp } from "vue";
import { createPinia } from "pinia";
import ElementPlus from "element-plus";
import zhCn from "element-plus/es/locale/lang/zh-cn";
import "element-plus/es/components/message/style/css";
import "element-plus/es/components/message-box/style/css";
import "element-plus/es/components/notification/style/css";
import dayjs from "dayjs";
import "dayjs/locale/zh-cn";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/element-overrides.css";
import "./styles/motion.css";
import App from "./App.vue";
import { router } from "./router";
import { permissionDirective, resourceDirective } from "./permission";

dayjs.locale("zh-cn");

const app = createApp(App);
app.use(createPinia());
app.use(ElementPlus, {
  locale: zhCn
});
app.use(router);
app.directive("permission", permissionDirective);
app.directive("resource", resourceDirective);
app.mount("#app");
