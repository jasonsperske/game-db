# game-db
A public database of video games, published as a static website plus versioned JSON/CSV/XLSX data files that you can use in your own app.

## What this project provides
- **A browsable site**: company → platform → region → game, plus publisher and developer pages, live search, and sortable, filterable tables. It's built with [Astro](https://astro.build) as plain static files.
- **Data files for developers** under `/data/v1/`: the whole catalog as `games.json` / `games.csv`, per-region JSON/CSV/XLSX, per-game JSON, publisher and developer indexes, a manifest, and JSON Schemas. See the site's **Data & API** page (`/data/`) for details.
- **A stable key for every game**: `id` = `<company>/<platform>/<region>/<guid>`, for example `Nintendo/NES/us/Mega_Man`. Use it as a foreign key in your own collection tables. If an id ever changes, the old one is listed in `/data/v1/aliases.json` and the old page URL redirects.
- **Tooling that keeps the data consistent**: `optimize` normalizes records and rebuilds every derived index, and `validate` checks the schema, references and dates. CI runs both on every push and pull request.

## Scope of this project
This is a database of all released games for all consoles, from the Magnavox Odyssey up to the PlayStation 4. The purpose is to build a definitive and accessible set of lists that can work as a collection database or as the starting point for a web service.

Coverage today: North American releases for the NES, SNES, Genesis and TurboGrafx-16 (2,198 games).

The primary concept that defines a record is the first release of a physical game. This includes games that were only rarely released (such as the Nintendo World Championships 1990 Gold Cart) as well as games that had many later releases (Revenge of Shinobi for the Sega Genesis). Games that were not officially released (prototypes, or the Nintendo World Championships 1990 Grey Cart) will be organized into "prototype" or "unreleased" lists. This area is bound to have disagreements, but git lets anyone make different determinations.

Collections, anthologies and emulated releases such as the Virtual Console are hard to get right. While the database is being built out, the focus is on original releases; re-releases come later, once the core data stabilizes.

## Data model
The JSON under `content/` is the **only source of truth**:

| File | Contents | Edited by |
|---|---|---|
| `content/platforms/<company>/<platform>/<region>/<guid>/index.json` | One game record | hand / `npm run import` |
| `content/platforms/<company>/index.json`, `.../<platform>/index.json`, `.../<region>/index.json` | `name` of the company / platform / region | hand (child maps are derived) |
| `content/publishers/index.json`, `content/developers/index.json` | `guid → { name }` | hand |
| `content/_config/aliases.json` | Retired guids → replacements | hand |
| region `games` maps, `content/publishers/<guid>/index.json` | Derived indexes | `npm run optimize` only |

A game record:

```json
{
  "guid": "Mega_Man",
  "name": "Mega Man",
  "publisher": "Capcom",
  "developers": ["Capcom"],
  "released": { "year": 1987, "month": 12, "sortable": "1987-12-01" }
}
```

`publisher` and `developers` are guids from the name indexes. `guid` must match the folder name and use ASCII letters, digits and `._~!$&'()+,;=@-` only. The formal schemas are in `schema/`. Extra fields are allowed and are preserved by every tool, so a fork can extend the schema and use the `id` as its joining key.

To rename or merge a game, publisher or developer, add the old guid to `content/_config/aliases.json` and run `npm run optimize`. It moves folders and rewrites references, and validation then rejects the old guid. Only use aliases for spelling or encoding variants of the *same* entity. Rebrands and subsidiaries (Virgin Games vs Virgin Interactive) stay separate.

## Working on the catalog
Requires Node.js 26 (the current LTS) or later. With nvm, run `nvm use` to pick up the version in `.nvmrc`.

    npm install
    npm run dev        # site at http://localhost:4321 with live reload

Before committing any data change:

    npm run optimize   # normalize records and rebuild derived indexes
    npm run validate   # schema, references, dates; add --verbose to list warnings

`npm run check` runs both in check-only mode, the same way CI does.

### Editing as spreadsheets
    npm run export     # writes data/platforms/<company>/<platform>/<region>.xlsx (not committed)
    # ...edit in any spreadsheet tool...
    npm run import     # applies the sheets to content/
    npm run optimize && npm run validate

The sheet owns the `name`, `publisher`, `released_*` and `developers` columns (developers are separated by `;`), and an empty cell clears that field. New guids create new games. Rows missing from the sheet are reported, never deleted. The same xlsx files can be downloaded from each region page on the site, so contributors can send edits back.

## Building and deploying the site
    npm run build      # static site + data files in dist/
    npm run preview

- `BASE_URL=/games` serves the site under a sub-path.
- `SITE_URL=https://example.com` makes the links in `/data/v1/index.json` absolute.

The included GitHub Actions workflow validates every push and pull request. On pushes to `master` it also deploys to GitHub Pages (one-time setup: Settings → Pages → Source: GitHub Actions). Any static host works. Serve `dist/` with `Access-Control-Allow-Origin: *` if other sites will fetch the data from the browser (GitHub Pages already does this).

## License
- **Data** (`content/` and every file generated from it, including `/data/v1/`): [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/), a public domain dedication. Use it for anything, commercial or not, with no attribution required. See [`content/LICENSE`](content/LICENSE).
- **Code** (site, scripts, schemas): [MIT](LICENSE).

By contributing data you agree to release it under CC0. Before November 2026 the whole repository was GPL-3.0.

## Motivations for building this
I realized while building my third website that involves video games that I was building the same database again and again. This project is an attempt to gather all of this data together and produce something that could help others. The information that I needed to build my applications builds on top of this data, but it is sparse. My hope is that people who have their own use cases (a mobile app that manages a collection, for example) can start from this data, extend it, and contribute back.
