# game-db
A public database of video games, plus a small Node/Express app for browsing and editing it.

## What this system can do
- **Browse the catalog** by company → platform → region → game, or by publisher, with every page generated from JSON in `content/`.
- **Search across platforms live** from the home page (NES, SNES, Genesis, TG16 today) with highlighted matches and per-platform grouping.
- **Sort any table** in the UI by clicking column headers (game name, release date, publisher, developers).
- **Cross-reference publishers** — opening a publisher rolls up every game they shipped across all platforms.
- **Edit games in the browser** when running in dev mode (`NODE_ENV=development`). Each game gets an edit form that writes back to the per-game `index.json` and updates the region index in one shot.
- **Round-trip the catalog through spreadsheets**: each region lives as `data/platforms/<company>/<platform>/<region>.xlsx`, editable in any spreadsheet tool, then synced back into the JSON content with `npm run import`. `npm run export` regenerates the xlsx files from JSON.
- **Keep data normalized automatically** — `npm run optimize` walks every game record and ensures the indexes, publishers, and developers stay consistent, cutting commit noise.
- **Deploy under a sub-path** (e.g. `https://example.com/games/`) by setting `BASE_URL`; all in-app links and asset URLs are rewritten relative to that prefix.
- **Stable joining key** — every game has a `guid` other projects can use as a foreign key when extending the schema.

## Scope of this project
This is a database of all released games for all consoles starting with the Magnavox Odyssey up to the Playstation 4.  The purpose is to build a definitive and accessible set of lists that can function as a collection database or the starting point for some web service.  Included in the base schema is the following fields:

    id
    platform
    region
    name
    released
    publisher
    developers

For projects that need to extend this schema the id can act as a joining foreign key.  The fields included are intended to make sorting and organizing games easy.  There are many other dimensions that a game can be organized by but these dimensions make less sense in terms or sorting or organizing.  This schema is however arbitrary and if other projects fork off of this and build up substantial data it is conceivable that they can be merged into this project or even grow to replace this project.

The primary concept that defines a record is the first release of a physical game.  This definition includes games that where only rarely released (such as the Nintendo World Championships 1990 Gold Cart) as well as games where many subsequent releases where made (Revenge of Shinobi for the Sega Genesis).  For games that where not officially released (such as prototypes or the Nintendo World Championships 1990 Grey Cart) the database will organize these into "prototype" or "unreleased" lists.  This is an area where is bound to be disagreements but the nature of `git` allows anyone to make different determinations.

With regard to collections, anthologies and emulated releases such as the Virtual Console, this is a hard area to get totally right.  While this database is being built out we should focus on the original releases and build out releases later as the core data stabilizes.

## Running the Content Management System
Requires Node.js 18 or later.  Install dependencies and start the server:

    npm install
    npm start

The server reads `IP`, `PORT`, and (optionally) `BASE_URL` from the environment.  If you don't have these defined you can create a `.env` file in the project root (which `dotenv` will load):

    PORT=3000
    IP=0.0.0.0

To install the app under a sub-path on a server (e.g. `https://example.com/games/`), set `BASE_URL` to the path prefix:

    BASE_URL=/games

When `BASE_URL` is unset the app serves from `/`.  All in-app links and asset URLs are generated relative to this prefix.

For local development with auto-restart on file changes:

    npm run dev

## Editing the catalog as spreadsheets
The xlsx files under `data/platforms/<company>/<platform>/<region>.xlsx` are the editable source of truth for each region's catalog.  Edit them in any spreadsheet tool, then sync the JSON content with:

    npm run import

To regenerate the xlsx files from the JSON content (e.g. after pulling new data, or to bootstrap on a fresh checkout):

    npm run export

Both scripts use the columns: `guid`, `name`, `publisher`, `released_year`, `released_month`, `released_day`, `developers` (semicolon-separated guids).  The folder layout under `data/` mirrors `content/platforms/`.

## Preparing a commit with updated information
However you add new information, in order to cut down on git commit noise you should run the optimize script.  This will clean up any changed files and make sure that any new information is denormalized and consistent across all files:

    npm run optimize

## Motivations for building this
I realized while building my third website that involves video games that I was building the same database again and again.  This project is an attempt to gather all of this data together and produce something that could help others.  The information that I needed to build my applications builds on top of this data, but it is sparse.  My hope is that people who have thier own uses cases (a mobile app that mananages)
