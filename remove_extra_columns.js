const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'frontend/src/routes/Home/components/Tabs/WatchTablePanel.tsx');
let content = fs.readFileSync(file, 'utf8');

// The regex matches everything from { title: 'Last Update' to the end of the columns array.
const regex = /\{\s*title:\s*'Last Update',[\s\S]*?\}\s*\]/;
content = content.replace(regex, `]`);

fs.writeFileSync(file, content, 'utf8');
console.log('Removed Last Update and Actions cleanly');
