'use strict';

const fs = require('fs'),
      path = require('path'),
      mkdirp = require('mkdirp'),
      moment = require('moment'),
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
      };

module.exports = function(base_path) {
  return {
    releasedOn: (released) => {
      if(released.year && released.month && released.day) {
        return moment([released.year, released.month-1, released.day]).format('MMM Do YYYY');
      } else if(released.year && released.month) {
        return moment([released.year, released.month-1, 1]).format('MMM YYYY');
      } else if(released.year) {
        return released.year;
      } else {
        return '-?-';
      }
    },
    read: (base, module) => {
      try {
        fs.accessSync(path.join(base_path, 'content', base, module), fs.R_OK | fs.W_OK);
        delete require.cache[require.resolve(base_path+'/content/'+base+'/'+module)];
        return require(base_path+'/content/'+base+'/'+module);
      } catch(e) {
        console.log(e);
        return {};
      }
    },
    save: (base, filename, data) => {
      mkdirp.sync(path.join(base_path, 'content', base));
      fs.writeFileSync(path.join(base_path, 'content', base, filename), JSON.stringify(sort(data), null, 2)+'\n');
    }
  };
};
