import { TOPICS, calculateStats, makeQuestion, normalizeAnswerForQuestion } from './generators.js';

const STORAGE_KEY = 'math-practice-classroom-v1';
const DEFAULT_STATE = {
  students: [],
  attempts: [],
  activeStudentId: '',
  activeTopic: 'linear'
};

let state = loadState();
let currentQuestion = makeQuestion(state.activeTopic);

const studentSelect = document.querySelector('#studentSelect');
const studentNameInput = document.querySelector('#studentName');
const topicTabs = document.querySelector('#topicTabs');
const questionCard = document.querySelector('#questionCard');
const answerForm = document.querySelector('#answerForm');
const feedback = document.querySelector('#feedback');
const studentStats = document.querySelector('#studentStats');
const teacherDashboard = document.querySelector('#teacherDashboard');
const emptyTeacherState = document.querySelector('#emptyTeacherState');
const exportButton = document.querySelector('#exportData');
const resetButton = document.querySelector('#resetData');

init();

function init() {
  renderStudentSelect();
  renderTopicTabs();
  renderQuestion();
  renderStudentStats();
  renderTeacherDashboard();

  document.querySelector('#addStudent').addEventListener('click', addStudent);
  studentNameInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') addStudent();
  });
  studentSelect.addEventListener('change', (event) => {
    state.activeStudentId = event.target.value;
    saveState();
    renderStudentStats();
  });
  document.querySelector('#nextQuestion').addEventListener('click', nextQuestion);
  answerForm.addEventListener('submit', submitAnswer);
  exportButton.addEventListener('click', exportData);
  resetButton.addEventListener('click', resetAllData);
}

function addStudent() {
  const name = studentNameInput.value.trim();
  if (!name) {
    studentNameInput.focus();
    return;
  }
  const student = { id: `stu_${Date.now().toString(36)}`, name, createdAt: new Date().toISOString() };
  state.students.push(student);
  state.activeStudentId = student.id;
  studentNameInput.value = '';
  saveState();
  renderStudentSelect();
  renderStudentStats();
  renderTeacherDashboard();
}

function nextQuestion() {
  currentQuestion = makeQuestion(state.activeTopic);
  feedback.innerHTML = '';
  feedback.className = 'feedback';
  renderQuestion();
}

function submitAnswer(event) {
  event.preventDefault();
  const student = getActiveStudent();
  if (!student) {
    feedback.className = 'feedback warning';
    feedback.textContent = '请先在左侧添加或选择一名学生，再开始提交答案。';
    return;
  }
  const formData = Object.fromEntries(new FormData(answerForm).entries());
  const normalizedAnswer = normalizeAnswerForQuestion(currentQuestion, formData);
  const correct = currentQuestion.check(normalizedAnswer);
  const attempt = {
    id: `att_${Date.now().toString(36)}`,
    studentId: student.id,
    studentName: student.name,
    topic: currentQuestion.topic,
    prompt: currentQuestion.prompt,
    submittedAnswer: formatSubmittedAnswer(currentQuestion.topic, normalizedAnswer),
    correctAnswer: currentQuestion.answerLabel,
    correct,
    createdAt: new Date().toISOString()
  };
  state.attempts.unshift(attempt);
  saveState();
  feedback.className = correct ? 'feedback success' : 'feedback error';
  feedback.innerHTML = correct
    ? `回答正确！<strong>${currentQuestion.answerLabel}</strong>`
    : `这次还不对。正确答案是 <strong>${currentQuestion.answerLabel}</strong>。提示：${currentQuestion.hint}`;
  renderStudentStats();
  renderTeacherDashboard();
}

function renderStudentSelect() {
  studentSelect.innerHTML = '';
  if (state.students.length === 0) {
    studentSelect.append(new Option('还没有学生，请先添加', ''));
    state.activeStudentId = '';
  } else {
    for (const student of state.students) {
      studentSelect.append(new Option(student.name, student.id, false, student.id === state.activeStudentId));
    }
    if (!state.activeStudentId || !state.students.some((student) => student.id === state.activeStudentId)) {
      state.activeStudentId = state.students[0].id;
      studentSelect.value = state.activeStudentId;
    }
  }
  saveState();
}

function renderTopicTabs() {
  topicTabs.innerHTML = '';
  Object.entries(TOPICS).forEach(([topic, config]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = topic === state.activeTopic ? 'topic-tab active' : 'topic-tab';
    button.innerHTML = `<strong>${config.label}</strong><span>${config.description}</span>`;
    button.addEventListener('click', () => {
      state.activeTopic = topic;
      saveState();
      renderTopicTabs();
      nextQuestion();
    });
    topicTabs.append(button);
  });
}

function renderQuestion() {
  const topic = TOPICS[currentQuestion.topic];
  questionCard.querySelector('.question-topic').textContent = topic.label;
  questionCard.querySelector('.question-text').textContent = currentQuestion.prompt;
  questionCard.querySelector('.question-hint').textContent = currentQuestion.hint;
  answerForm.innerHTML = buildAnswerFields(currentQuestion.topic);
}

function buildAnswerFields(topic) {
  if (topic === 'system') {
    return `
      <label>x 的值<input name="x" inputmode="decimal" autocomplete="off" placeholder="例如：3 或 -1/2" required></label>
      <label>y 的值<input name="y" inputmode="decimal" autocomplete="off" placeholder="例如：-2" required></label>
      <button class="primary" type="submit">提交答案</button>
    `;
  }
  if (topic === 'inequality') {
    return `
      <div class="inline-answer">
        <span>x</span>
        <label class="sr-only" for="sign">不等号</label>
        <select id="sign" name="sign" required>
          <option value="<">&lt;</option>
          <option value="≤">≤</option>
          <option value=">">&gt;</option>
          <option value="≥">≥</option>
        </select>
        <label class="sr-only" for="boundary">边界值</label>
        <input id="boundary" name="boundary" inputmode="decimal" autocomplete="off" placeholder="边界值" required>
      </div>
      <button class="primary" type="submit">提交答案</button>
    `;
  }
  return `
    <label>x 的值<input name="x" inputmode="decimal" autocomplete="off" placeholder="例如：5 或 -3" required></label>
    <button class="primary" type="submit">提交答案</button>
  `;
}

function renderStudentStats() {
  const student = getActiveStudent();
  if (!student) {
    studentStats.innerHTML = '<p class="muted">添加学生后，这里会显示当前学生的正确率和最近记录。</p>';
    return;
  }
  const attempts = state.attempts.filter((attempt) => attempt.studentId === student.id);
  const stats = calculateStats(attempts);
  studentStats.innerHTML = `
    <div class="stat-grid">
      <article><span>${stats.total}</span><small>已完成</small></article>
      <article><span>${stats.correct}</span><small>答对</small></article>
      <article><span>${stats.accuracy}%</span><small>正确率</small></article>
    </div>
    <h3>${student.name} 的最近练习</h3>
    ${renderAttemptList(attempts.slice(0, 5))}
  `;
}

function renderTeacherDashboard() {
  if (state.students.length === 0) {
    emptyTeacherState.hidden = false;
    teacherDashboard.innerHTML = '';
    return;
  }
  emptyTeacherState.hidden = true;
  teacherDashboard.innerHTML = state.students.map((student) => {
    const attempts = state.attempts.filter((attempt) => attempt.studentId === student.id);
    const stats = calculateStats(attempts);
    const topicRows = Object.entries(stats.byTopic).map(([topic, item]) => {
      const accuracy = item.total === 0 ? 0 : Math.round((item.correct / item.total) * 100);
      return `<li><span>${TOPICS[topic].label}</span><strong>${item.correct}/${item.total}</strong><em>${accuracy}%</em></li>`;
    }).join('');
    return `
      <article class="student-card">
        <header>
          <div>
            <h3>${escapeHtml(student.name)}</h3>
            <p>最近提交：${attempts[0] ? formatTime(attempts[0].createdAt) : '暂无'}</p>
          </div>
          <strong class="accuracy">${stats.accuracy}%</strong>
        </header>
        <div class="progress"><span style="width:${stats.accuracy}%"></span></div>
        <ul class="topic-breakdown">${topicRows}</ul>
        ${renderAttemptList(attempts.slice(0, 3))}
      </article>
    `;
  }).join('');
}

function renderAttemptList(attempts) {
  if (attempts.length === 0) return '<p class="muted">暂无练习记录。</p>';
  return `<ol class="attempt-list">${attempts.map((attempt) => `
    <li class="${attempt.correct ? 'right' : 'wrong'}">
      <span>${attempt.correct ? '✓' : '×'}</span>
      <div>
        <strong>${TOPICS[attempt.topic].label}</strong>
        <p>${escapeHtml(attempt.prompt)}</p>
        <small>提交：${escapeHtml(attempt.submittedAnswer)}；答案：${escapeHtml(attempt.correctAnswer)}；${formatTime(attempt.createdAt)}</small>
      </div>
    </li>
  `).join('')}</ol>`;
}

function exportData() {
  const data = JSON.stringify(state, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `math-practice-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function resetAllData() {
  if (!confirm('确定清空所有学生与练习记录吗？此操作不可撤销。')) return;
  state = structuredClone(DEFAULT_STATE);
  currentQuestion = makeQuestion(state.activeTopic);
  saveState();
  renderStudentSelect();
  renderTopicTabs();
  renderQuestion();
  renderStudentStats();
  renderTeacherDashboard();
  feedback.innerHTML = '';
}

function getActiveStudent() {
  return state.students.find((student) => student.id === state.activeStudentId);
}

function loadState() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return { ...structuredClone(DEFAULT_STATE), ...stored };
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function formatSubmittedAnswer(topic, answer) {
  if (topic === 'system') return `x = ${answer.x}，y = ${answer.y}`;
  if (topic === 'inequality') return `x ${answer.sign} ${answer.boundary}`;
  return `x = ${answer.x}`;
}

function formatTime(isoString) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
  }).format(new Date(isoString));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));
}
