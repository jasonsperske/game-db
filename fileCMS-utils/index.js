'use strict';

const fs = require('fs');
const path = require('path');
const sanitizeFilename = require('sanitize-filename');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const ordinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

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

const safeJoin = (basePath, ...segments) => {
  const cleaned = segments.flatMap((seg) =>
    String(seg).split('/').filter(Boolean).map(sanitizeFilename)
  );
  const target = path.join(basePath, ...cleaned);
  if (!target.startsWith(basePath + path.sep) && target !== basePath) {
    throw new Error(`path traversal blocked: ${segments.join('/')}`);
  }
  return target;
};

module.exports = (basePath) => {
  const contentRoot = path.join(basePath, 'content');

  return {
    releasedOn: (released) => {
      if (!released) return '-?-';
      const { year, month, day } = released;
      if (year && month && day) {
        return `${MONTHS[month - 1]} ${ordinal(day)} ${year}`;
      }
      if (year && month) {
        return `${MONTHS[month - 1]} ${year}`;
      }
      if (year) return String(year);
      return '-?-';
    },

    read: (base, filename) => {
      try {
        const target = safeJoin(contentRoot, base, filename);
        const raw = fs.readFileSync(target, 'utf8');
        return JSON.parse(raw);
      } catch (e) {
        console.error(e);
        return {};
      }
    },

    save: (base, filename, data) => {
      const dir = safeJoin(contentRoot, base);
      fs.mkdirSync(dir, { recursive: true });
      const target = safeJoin(contentRoot, base, filename);
      fs.writeFileSync(target, JSON.stringify(sortObject(data), null, 2) + '\n');
    }
  };
};
