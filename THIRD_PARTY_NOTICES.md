# Third-party notices

## OJO Design Skills

This repository redistributes `app-ui-ux-best-practices/SKILL.md` and its nine reference documents from [touchine-ojo/OJO-Design-Skills](https://github.com/touchine-ojo/OJO-Design-Skills), revision `fbd2c2d158e5ebda8930f4bc63ed635a8500d31f`.

Copyright (c) 2026 touchine-ojo. Licensed under the MIT License. The full original license is preserved at [skills/vendor/ojo/upstream/LICENSE](skills/vendor/ojo/upstream/LICENSE).

The upstream files are unmodified. Harness-specific integration instructions are maintained separately in [ADAPTER.md](skills/vendor/ojo/ADAPTER.md). File provenance is recorded in [source.json](skills/vendor/ojo/source.json).

## Taste design guidance

Pinned source from [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) is preserved in two separate snapshots:

- [Taste snapshot](skills/vendor/taste/source.json), revision `a60a36dc2bb3bb77ccf17f2f62041f5ca8a458b9`: [MIT License](skills/vendor/taste/upstream/LICENSE).
- [Taste v2 snapshot](skills/vendor/taste-v2/source.json), revision `6010f91a9935f1c167dfc500fb1a475681892e6b`: [MIT License](skills/vendor/taste-v2/upstream/LICENSE).

Copyright (c) 2026 Leonxlnx. Complete source inventories, original resources and licenses remain with their snapshots. Harness adapters are separate from the upstream files.

## Impeccable

Pinned source from [pbakaus/impeccable](https://github.com/pbakaus/impeccable), revision `2f98774f86bc05563876643db37e6c37c322850f`, is preserved under `skills/vendor/impeccable/`. The [Apache License 2.0](skills/vendor/impeccable/upstream/LICENSE) and [upstream third-party notices](skills/vendor/impeccable/upstream/NOTICE.md) apply. The full inventory is recorded in [source.json](skills/vendor/impeccable/source.json).

## Local design documentation skills

The bundled design-md and frontend-design skills retain their original MIT licenses, copyright (c) 2026 Jordan Gilliam:

- [.agents/skills/design-md/LICENSE.md](.agents/skills/design-md/LICENSE.md)
- [.agents/skills/frontend-design/LICENSE.md](.agents/skills/frontend-design/LICENSE.md)

## Cowart annotation integration

The Cowart annotation integration in `apps/designer/cowart/` retains its [MIT copyright and license notice](apps/designer/cowart/LICENSE.Cowart), copyright (c) 2026 Twox. This integration does not change the license of its underlying dependencies.

## tldraw dependency

The workbench depends on `tldraw` 5.1.1. It is governed by the [tldraw license for that version](https://github.com/tldraw/tldraw/blob/v5.1.1/LICENSE.md), rather than by the licenses of the Cowart integration or other bundled guidance. That license distinguishes development and production use; production use requires the applicable permission or agreement. The application reads `VITE_TLDRAW_LICENSE_KEY` when a key has been obtained. Do not infer a production license from this repository's availability.

Other installed dependencies retain their own license terms. This notice identifies bundled source and the canvas dependency; it is not a grant of a project-wide license or a complete license inventory of every transitive dependency.
