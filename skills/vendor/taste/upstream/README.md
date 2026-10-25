<p align="center">
  <img src="assets/readme-banner.webp" alt="Taste Skill - Anti-slop Agent Skills for premium frontends" width="100%" />
</p>

<p align="center" style="margin-bottom: 8px;">
  <a href="https://tasteskill.dev" title="Visit tasteskill.dev"><img src="https://img.shields.io/badge/website-tasteskill.dev-24292f?style=flat" alt="Visit tasteskill.dev" /></a>
  &nbsp;
  <a href="https://tastecode.dev" title="Visit tastecode.dev"><img src="https://img.shields.io/badge/new-TasteCode-ff6b00?style=flat" alt="New: TasteCode" /></a>
  &nbsp;
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-24292f?style=flat&amp;logo=github&amp;logoColor=white" alt="MIT License" /></a>
  &nbsp;
  <a href="https://github.com/vercel-labs/agent-skills"><img src="https://img.shields.io/badge/Agent_Skills-compatible-24292f?style=flat&amp;logo=github&amp;logoColor=white" alt="Agent Skills compatible" /></a>
  &nbsp;
  <a href="#install"><img src="https://img.shields.io/badge/Codex_%2F_Cursor_%2F_Claude-install-24292f?style=flat" alt="Codex, Cursor, Claude" /></a>
  &nbsp;
  <a href="CHANGELOG.md"><img src="https://img.shields.io/badge/changelog-view-24292f?style=flat" alt="Changelog" /></a>
</p>

<p align="center">
  <a href="https://tastecode.dev"><img src="assets/readme-tastecode.webp" alt="TasteCode is here. Taste Skill as a desktop app, with a design agent built in. Free and open source. Download at tastecode.dev" width="100%" /></a>
</p>

<p align="center"><sub>The easiest way to get Taste Skill results: <a href="https://tastecode.dev"><strong>download TasteCode</strong></a>. Its design agent briefs, builds and visually reviews your UI. <a href="https://github.com/Leonxlnx/tastecode">Source on GitHub</a>.</sub></p>

<h3 align="center">Sponsors</h3>

<table align="center">
  <tr>
    <td align="center" width="104"><a href="https://fluxionai.space/register?source=github&amp;campaign=github-tasteskill&amp;promo=TASTESKILL"><img src="assets/sponsors/sidrune-ai.png" alt="Sidrune AI" width="80" height="80" /></a></td>
    <td><sub><a href="https://fluxionai.space/register?source=github&amp;campaign=github-tasteskill&amp;promo=TASTESKILL"><strong>Sidrune AI</strong></a>: one API for GPT, Claude, and other leading AI models.<br />Sign up through this link and get $3 in API credit.</sub></td>
  </tr>
  <tr>
    <td align="center" width="104">
      <a href="https://interfaces.dev/?utm_source=tasteskill&utm_medium=sponsorship">
        <img src="assets/sponsors/interfaces-dev-icon.webp" alt="Interfaces" width="52" height="52" />
      </a>
    </td>
    <td><sub><a href="https://interfaces.dev/?utm_source=tasteskill&utm_medium=sponsorship"><strong>interfaces.dev</strong></a> · A design engineering magazine by <a href="https://github.com/jakubkrehel"><strong>Jakub Krehel</strong></a></sub></td>
  </tr>
  <tr>
    <td align="center" width="104">
      <a href="https://reactbits.dev">
        <picture>
          <source media="(prefers-color-scheme: dark)" srcset="assets/sponsors/reactbits-icon-dark.svg" />
          <img src="assets/sponsors/reactbits-icon-light.svg" alt="React Bits" width="52" height="52" />
        </picture>
      </a>
    </td>
    <td><sub><a href="https://reactbits.dev"><strong>React Bits</strong></a> · animated React components for creative interfaces</sub></td>
  </tr>
  <tr>
    <td align="center" width="104"><a href="https://img.ly/"><img src="assets/sponsors/imgly-logo.svg" alt="IMG.LY" width="52" height="52" /></a></td>
    <td><sub><a href="https://img.ly/"><strong>IMG.LY</strong></a> · CreativeEditor SDK</sub></td>
  </tr>
  <tr>
    <td align="center" width="104"><a href="https://www.sent.dm"><img src="assets/sponsors/sentdm.png" alt="Sent.dm" width="52" height="52" /></a></td>
    <td><sub><a href="https://www.sent.dm"><strong>Sent.dm</strong></a> · messaging APIs for SMS, WhatsApp, and RCS</sub></td>
  </tr>
</table>

<p align="center"><sub><a href="https://github.com/sponsors/Leonxlnx">Become a sponsor</a></sub></p>

**Taste Skill** is a set of Agent Skills that make coding agents design websites instead of assembling the average landing page. The default skill gives the agent an art direction, real pictures and a way to check its own work in a real browser.

Pages it has built, each from one brief:

<table>
  <tr>
    <td width="50%"><img src="examples/v2/coffee-storefront.webp" alt="Coffee shop page with a drawn storefront as its hero" /></td>
    <td width="50%"><img src="examples/v2/night-dates.webp" alt="Techno night page with its dates set into an archive photograph" /></td>
  </tr>
  <tr>
    <td width="50%"><img src="examples/v2/coffee-roast.webp" alt="Coffee shop page section showing the roast in four photographs" /></td>
    <td width="50%"><img src="examples/v2/coffee-questions.webp" alt="Coffee shop page questions as stacked index cards" /></td>
  </tr>
</table>

The photographs are real, found in open archives and credited by the skill ([credits](examples/v2/CREDITS.md)). Watch the [launch film](https://github.com/Leonxlnx/taste-skill/releases/tag/v2.0.0).

<p align="center"><sub><a href="#install">Install</a> · <a href="#how-v2-works">How it works</a> · <a href="#skills">Skills</a> · <a href="#common-questions">FAQ</a> · <a href="#support-the-project">Sponsors</a> · <a href="#license">License</a></sub></p>

## Install

```bash
npx skills add https://github.com/Leonxlnx/taste-skill
```

That installs every skill in this repo with the [`npx skills`](https://github.com/vercel-labs/agent-skills) CLI. To install one, pass its install name:

```bash
npx skills add https://github.com/Leonxlnx/taste-skill --skill "design-taste-frontend"
```

The default skill runs its scripts with **Node 22+** and an installed **Chrome, Edge or Chromium**. It installs nothing and needs no API keys. Finding pictures needs network access.

<details>
<summary>Claude Code plugin</summary>

Run these inside Claude Code. Every skill is namespaced under `taste-skill:`, so they do not collide with your other skills.

```
/plugin marketplace add Leonxlnx/taste-skill
/plugin install taste-skill@taste-skill
```

`/plugin update` upgrades it later.

</details>

<details>
<summary>Codex plugin</summary>

```bash
codex plugin marketplace add Leonxlnx/taste-skill
codex plugin add taste-skill@taste-skill
```

Start a new Codex session afterwards so the skills are loaded.

</details>

<details>
<summary>From a clone, linked instead of copied</summary>

`./install.sh` symlinks the skills into Claude Code (`--codex` for Codex, `--all-agents` for both), so a `git pull` updates them in place. `./install.sh --list` shows every install name.

</details>

Already have the skill? Run the install command again. The install name did not change, and the older versions stay available under their own names (see [Skills](#skills)).

## How v2 works

The default skill is built from a study of 247 curated sites. A build runs in six steps:

1. Reads the brief and lists what only this client has.
2. A script deals three of 20 researched directions and the agent picks one.
3. Finds the idea: one sentence tying the client's own material to that direction.
4. Builds with real pictures and footage from open collections, credited.
5. Checks the page in a real browser at three widths and fails it on slop.
6. Looks at its own screenshots and fixes the top three problems, up to three rounds.

A build takes roughly 30 to 45 minutes and a few hundred thousand tokens. Details are in the [changelog](CHANGELOG.md) and the [study](skills/taste-skill/references/research.md).

## Skills

Each skill does one job. You do not need all of them. The **install name** is the value you pass to `--skill`.

| Skill | Install name | What it does |
| --- | --- | --- |
| **[taste-skill](skills/taste-skill/SKILL.md)** | `design-taste-frontend` | v2. Art direction for landing pages, marketing sites, portfolios and product pages, in any stack. Works as described above. |

<details>
<summary>Skills for a specific job (8)</summary>

| Skill | Install name | What it does |
| --- | --- | --- |
| **[redesign-skill](skills/redesign-skill/SKILL.md)** | `redesign-existing-projects` | Existing projects: audit the UI first, then fix layout, spacing, hierarchy and styling. |
| **[image-to-code-skill](skills/image-to-code-skill/SKILL.md)** | `image-to-code` | Generate site references, analyse them, then build the frontend to match. |
| **[gpt-tasteskill](skills/gpt-tasteskill/SKILL.md)** | `gpt-taste` | A stricter variant for GPT and Codex: more layout variance, stronger motion direction. |
| **[soft-skill](skills/soft-skill/SKILL.md)** | `high-end-visual-design` | Calm, polished UI: soft contrast, whitespace, spring motion. |
| **[minimalist-skill](skills/minimalist-skill/SKILL.md)** | `minimalist-ui` | Editorial product UI with a restrained palette and crisp structure. |
| **[brutalist-skill](skills/brutalist-skill/SKILL.md)** | `industrial-brutalist-ui` | Hard mechanical language: Swiss type, sharp contrast, experimental layout. |
| **[stitch-skill](skills/stitch-skill/SKILL.md)** | `stitch-design-taste` | Rules for Google Stitch, with an optional `DESIGN.md` export. |
| **[output-skill](skills/output-skill/SKILL.md)** | `full-output-enforcement` | For when the model ships half-finished work: full output, no placeholder comments. |

</details>

<details>
<summary>Image generation skills (3)</summary>

These produce design images only, no code. Use them with ChatGPT Images, Codex image mode or any agent that generates images, then hand the frames to your coding agent.

| Skill | Install name | What it does |
| --- | --- | --- |
| **[imagegen-frontend-web](skills/imagegen-frontend-web/SKILL.md)** | `imagegen-frontend-web` | Website comps: hero, landing page, multi-section. |
| **[imagegen-frontend-mobile](skills/imagegen-frontend-mobile/SKILL.md)** | `imagegen-frontend-mobile` | Mobile screens and flows for iOS, Android and cross-platform. |
| **[brandkit](skills/brandkit/SKILL.md)** | `brandkit` | Brand-kit boards: logo directions, palettes, type, applications. |

</details>

### Which one should I use?

- Building a new public page: **taste-skill**.
- Improving a page that already exists: **redesign-skill**.
- The visual direction is already decided: **soft-skill**, **minimalist-skill** or **brutalist-skill**.
- You want images first, then code: an image-generation skill, or **image-to-code-skill** for the whole pipeline in one go.
- The agent keeps cutting its output short: add **output-skill**.

<details>
<summary>Older versions of taste-skill</summary>

Kept for projects that depend on their exact behaviour.

| Skill | Install name | What it is |
| --- | --- | --- |
| **[taste-skill-v2-experimental](skills/taste-skill-v2-experimental/SKILL.md)** | `design-taste-frontend-v2-experimental` | The single-file, dial-driven rewrite that was the default before v2. |
| **[taste-skill-v1](skills/taste-skill-v1/SKILL.md)** | `design-taste-frontend-v1` | The original. |

```bash
npx skills add https://github.com/Leonxlnx/taste-skill --skill "design-taste-frontend-v2-experimental"
npx skills add https://github.com/Leonxlnx/taste-skill --skill "design-taste-frontend-v1"
```

Both have three 1 to 10 dials at the top of the file: **DESIGN_VARIANCE** (centred and clean to asymmetric), **MOTION_INTENSITY** (hover only to scroll-driven) and **VISUAL_DENSITY** (spacious to dense). v2 has no dials. Its direction comes from the draw and its limits from the inspector.

</details>

## Common Questions

**What does the default skill need?**  
Node 22 or newer and Chrome, Edge or Chromium. It installs nothing and uses no API keys. It needs the internet only to find pictures.

**Where do the pictures come from, and can I use them?**  
From open collections such as Wikimedia Commons, Openverse and the Met. Only public domain, CC0, CC BY and CC BY-SA files are offered, and the skill puts the credits on the page. Replace them with your own when you have them.

**Does it work with React, Vue, Svelte, plain HTML?**  
Yes. The rules are about design, not a framework.

**Is it for dashboards and app screens?**  
No. The default skill is for public-facing pages. Use **minimalist-skill** or **soft-skill** for product UI.

## Support the project

If Taste Skill helps you, consider sponsoring:

[Sponsor on GitHub](https://github.com/sponsors/Leonxlnx)

### Open Source Supporters

<table align="center">
  <tr>
    <td align="center" width="104"><a href="https://www.kimi.com"><img src="assets/sponsors/kimi-icon.png" alt="Kimi" width="52" height="52" /></a></td>
    <td><a href="https://www.kimi.com"><picture><source media="(prefers-color-scheme: dark)" srcset="https://kimi-file.moonshot.cn/prod-chat-kimi/kfs/4/1/2026-06-05/1d8h69mt3v89kkekg24gg" /><img alt="Kimi Open Source Friends" src="https://kimi-file.moonshot.cn/prod-chat-kimi/kfs/4/1/2026-06-05/1d8h69fudcmosb3pipls0" height="42" /></picture></a><br /><sub><a href="https://platform.kimi.ai?track_id=track-20f0d64bcaba419bb425a3e8c306f65d&aff=taste-skill"><strong>Get a Kimi API key</strong></a>: taste-skill users get 10% bonus API credits on their first purchase.</sub></td>
  </tr>
  <tr>
    <td align="center" width="104"><a href="https://vercel.com/open-source-program"><img src="assets/sponsors/vercel-logo.svg" alt="Vercel" width="52" height="52" /></a></td>
    <td><a href="https://vercel.com/open-source-program"><img src="assets/vercel-oss-program-badge.svg" alt="Vercel Open Source Program" height="28" /></a></td>
  </tr>
</table>

<details>
<summary>Community sponsors</summary>

<a href="https://github.com/dnakov"><img src="https://github.com/dnakov.png" width="40" height="40" style="border-radius:50%" alt="dnakov" title="dnakov" /></a>
<a href="https://github.com/AkramReshad"><img src="https://github.com/AkramReshad.png" width="40" height="40" style="border-radius:50%" alt="AkramReshad" title="AkramReshad" /></a>
<a href="https://github.com/ajmalaksar25"><img src="https://github.com/ajmalaksar25.png" width="40" height="40" style="border-radius:50%" alt="ajmalaksar25" title="ajmalaksar25" /></a>
<a href="https://github.com/krikkkk"><img src="https://github.com/krikkkk.png" width="40" height="40" style="border-radius:50%" alt="krikkkk" title="krikkkk" /></a>
<a href="https://github.com/navanchauhan"><img src="https://github.com/navanchauhan.png" width="40" height="40" style="border-radius:50%" alt="navanchauhan" title="navanchauhan" /></a>
<a href="https://github.com/robinebers"><img src="https://github.com/robinebers.png" width="40" height="40" style="border-radius:50%" alt="robinebers" title="robinebers" /></a>
<a href="https://github.com/JKc66"><img src="https://github.com/JKc66.png" width="40" height="40" style="border-radius:50%" alt="JKc66" title="JKc66" /></a>
<a href="https://github.com/u2393696078-rgb"><img src="https://github.com/u2393696078-rgb.png" width="40" height="40" style="border-radius:50%" alt="u2393696078-rgb" title="u2393696078-rgb" /></a>
<a href="https://github.com/a-human-created-this"><img src="https://github.com/a-human-created-this.png" width="40" height="40" style="border-radius:50%" alt="a-human-created-this" title="a-human-created-this" /></a>
<a href="https://github.com/AtharvaJaiswal005"><img src="https://github.com/AtharvaJaiswal005.png" width="40" height="40" style="border-radius:50%" alt="AtharvaJaiswal005" title="AtharvaJaiswal005" /></a>
<a href="https://github.com/ghughes7"><img src="https://github.com/ghughes7.png" width="40" height="40" style="border-radius:50%" alt="ghughes7" title="ghughes7" /></a>
<a href="https://github.com/mccun934"><img src="https://github.com/mccun934.png" width="40" height="40" style="border-radius:50%" alt="mccun934" title="mccun934" /></a>
<a href="https://github.com/techmedic5"><img src="https://github.com/techmedic5.png" width="40" height="40" style="border-radius:50%" alt="techmedic5" title="techmedic5" /></a>
<a href="https://github.com/bytewerk-dev"><img src="https://github.com/bytewerk-dev.png" width="40" height="40" style="border-radius:50%" alt="bytewerk-dev" title="bytewerk-dev" /></a>
<a href="https://github.com/LuisGot"><img src="https://github.com/LuisGot.png" width="40" height="40" style="border-radius:50%" alt="LuisGot" title="LuisGot" /></a>
<a href="https://github.com/oskar-collab"><img src="https://github.com/oskar-collab.png" width="40" height="40" style="border-radius:50%" alt="oskar-collab" title="oskar-collab" /></a>
<a href="https://github.com/denvit"><img src="https://github.com/denvit.png" width="40" height="40" style="border-radius:50%" alt="denvit" title="denvit" /></a>
<a href="https://github.com/onedollarstock"><img src="https://github.com/onedollarstock.png" width="40" height="40" style="border-radius:50%" alt="onedollarstock" title="onedollarstock" /></a>
<a href="https://github.com/KANA-33"><img src="https://github.com/KANA-33.png" width="40" height="40" style="border-radius:50%" alt="KANA-33" title="KANA-33" /></a>
<a href="https://github.com/emilkowalski"><img src="https://github.com/emilkowalski.png" width="40" height="40" style="border-radius:50%" alt="emilkowalski" title="emilkowalski" /></a>
<a href="https://github.com/AnthonyLiuVa"><img src="https://github.com/AnthonyLiuVa.png" width="40" height="40" style="border-radius:50%" alt="AnthonyLiuVa" title="AnthonyLiuVa" /></a>
<a href="https://github.com/Wolfy18"><img src="https://github.com/Wolfy18.png" width="40" height="40" style="border-radius:50%" alt="Wolfy18" title="Wolfy18" /></a>

<p align="center">
 <a href="https://www.star-history.com/leonxlnx/taste-skill">
  <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/badge?repo=Leonxlnx/taste-skill&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/badge?repo=Leonxlnx/taste-skill" />
   <img alt="Star History Rank" src="https://api.star-history.com/badge?repo=Leonxlnx/taste-skill" />
  </picture>
 </a>
</p>

</details>

<sub>Feedback: open an issue or pull request, DM [@lexnlin](https://x.com/lexnlin) or [@blueemi99](https://x.com/blueemi99), or email [hello@tasteskill.dev](mailto:hello@tasteskill.dev).</sub>

<sub>Taste Skill has no official token, coin, or crypto project. Any token using my name, image, or project is unaffiliated and not endorsed by me.</sub>

## License

[MIT License](LICENSE) · Copyright (c) 2026 Leonxlnx
