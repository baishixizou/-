export const TOPICS = {
  linear: {
    label: '一元一次方程',
    description: '形如 ax + b = c 的基础移项与合并同类项练习。'
  },
  system: {
    label: '二元一次方程组',
    description: '形如 ax + by = c 的二元一次方程组，练习代入/消元思想。'
  },
  inequality: {
    label: '一元一次不等式',
    description: '形如 ax + b < c 的不等式，特别关注负数系数两边同除时变号。'
  }
};

const SIGNS = ['<', '≤', '>', '≥'];

export function randomInt(min, max, rng = Math.random) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function nonZeroInt(min, max, rng) {
  let value = 0;
  while (value === 0) value = randomInt(min, max, rng);
  return value;
}

function formatSigned(value) {
  if (value === 0) return '';
  return value > 0 ? ` + ${value}` : ` - ${Math.abs(value)}`;
}

function formatCoefficient(value, variable) {
  if (value === 1) return variable;
  if (value === -1) return `-${variable}`;
  return `${value}${variable}`;
}

function formatSignedCoefficient(value, variable) {
  if (value === 0) return '';
  const sign = value > 0 ? '+' : '-';
  const absoluteValue = Math.abs(value);
  const coefficient = absoluteValue === 1 ? variable : `${absoluteValue}${variable}`;
  return ` ${sign} ${coefficient}`;
}


export function parseStudentAnswer(text) {
  if (typeof text !== 'string') return NaN;
  const normalized = text
    .trim()
    .replace(/[，。]/g, '')
    .replace(/[×xX]/g, '*')
    .replace(/[÷]/g, '/')
    .replace(/^[-+]?\d+\s*\/\s*[-+]?\d+$/, (fraction) => fraction.replace(/\s+/g, ''));

  if (/^[-+]?\d+(\.\d+)?$/.test(normalized)) return Number(normalized);
  if (/^[-+]?\d+\/[-+]?\d+$/.test(normalized)) {
    const [numerator, denominator] = normalized.split('/').map(Number);
    return denominator === 0 ? NaN : numerator / denominator;
  }
  return NaN;
}

export function makeLinearEquation(rng = Math.random) {
  const x = randomInt(-9, 9, rng);
  const a = nonZeroInt(-9, 9, rng);
  const b = randomInt(-12, 12, rng);
  const c = a * x + b;
  return {
    id: cryptoRandomId(rng),
    topic: 'linear',
    prompt: `解方程：${formatCoefficient(a, 'x')}${formatSigned(b)} = ${c}`,
    answer: { x },
    answerLabel: `x = ${x}`,
    hint: '先把常数项移到等号右边，再用 x 的系数去除。',
    check: ({ x: givenX }) => nearlyEqual(givenX, x)
  };
}

export function makeSystemEquation(rng = Math.random) {
  const x = randomInt(-6, 6, rng);
  const y = randomInt(-6, 6, rng);
  let a = nonZeroInt(-5, 5, rng);
  let b = nonZeroInt(-5, 5, rng);
  let c = nonZeroInt(-5, 5, rng);
  let d = nonZeroInt(-5, 5, rng);
  while (a * d - b * c === 0) {
    c = nonZeroInt(-5, 5, rng);
    d = nonZeroInt(-5, 5, rng);
  }
  const e = a * x + b * y;
  const f = c * x + d * y;
  return {
    id: cryptoRandomId(rng),
    topic: 'system',
    prompt: `解方程组：${formatCoefficient(a, 'x')}${formatSignedCoefficient(b, 'y')} = ${e}；${formatCoefficient(c, 'x')}${formatSignedCoefficient(d, 'y')} = ${f}`,
    answer: { x, y },
    answerLabel: `x = ${x}，y = ${y}`,
    hint: '可以用加减消元法：让一个未知数的系数相同或相反。',
    check: ({ x: givenX, y: givenY }) => nearlyEqual(givenX, x) && nearlyEqual(givenY, y)
  };
}

export function makeInequality(rng = Math.random) {
  const boundary = randomInt(-8, 8, rng);
  const a = nonZeroInt(-8, 8, rng);
  const b = randomInt(-12, 12, rng);
  const sign = SIGNS[randomInt(0, SIGNS.length - 1, rng)];
  const c = a * boundary + b;
  const displaySign = sign;
  const solutionSign = a > 0 ? sign : flipSign(sign);
  return {
    id: cryptoRandomId(rng),
    topic: 'inequality',
    prompt: `解不等式：${formatCoefficient(a, 'x')}${formatSigned(b)} ${displaySign} ${c}`,
    answer: { boundary, sign: solutionSign },
    answerLabel: `x ${solutionSign} ${boundary}`,
    hint: a < 0 ? '注意：不等式两边同除以负数时，不等号方向要改变。' : '像解方程一样移项，最后用正系数去除。',
    check: ({ sign: givenSign, boundary: givenBoundary }) => givenSign === solutionSign && nearlyEqual(givenBoundary, boundary)
  };
}

export function makeQuestion(topic, rng = Math.random) {
  if (topic === 'linear') return makeLinearEquation(rng);
  if (topic === 'system') return makeSystemEquation(rng);
  if (topic === 'inequality') return makeInequality(rng);
  throw new Error(`Unknown topic: ${topic}`);
}

export function normalizeAnswerForQuestion(question, formData) {
  if (question.topic === 'inequality') {
    return {
      sign: formData.sign,
      boundary: parseStudentAnswer(formData.boundary)
    };
  }
  if (question.topic === 'system') {
    return {
      x: parseStudentAnswer(formData.x),
      y: parseStudentAnswer(formData.y)
    };
  }
  return { x: parseStudentAnswer(formData.x) };
}

export function calculateStats(attempts) {
  const total = attempts.length;
  const correct = attempts.filter((attempt) => attempt.correct).length;
  const byTopic = Object.fromEntries(Object.keys(TOPICS).map((topic) => [topic, { total: 0, correct: 0 }]));
  for (const attempt of attempts) {
    if (!byTopic[attempt.topic]) continue;
    byTopic[attempt.topic].total += 1;
    if (attempt.correct) byTopic[attempt.topic].correct += 1;
  }
  return {
    total,
    correct,
    accuracy: total === 0 ? 0 : Math.round((correct / total) * 100),
    byTopic
  };
}

function flipSign(sign) {
  return { '<': '>', '≤': '≥', '>': '<', '≥': '≤' }[sign];
}

function nearlyEqual(a, b) {
  return Number.isFinite(a) && Math.abs(a - b) < 1e-9;
}

function cryptoRandomId(rng) {
  return `q_${Date.now().toString(36)}_${Math.floor(rng() * 1e8).toString(36)}`;
}
