'use strict';

const fs = require('fs');
const path = require('path');

const sortObject = (value) => {
  if (Array.isArray(value) || value === null || typeof value !== 'object') {
    return value;
  }
  const sorted = {};
  for (const key of Object.keys(value).sort()) {
    sorted[key] = sortObject(value[key]);
  }
  return sorted;
};

const contentPath = (...parts) => path.join(__dirname, 'content', ...parts);

const read = (base) => {
  const target = contentPath(base, 'index.json');
  try {
    return JSON.parse(fs.readFileSync(target, 'utf8'));
  } catch (e) {
    if (e.code !== 'ENOENT') console.error(`Failed to read ${target}:`, e.message);
    return {};
  }
};

const save = (base, data) => {
  const dir = contentPath(base);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    contentPath(base, 'index.json'),
    JSON.stringify(sortObject(data), null, 2) + '\n'
  );
};

// The game record is the only authoritative record for all information.
// To keep this database organized, this script walks every game list and
// makes sure that the index, publishers, and developers stay in sync, and
// that every JSON file is valid and consistently formatted.

const hasPublisher = (game) => typeof game.publisher === 'string' && game.publisher !== '';
const hasDevelopers = (game) => Array.isArray(game.developers) && game.developers.length > 0;
const isIncomplete = (game) => !hasPublisher(game) && !hasDevelopers(game);

const incomplete = [];

const root = read('platforms');

Object.keys(root.companies || {}).forEach((companyKey) => {
  const company = read(`platforms/${companyKey}`);
  Object.keys(company.platforms || {}).forEach((platformKey) => {
    const platform = read(`platforms/${company.guid}/${platformKey}`);
    Object.keys(platform.regions || {}).forEach((regionKey) => {
      const region = read(`platforms/${company.guid}/${platform.guid}/${regionKey}`);
      Object.keys(region.games || {}).forEach((guid) => {
        const game = read(`platforms/${company.guid}/${platform.guid}/${region.guid}/${guid}`);
        const platformPath = `${company.guid}/${platform.guid}/${region.guid}`;

        if (isIncomplete(game)) {
          incomplete.push(`${platformPath}/${guid}`);
        }

        if (game.publisher) {
          const publisher = read(`publishers/${game.publisher}`);
          if (Array.isArray(publisher.platforms)) {
            if (!publisher.platforms.includes(platformPath)) {
              publisher.platforms.push(platformPath);
            }
          } else {
            publisher.platforms = [platformPath];
          }
          save(`publishers/${game.publisher}`, publisher);
        }
        save(`platforms/${platformPath}/${guid}`, game);
        console.log(company.guid, '>', platform.guid, '>', region.guid, '>', game.name);
      });
    });
  });
});

console.log('');
if (incomplete.length) {
  console.log(`Games with no publisher and no developers (${incomplete.length}):`);
  for (const gamePath of incomplete) {
    console.log(`  ${gamePath}`);
  }
} else {
  console.log('All games have at least a publisher or a developer.');
}
