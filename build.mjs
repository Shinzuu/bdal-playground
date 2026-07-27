// Inlines src/ files into a single self-contained index.html. No dependencies.
import { readFileSync, writeFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

let html = read('./src/template.html');
const parts = {
  '/*INLINE:STYLE*/': read('./src/style.css'),
  '/*INLINE:ENGINE*/': read('./src/engine.js'),
  '/*INLINE:LESSONS*/': read('./src/lessons.js'),
  '/*INLINE:APP*/': read('./src/app.js'),
};

for (const [marker, content] of Object.entries(parts)) {
  if (!html.includes(marker)) {
    console.error(`build: marker ${marker} missing from template`);
    process.exit(1);
  }
  // safety: inline <script> content must not contain a closing script tag
  if (marker !== '/*INLINE:STYLE*/' && content.includes('</script>')) {
    console.error(`build: ${marker} content contains </script>`);
    process.exit(1);
  }
  html = html.replace(marker, content);
}

writeFileSync(new URL('./index.html', import.meta.url), html);
console.log(`build: index.html written (${(html.length / 1024).toFixed(1)} KB)`);
