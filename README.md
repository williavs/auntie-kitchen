# Auntie Kitchen

A home-kitchen Indian recipe book, and a small app to cook from it. Not restaurant curry, not blog recipes:
the way an auntie actually cooks it, with the cues she watches for instead of timers.

- `recipes/`: the shared book. One dish (or one meal) per file. **Contributions welcome.**
- `app/`: a Next.js site that renders the recipes, your pantry and your cook log, phone and tablet friendly.
- `CLAUDE.md`: the brief for an AI cooking coach (Claude Code or any agent) that writes and refines recipes with you.
- `pantry.md`, `cook-log.md`: your kitchen. They start empty here.

## Add a recipe to the book

You don't need git. See [CONTRIBUTING.md](CONTRIBUTING.md): click "Add file" in `recipes/`, paste the template,
fill it in, and open a pull request.

## Run your own kitchen

1. Fork this repo (or "Use this template"), then clone it.
2. Fill in the Household section of `CLAUDE.md` and list what's in `pantry.md`.
3. `cd app && npm ci && npm run dev`, then open http://localhost:3000.
4. Open the repo in Claude Code and ask it what to cook tonight. It reads your pantry and cook log.

Got a good recipe in your fork? Send it back to the book with a pull request.

## Get new recipes

New recipes land in the book here; your fork pulls them in without touching your pantry or cook log.

- On GitHub: open your fork and click **Sync fork → Update branch**.
- From a clone: `git pull https://github.com/williavs/auntie-kitchen.git main`

Your `pantry.md`, `cook-log.md` and `CLAUDE.md` are yours. The book never changes them after you fork, so syncing
only brings in recipes and app updates.
