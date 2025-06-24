const form = document.getElementById('entryForm');
const logList = document.getElementById('logList');
const filterExercise = document.getElementById('filterExercise');
const filterDate = document.getElementById('filterDate');
const filterCategory = document.getElementById('filterCategory');
const summary = document.getElementById('weeklySummary');
const chartCanvas = document.getElementById('chart');

let logs = JSON.parse(localStorage.getItem('logs') || '[]');

function saveLogs() {
  localStorage.setItem('logs', JSON.stringify(logs));
}

function renderLogs() {
  logList.innerHTML = '';
  const filtered = logs.filter(log =>
    (!filterExercise.value || log.exercise.toLowerCase().includes(filterExercise.value.toLowerCase())) &&
    (!filterDate.value || log.date === filterDate.value) &&
    (!filterCategory.value || log.category === filterCategory.value)
  );

  filtered.forEach((log, i) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <strong>${log.date}</strong>: ${log.exercise} (${log.category}) – 
      ${log.sets}x${log.reps} @ ${log.weight}lbs
      <button onclick="editLog(${i})">Edit</button>
      <button onclick="deleteLog(${i})">Delete</button>
    `;
    logList.appendChild(li);
  });

  drawChart(filtered);
  updateSummary(filtered);
}

function drawChart(data) {
  const ctx = chartCanvas.getContext('2d');
  if (window.chartInstance) window.chartInstance.destroy();
  const labels = data.map(log => log.date);
  const values = data.map(log => log.sets * log.reps * (parseInt(log.weight) || 0));
  window.chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Volume Lifted',
        data: values,
        backgroundColor: '#4CAF50'
      }]
    },
    options: {
      responsive: true,
      scales: {
        x: { title: { display: true, text: 'Date' } },
        y: { title: { display: true, text: 'Total Volume (lbs)' } }
      }
    }
  });
}

function updateSummary(data) {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const recent = data.filter(log => new Date(log.date) >= weekAgo);
  const total = recent.reduce((sum, log) => sum + log.sets * log.reps * (parseInt(log.weight) || 0), 0);
  summary.textContent = `Past 7 days: ${recent.length} workouts, ${total} lbs lifted`;
}

form.addEventListener('submit', e => {
  e.preventDefault();
  const log = {
    date: form.date.value,
    exercise: form.exercise.value,
    sets: parseInt(form.sets.value),
    reps: parseInt(form.reps.value),
    weight: parseInt(form.weight.value || 0),
    category: form.category.value
  };
  logs.push(log);
  saveLogs();
  renderLogs();
  form.reset();
});

function deleteLog(i) {
  logs.splice(i, 1);
  saveLogs();
  renderLogs();
}

function editLog(i) {
  const log = logs[i];
  form.date.value = log.date;
  form.exercise.value = log.exercise;
  form.sets.value = log.sets;
  form.reps.value = log.reps;
  form.weight.value = log.weight;
  form.category.value = log.category;
  logs.splice(i, 1);
  saveLogs();
  renderLogs();
}

document.querySelectorAll('#navbar button').forEach(btn =>
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    document.querySelectorAll('.tab').forEach(div =>
      div.style.display = div.dataset.tab === tab ? 'block' : 'none'
    );
  })
);

document.getElementById('toggleTheme').addEventListener('click', () =>
  document.body.classList.toggle('dark')
);

document.getElementById('toggleLayout').addEventListener('click', () =>
  alert('Alternate layout coming soon!')
);

document.getElementById('exportJSON').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(logs, null