# game-db
A public database of video games

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
To add or modify data in this database you can run the web interface locally by running the following commands:

   npm update
   node .

This will read the following environment variables `IP` and `PORT`.  If you don't have these defined you can create a file in your project called `.env` with these values (for `localhost` and port `3000`):

   PORT=3000
   IP=0.0.0.0

## Preparing a commit with updated information
However you add new information, in order to cut down on git commit noise you should run the `optimize.js` script.  This will clean up any changed files and make sure that any new information is denormailzed and consistent across all files.  To optimize the database simply run this command:

   node optimize.js

## Motivations for building this
I realized while building my third website that involves video games that I was building the same database again and again.  This project is an attempt to gather all of this data together and produce something that could help others.  The information that I needed to build my applications builds on top of this data, but it is sparse.  My hope is that people who have thier own uses cases (a mobile app that mananages)
