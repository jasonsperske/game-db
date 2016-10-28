"use strict";
const fs = require('fs'),
      path = require('path'),
      mkdirp = require('mkdirp'),
      _ = require('underscore'),
      sort = (object) => {
        //Adapted from https://zackehh.com/sorting-object-recursively-node-jsjavascript/
        let sorted = {},
            keys = _.keys(object);

        keys = _.sortBy(keys, function(key){
          return key;
        });

        _.each(keys, function(key) {
          if(typeof object[key] == 'object' && !(object[key] instanceof Array)){
            sorted[key] = sort(object[key]);
          } else {
            sorted[key] = object[key];
          }
        });

        return sorted;
      },
      read = (base) => {
        try {
          fs.accessSync(path.join(__dirname, 'content', base, 'index.json'), fs.R_OK | fs.W_OK);
          delete require.cache[require.resolve('./content/'+base+'/index.json')];
          return require('./content/'+base+'/index.json');
        } catch(e) {
          console.log(e);
          return {};
        }
      },
      save = (base, data) => {
        mkdirp(path.join(__dirname, './content/', base), (err) => {
          if (err) {
            console.error(err);
          } else {
            fs.writeFile(path.join(__dirname, './content/', base, '/index.json'), JSON.stringify(sort(data), null, 2)+'\n');
          }
        });
      };

//The game record is the only authoritate record for all information
//To keep this database organized the script will walk though each
//game list and make sure that:
// [] the index is correct
// [] the publishers list is correct
// [] the developers list is correct
// [] every JSON is valid and formatted

let root = read('platforms');
let publishers = read('publishers');

Object.keys(root.companies).forEach((company) => {
  company = read(`platforms/${company}`);
  Object.keys(company.platforms).forEach((platform) => {
    platform = read(`platforms/${company.guid}/${platform}`);
    Object.keys(platform.regions).forEach((region) => {
      region = read(`platforms/${company.guid}/${platform.guid}/${region}`);
      Object.keys(region.games).forEach((guid) => {
        let game = read(`platforms/${company.guid}/${platform.guid}/${region.guid}/${guid}`);

        //Make sure there is a publisher profile

        let publisher = read(`publishers/${game.publisher}`);
        if(publisher.platforms) {
          if(!_.contains(publisher.platforms, `${company.guid}/${platform.guid}/${region.guid}`)) {
            publisher.platforms.push(`${company.guid}/${platform.guid}/${region.guid}`);
          }
        } else {
          publisher['platforms'] = [`${company.guid}/${platform.guid}/${region.guid}`];
        }
        save(`publishers/${game.publisher}`, publisher);
        //Check and clead
        save(`platforms/${company.guid}/${platform.guid}/${region.guid}/${guid}`, game);
        console.log(company.guid, '>', platform.guid, '>', region.guid, '>', game.name);
      });
    });
  });
});
//Now that the game list is denormalized make sure the index files for
//developers and publishers is correct
