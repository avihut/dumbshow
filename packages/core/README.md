# @dumbshow/core

The framework-free half of [dumbshow](https://github.com/avihut/dumbshow),
the semantic-animation composer: the `DiagramLanguage` contract a language
pack implements, the timeline compiler and headless event-sourced player,
the render core (replay cursor, camera math, canvas attachment), the
transcript projection, the editor's document model (documents, derive,
mutations, persistence, vocabulary, drag mechanics), and the exporters
(offline renderer, PNG/GIF/webm encoders, compiled scripts).

The editor UI ships separately per framework — `@dumbshow/vue` today — and
the editor chrome stylesheet ships from here:

```ts
import { compile, createPlayer, type DiagramLanguage } from "@dumbshow/core";
import "@dumbshow/core/style.css";
```

Licensed [FSL-1.1-MIT](./LICENSE.md). Documentation, the reference pack, and
the contribution rules live in the repository.
