# @dumbshow/vue

The Vue editor for [dumbshow](https://github.com/avihut/dumbshow), the
semantic-animation composer: `ComposerApp` — timeline, catalog, canvas,
shell, attributes, exports — and the `AttributesForm` pane a pack's own
inspector composes. Everything that is not Vue lives in `@dumbshow/core`,
a peer of this package; mount the editor with a language pack:

```ts
import { ComposerApp } from "@dumbshow/vue";
import "@dumbshow/core/style.css";

createApp(ComposerApp, { lang: MY_PACK, inspector: MyInspector }).mount("#app");
```

Licensed [FSL-1.1-MIT](./LICENSE.md). Documentation, the reference pack, and
the contribution rules live in the repository.
