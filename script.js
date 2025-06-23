const form = document.getElementById('entryForm');
const logList = document.getElementById('logList');
const filterExercise = document.getElementById('filterExercise');
const filterDate = document.getElementById('filterDate');
const filterCategory = document.getElementById('filterCategory');
const summary = document.getElementById('weeklySummary');
const toggleTheme = document.getElementById('toggleTheme');
const chartCanvas = document.getElementById('chart');

let logs = JSON.parse(localStorage.getItem('logs') || '[]');

function saveLogs() {
  localStorage.setItem('logs', JSON.stringify(logs));
}

function calculateWeeklySummary() {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const filtered = logs.filter(log => new Date(log.date) >= weekAgo);
  const totalVolume = filtered.reduce((sum, log) =>
    sum + (log.sets * log.reps * (parseInt(log.weight) || 0)), 0);
  summary.textContent = `Total Volume: ${totalVolume} lbs across ${filtered.length} workouts.`;
}

function renderLogs() {
  logList.innerHTML = '';
  const filteredLogs = logs.filter(log =>
    (!filterExercise.value || log.exercise.toLowerCase().includes(filterExercise.value.toLowerCase())) &&
    (!filterDate.value || log.date === filterDate.value) &&
    (!filterCategory.value || log.category === filterCategory.value)
  );

  filteredLogs.forEach((log, i) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <strong>${log.date}</strong>: ${log.exercise} (${log.category}) – 
      ${log.sets}x${log.reps} @ ${log.weight || 0}lbs
      <button onclick="editLog(${i})">Edit</button>
      <button onclick="deleteLog(${i})">Delete</button>
    `;
    logList.appendChild(li);
  });

  drawChart();
  calculateWeeklySummary();
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

function deleteLog(index) {
  logs.splice(index, 1);
  saveLogs();
  renderLogs();
}

function editLog(index) {
  const log = logs[index];
  form.date.value = log.date;
  form.exercise.value = log.exercise;
  form.sets.value = log.sets;
  form.reps.value = log.reps;
  form.weight.value = log.weight;
  form.category.value = log.category;
  logs.splice(index, 1);
  saveLogs();
}

filterExercise.addEventListener('input', renderLogs);
filterDate.addEventListener('input', renderLogs);
filterCategory.addEventListener('change', renderLogs);
toggleTheme.addEventListener('click', () => document.body.classList.toggle('dark'));

document.getElementById('exportJSON').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
  download(blob, 'fitness-logs.json');
});

document.getElementById('exportCSV').addEventListener('click', () => {
  const csv = logs.map(log =>
    `${log.date},${log.exercise},${log.sets},${log.reps},${log.weight},${log.category}`
  ).join('\n');
  const blob = new Blob([`Date,Exercise,Sets,Reps,Weight,Category\n${csv}`], { type: 'text/csv' });
  download(blob, 'fitness-logs.csv');
});

function download(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

function drawChart() {
  const ctx = chartCanvas.getContext('2d');
  if (window.chartInstance) window.chartInstance.destroy();
  const labels = logs.map(l => l.date);
  const data = logs.map(l => l.sets * l.reps * (parseInt(l.weight) || 0));
  window.chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Volume Lifted',
        data,
        backgroundColor: '#4CAF50'
      }]
    },
    options: {
      scales: {
        x: { title: { display: true, text: 'Date' } },
        y: { title: { display: true, text: 'Total Volume (lbs)' } }
      }
    }
  });
}

renderLogs();