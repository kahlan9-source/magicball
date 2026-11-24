import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Keep the shipped app dependency-free, without requiring a Node package file.
const source = await readFile(new URL('../oracle-core.js', import.meta.url), 'utf8');
const { answers, rareAnswers, pickAnswer, createShakeDetector } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const linear = value => ({ acceleration: { x: value, y: 0, z: 0 } });
const gravity = (x, y, z) => ({ accelerationIncludingGravity: { x, y, z } });

test('all original 30 jokes and 3 rare answers remain available', () => {
  assert.equal(answers.length, 30);
  assert.equal(rareAnswers.length, 3);
  assert.equal(new Set([...answers, ...rareAnswers]).size, 33);
  assert.ok(answers.includes('Astraia a encore planté'));
  assert.ok(answers.includes('Félicitations, spécialiste !'));
});

test('rare selection has the exact 5% boundary', () => {
  for (const [chance, expected] of [[0, true], [0.049999, true], [0.05, false], [0.9999, false]]) {
    let count = 0;
    const result = pickAnswer('', () => count++ === 0 ? chance : 0);
    assert.equal(result.rare, expected);
    assert.ok((expected ? rareAnswers : answers).includes(result.text));
  }
});

test('every answer is reachable, and immediate repeats are excluded in either pool', () => {
  for (const [pool, chance] of [[answers, 0.5], [rareAnswers, 0.01]]) {
    pool.forEach((text, index) => {
      let count = 0;
      assert.equal(pickAnswer('', () => count++ === 0 ? chance : (index + 0.1) / pool.length).text, text);
      count = 0;
      assert.notEqual(pickAnswer(text, () => count++ === 0 ? chance : 0).text, text);
    });
  }
});

test('stationary gravity in any orientation and missing sensor data do not shake', () => {
  const detector = createShakeDetector();
  [gravity(0, 0, 9.81), gravity(9.81, 0, 0), gravity(0, -9.81, 0),
    { acceleration: { x: null, y: null, z: null } }, {}, linear(NaN)]
    .forEach((event, index) => assert.equal(detector.push(event, index * 200), false));
});

test('one jolt or sustained acceleration is not a deliberate shake', () => {
  const detector = createShakeDetector();
  assert.equal(detector.push(linear(15), 0), false);
  assert.equal(detector.push(linear(17), 200), false);
  assert.equal(detector.push(linear(0), 400), false);
  assert.equal(detector.push(linear(15), 1500), false);
});

test('two separated peaks trigger exactly once with cooldown', () => {
  const detector = createShakeDetector();
  assert.equal(detector.push(linear(14), 0), false);
  assert.equal(detector.push(linear(0), 100), false);
  assert.equal(detector.push(linear(-14), 240), true);
  assert.equal(detector.push(linear(0), 350), false);
  assert.equal(detector.push(linear(14), 500), false);
  assert.equal(detector.push(linear(0), 600), false);
  assert.equal(detector.push(linear(-14), 740), false);
  assert.equal(detector.push(linear(0), 2000), false);
  assert.equal(detector.push(linear(14), 2100), false);
  assert.equal(detector.push(linear(0), 2200), false);
  assert.equal(detector.push(linear(-14), 2350), true);
});

test('including-gravity fallback handles deliberate peaks and resets pending gestures', () => {
  const detector = createShakeDetector();
  assert.equal(detector.push(gravity(0, 0, 25), 0), false);
  assert.equal(detector.push(gravity(0, 0, 9.81), 100), false);
  assert.equal(detector.push(gravity(0, 0, 25), 200), true);
  detector.reset();
  assert.equal(detector.push(gravity(0, 0, 25), 2400), false);
  detector.reset();
  assert.equal(detector.push(gravity(0, 0, 25), 2600), false);
});

test('high-frequency sensor noise and stale peaks do not trigger', () => {
  const detector = createShakeDetector();
  assert.equal(detector.push(linear(13), 0), false);
  assert.equal(detector.push(linear(0), 10), false);
  assert.equal(detector.push(linear(13), 20), false);
  assert.equal(detector.push(linear(0), 100), false);
  assert.equal(detector.push(linear(13), 1300), false);
});
