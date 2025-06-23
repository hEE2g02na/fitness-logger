const form = document.getElementById('entryForm');
const logList = document.getElementById('logList');

const getLogs = () => JSON.parse(localStorage.getItem('logs') || '[]');

const saveLogs = (logs) => localStorage.setItem('logs', JSON.stringify(logs));

const renderLogs = () => {
    logList.innerHTML = '';
    getLogs().forEach((log, i) => {
        const li = document.createElement('li');
        li.textContent = `${log.date}: ${log.exercise} — ${log.sets}x${log.reps} @ ${log.weight || 0}lbs`;
        logList.appendChild(li);
    });
};

form.addEventListener('submit', (e) => {
    e.preventDefault();
    const log = {
        date: document.getElementById('date').value,
        exercise: document.getElementById('exercise').value,
        sets: document.getElementById('sets').value,
        reps: document.getElementById('reps').value,
        weight: document.getElementById('weight').value,
    };
    const logs = getLogs();
    logs.push(log);
    saveLogs(logs);
    renderLogs();
    form.reset();
});

renderLogs();