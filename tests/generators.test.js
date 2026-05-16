import assert from 'node:assert/strict';
import {
  calculateStats,
  makeInequality,
  makeLinearEquation,
  makeQuestion,
  makeSystemEquation,
  normalizeAnswerForQuestion,
  parseStudentAnswer
} from '../src/generators.js';

function rngFrom(values) {
  let index = 0;
  return () => values[index++ % values.length];
}

assert.equal(parseStudentAnswer(' -3 '), -3);
assert.equal(parseStudentAnswer('1/2'), 0.5);
assert.ok(Number.isNaN(parseStudentAnswer('abc')));

const linear = makeLinearEquation(rngFrom([0.7, 0.9, 0.1, 0.4]));
assert.equal(linear.topic, 'linear');
assert.ok(linear.check(linear.answer));
assert.ok(!linear.check({ x: linear.answer.x + 1 }));

const system = makeSystemEquation(rngFrom([0.8, 0.2, 0.9, 0.1, 0.75, 0.6, 0.35, 0.25]));
assert.equal(system.topic, 'system');
assert.ok(system.check(system.answer));
assert.ok(!system.check({ x: system.answer.x, y: system.answer.y + 1 }));

const inequality = makeInequality(rngFrom([0.4, 0.1, 0.4, 0.2, 0.4]));
assert.equal(inequality.topic, 'inequality');
assert.ok(inequality.check(inequality.answer));
assert.ok(!inequality.check({ sign: '<', boundary: inequality.answer.boundary + 1 }));

const generated = makeQuestion('linear');
const normalized = normalizeAnswerForQuestion(generated, { x: String(generated.answer.x) });
assert.ok(generated.check(normalized));

const stats = calculateStats([
  { topic: 'linear', correct: true },
  { topic: 'linear', correct: false },
  { topic: 'system', correct: true }
]);
assert.deepEqual(stats, {
  total: 3,
  correct: 2,
  accuracy: 67,
  byTopic: {
    linear: { total: 2, correct: 1 },
    system: { total: 1, correct: 1 },
    inequality: { total: 0, correct: 0 }
  }
});

console.log('All generator tests passed.');
