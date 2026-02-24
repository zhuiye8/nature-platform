/**
 * @input createApp from vue, Pinia store, app router, and global style/theme layers
 * @output Frontend bootstrap entry that mounts SPA runtime with state and navigation plugins
 * @position Web runtime startup layer connecting app shell, routing, global theming, and state management
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
import { createApp } from "vue";
import { createPinia } from "pinia";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/element-overrides.css";
import "./styles/motion.css";
import App from "./App.vue";
import { router } from "./router";

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount("#app");