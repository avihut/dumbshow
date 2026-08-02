/**
 * @avihut/dumbshow — public entry.
 *
 * The machinery arrives with the extraction from the daft documentation
 * composer (engine, render core, language contract, editor, viewers,
 * exports). Until then this entry declares the surface so the harness and
 * downstream wiring have a stable import target:
 *
 * - the engine: compile, createPlayer, observeVisibility, and their types
 * - the render core: the replay cursor, camera/view math, canvas attachment
 * - the language contract: DiagramLanguage and every hook shape a pack
 *   implements
 * - the editor: the composer app component and its document model
 * - exports: the offline renderer and encoders
 */

export const VERSION = "0.0.0";
