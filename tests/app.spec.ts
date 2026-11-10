import { test, expect, type Page } from '@playwright/test';

const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1000) < 820;

async function nav(page: Page, view: string) {
  const sel = isMobile(page) ? `.bottom-tabs [data-view=${view}]` : `.tabs [data-view=${view}]`;
  await page.locator(sel).click();
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  (page as any)._errors = errors;
  await page.goto('./#/capture');
});
test.afterEach(async ({ page }) => {
  expect((page as any)._errors).toEqual([]);
});

test('identify: tab quick input names the chord', async ({ page }) => {
  await page.getByTestId('quick-input').fill('x32010');
  await page.getByTestId('quick-input').press('Enter');
  await expect(page.getByTestId('chord-result').locator('h2')).toHaveText('C');
  await expect(page.getByTestId('scale-result')).toContainText('C Major Pentatonic');
});

test('identify: notes quick input finds a 7th chord with correct spelling', async ({ page }) => {
  await page.getByTestId('quick-input').fill('C E G Bb');
  await page.getByTestId('quick-input').press('Enter');
  await expect(page.getByTestId('chord-result').locator('h2')).toHaveText('C7');
  await expect(page.locator('.toolbar')).toContainText('B♭3');
});

test('identify: tapping the fretboard builds a chord', async ({ page }) => {
  // A minor: x02210 (string index 0 = high e)
  for (const sf of ['4:0', '3:2', '2:2', '1:1', '0:0']) await page.locator(`[data-sf="${sf}"]`).click();
  await expect(page.getByTestId('chord-result').locator('h2')).toHaveText('Am');
  await page.getByTestId('clear').click();
  await expect(page.getByTestId('chord-result')).toContainText('Tap at least two notes');
});

test('lookup: forward chord search opens detail', async ({ page }) => {
  await page.keyboard.press('/');
  await page.getByTestId('lookup-input').fill('F#m7b5');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('detail').locator('h2')).toContainText('F♯m7♭5');
  await expect(page.getByTestId('detail')).toContainText('Scales that fit');
});

test('lookup: scale search shows notes and modes', async ({ page }) => {
  await page.keyboard.press('/');
  await page.getByTestId('lookup-input').fill('D dorian');
  await page.keyboard.press('Enter');
  const d = page.getByTestId('detail');
  await expect(d.locator('h2')).toHaveText('D Dorian');
  await expect(d).toContainText('Chords in this scale');
  await expect(d).toContainText('C Major (Ionian)');
});

test('lookup: progression becomes a new song with key analysis', async ({ page }) => {
  await page.keyboard.press('/');
  await page.getByTestId('lookup-input').fill('Dm7 G7 Cmaj7');
  await page.getByRole('button', { name: 'New song' }).click();
  await expect(page.getByTestId('song-key')).toHaveText('C major');
  await expect(page.getByTestId('chord-block')).toHaveCount(3);
  await expect(page.locator('.pattern').first()).toContainText('ii–V–I');
});

test('song: add chords, select, apply an idea, persist across reload', async ({ page }) => {
  await nav(page, 'song');
  await page.getByTestId('new-song').click();
  await page.getByTestId('add-chords').first().fill('Am7 D7 Gmaj7*8');
  await page.getByTestId('add-chords').first().press('Enter');
  await expect(page.getByTestId('chord-block')).toHaveCount(3);
  await expect(page.getByTestId('song-key')).toHaveText('G major');
  await page.getByTestId('chord-block').nth(1).locator('.block-main').click();
  await page.getByTestId('apply-idea').first().click();
  const count = await page.getByTestId('chord-block').count();
  expect(count).toBeGreaterThanOrEqual(3);
  await page.waitForTimeout(400);
  await page.reload();
  await nav(page, 'song');
  await expect(page.getByTestId('chord-block')).toHaveCount(count);
});

test('song: share link round-trips the song', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  await nav(page, 'song');
  await page.locator('.library').getByText('Twelve-Bar Blues in A').click();
  await page.getByRole('button', { name: /Share link/ }).click();
  const url = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '');
  test.skip(!url, 'clipboard not available');
  expect(url).toContain('#/song?s=1.');
  const page2 = await context.newPage();
  await page2.goto(url);
  await expect(page2.getByTestId('song-title')).toHaveValue('Twelve-Bar Blues in A');
  await expect(page2.getByTestId('song-key')).toHaveText('A major');
});

test('explore: board follows the song key and sketches chords', async ({ page }) => {
  await nav(page, 'explore');
  await expect(page.locator('h1')).toContainText('major');
  await page.getByTestId('board-cell').first().click();
  await expect(page.locator('.sk')).toHaveCount(1);
});

test('solo: shows scales per chord and can break the box', async ({ page }) => {
  await nav(page, 'song');
  await page.locator('.library').getByText('Dorian Funk Vamp').click();
  await nav(page, 'solo');
  await expect(page.locator('.opt').first()).toBeVisible();
  await page.getByTestId('break-box').click();
  await expect(page.locator('.tl-scale.outside').first()).toBeVisible();
});

test('settings: depth level and tuning change', async ({ page }) => {
  await page.getByTestId('settings-btn').click();
  await page.locator('[data-level=basic]').click();
  await page.getByTestId('tuning').selectOption('Drop D');
  await expect(page.locator('[data-level=basic]')).toHaveClass(/on/);
  await page.keyboard.press('Escape');
  await page.reload();
  await page.getByTestId('settings-btn').click();
  await expect(page.locator('[data-level=basic]')).toHaveClass(/on/);
  await expect(page.getByTestId('tuning')).toHaveValue('Drop D');
});

// Frozen v1 seed (also in src/lib/song.test.ts): old share links must keep working forever.
const SEED_V1 = '1.izbUUXIryq9KzVPSsTTSMdCJjlZyVAKSBjpKSjomsTrR5jCGpY5SLoRlChGKBTKVnECKjYBS5nDlUBbQhNzELCDHAsgxAmvRMQMyzWDiJjq6QNuTlGJBAAA';
test('song: opening a v1 share link imports the song', async ({ page }) => {
  await page.goto(`./#/song?s=${SEED_V1}`);
  await expect(page.getByTestId('chord-block').first()).toBeVisible();
  await expect(page.getByTestId('song-title')).toHaveValue('Frozen');
});

test('solo: fretboard fits without horizontal scroll; preview + solo line play', async ({ page }) => {
  await nav(page, 'song');
  await page.locator('.library').getByText('Autumn-ish').click();
  await nav(page, 'solo');
  const neck = page.locator('.neck div.board');
  const overflow = await neck.evaluate(el => el.scrollWidth - el.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await page.getByTestId('hear-scale').nth(1).click();
  await expect(page.getByTestId('hear-scale').nth(1)).toHaveClass(/playing/);
  await page.getByTestId('solo-play').click();
  await page.waitForTimeout(1200);
  await expect(page.locator('.tl.cur')).toHaveCount(1);
  await page.getByTestId('solo-line').uncheck();
  await page.getByTestId('solo-play').click();
});
