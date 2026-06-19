const items = require('../project-items.json').items;
items.forEach((i) => {
  if (i.content && i.content.number !== undefined) {
    console.log(
      `#${i.content.number}: ${i.content.title} | id: ${i.id} | status: ${i.status}`
    );
  }
});
