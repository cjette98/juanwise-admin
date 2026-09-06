import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const screen = readFileSync(new URL('./jigsaw-screen.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../../index.css', import.meta.url), 'utf8');

test('uses a level-focused activity workspace with a persistent editor', () => {
  assert.match(screen, /className="jigsaw-levels"/);
  assert.match(screen, /className="jigsaw-activity-grid"/);
  assert.match(screen, /className="jigsaw-workspace__editor"/);
  assert.match(screen, /of 30 activities ready/);
  assert.match(styles, /\.jigsaw-workspace\s*\{/);
  assert.match(styles, /\.jigsaw-activity-card\s*\{/);
});
