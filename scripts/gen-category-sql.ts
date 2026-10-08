import { DEFAULT_CATEGORIES } from '../src/sync/defaultCategories';

const rows = DEFAULT_CATEGORIES.map(
  (c) => `    ('${c.type}', '${c.name.replace(/'/g, "''")}', '${c.icon}', '${c.color}')`,
);
console.log(rows.join(',\n'));
