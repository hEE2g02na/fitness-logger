import {initializeApp} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
    collection,
    enableIndexedDbPersistence,
    getDocs,
    getFirestore
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Firebase config
const firebaseConfig = {
    apiKey: "AIzaSyAw335goNfYMw9KCOUBsHmRgzC2YSg7JRY",
    authDomain: "fitness-logger-be74a.firebaseapp.com",
    projectId: "fitness-logger-be74a",
    storageBucket: "fitness-logger-be74a.appspot.com",
    messagingSenderId: "903626008062",
    appId: "1:903626008062:web:60f646e03b9750967f8caf",
    measurementId: "G-KDG1M2MP3N"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const logsRef = collection(db, "logs");
enableIndexedDbPersistence(db).catch(err => console.warn("Offline support unavailable:", err.code));

const form = document.getElementById("entryForm");
const logList = document.getElementById("logList");
const filterExercise = document.getElementById("filterExercise");
const filterDate = document.getElementById("filterDate");
const filterCategory = document.getElementById("filterCategory");
const filterTags = document.getElementById("filterTags");
const summary = document.getElementById("weeklySummary");
const chartCanvas = document.getElementById("chart");
const syncStatus = document.getElementById("syncStatus");
const syncProgressBar = document.getElementById("syncProgressBar");
const syncStatusLabel = document.getElementById("syncStatusLabel");
const performanceSummary = document.getElementById("performanceSummary");
const streakTracker = document.getElementById("streakTracker");
const prList = document.getElementById("prList");
const exerciseInput = document.getElementById("exercise");
const exerciseSuggestions = document.getElementById("exerciseSuggestions");
const tagsInput = document.getElementById("tags");
const goalForm = document.getElementById("goalForm");
const goalStatus = document.getElementById("goalStatus");
const progressLineChartCanvas = document.getElementById("progressLineChart");
const exerciseChartsDiv = document.getElementById("exerciseCharts");
const calendarContainer = document.getElementById("calendarContainer");
const calendarLabel = document.getElementById("calendarLabel");
const prevMonthBtn = document.getElementById("prevMonth");
const nextMonthBtn = document.getElementById("nextMonth");
const prevYearBtn = document.getElementById("prevYear");
const nextYearBtn = document.getElementById("nextYear");
const exportSummaryImageBtn = document.getElementById("exportSummaryImage");
const addCircuitBtn = document.getElementById("addCircuitBtn");
const circuitBuilder = document.getElementById("circuitBuilder");
const circuitExercisesDiv = document.getElementById("circuitExercises");
const addExerciseToCircuitBtn = document.getElementById("addExerciseToCircuitBtn");
const saveCircuitBtn = document.getElementById("saveCircuitBtn");
const cancelCircuitBtn = document.getElementById("cancelCircuitBtn");
const openConnectionTestBtn = document.getElementById("openConnectionTest");
const connectionTestModal = document.getElementById("connectionTestModal");
const closeConnectionTestBtn = document.getElementById("closeConnectionTest");
const runConnectionTestBtn = document.getElementById("runConnectionTest");
const connectionTestStatus = document.getElementById("connectionTestStatus");

let logs = [];
let editingId = null;
let goals = loadGoals();
let calendarState = (() => {
    const today = new Date();
    return {year: today.getFullYear(), month: today.getMonth()};
})();

let syncProgress = 0; // percentage (0-100)

// Theme toggle
document.getElementById("toggleTheme").addEventListener("click", () =>
    document.body.classList.toggle("dark")
);

// Connection status indicator
function updateSyncStatus(percent = null) {
    if (syncProgressBar && percent !== null) {
        syncProgressBar.value = percent;
        syncProgressBar.style.visibility = "visible";
    }
    if (syncStatusLabel) {
        if (percent !== null) {
            syncStatusLabel.textContent = navigator.onLine
                ? `✅ Online (${percent}%)`
                : `🔌 Offline Mode (${percent}%)`;
        } else {
            syncStatusLabel.textContent = navigator.onLine
                ? "✅ Online"
                : "🔌 Offline Mode";
        }
    }
    if (syncStatus) {
        syncStatus.style.background = navigator.onLine ? "#5cb85c" : "#f0ad4e";
    }
}

window.addEventListener("online", () => updateSyncStatus(syncProgress));
window.addEventListener("offline", () => updateSyncStatus(syncProgress));

// --- GOAL SETTING ---
function loadGoals() {
    try {
        return JSON.parse(localStorage.getItem("fitnessGoals")) || {};
    } catch {
        return {};
    }
}
function saveGoals(goals) {
    localStorage.setItem("fitnessGoals", JSON.stringify(goals));
}
if (goalForm) {
    ["goalVolume", "goalSets", "goalSessions", "goalWeeklyVolume"].forEach(id => {
        if (goals[id]) goalForm[id].value = goals[id];
    });
    goalForm.addEventListener("submit", e => {
        e.preventDefault();
        goals = {
            goalVolume: parseInt(goalForm.goalVolume.value) || 0,
            goalSets: parseInt(goalForm.goalSets.value) || 0,
            goalSessions: parseInt(goalForm.goalSessions.value) || 0,
            goalWeeklyVolume: parseInt(goalForm.goalWeeklyVolume.value) || 0
        };
        saveGoals(goals);
        showGoalStatus();
    });
}
function showGoalStatus() {
    if (!goalStatus) return;
    const today = new Date().toISOString().split("T")[0];
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 6);
    let todayVol = 0, todaySets = 0, todaySessions = 0, weekVol = 0;
    const todayLogs = logs.filter(l => l.date === today);
    const weekLogs = logs.filter(l => new Date(l.date) >= weekAgo);
    todaySessions = todayLogs.length;
    todayLogs.forEach(l => {
        todayVol += l.sets * l.reps * l.weight;
        todaySets += l.sets;
    });
    weekLogs.forEach(l => {
        weekVol += l.sets * l.reps * l.weight;
    });
    let html = "";
    if (goals.goalVolume)
        html += `<div>Daily Volume: ${todayVol}/${goals.goalVolume} lbs ${todayVol >= goals.goalVolume ? "✅" : ""}</div>`;
    if (goals.goalSets)
        html += `<div>Daily Sets: ${todaySets}/${goals.goalSets} ${todaySets >= goals.goalSets ? "✅" : ""}</div>`;
    if (goals.goalSessions)
        html += `<div>Daily Sessions: ${todaySessions}/${goals.goalSessions} ${todaySessions >= goals.goalSessions ? "✅" : ""}</div>`;
    if (goals.goalWeeklyVolume)
        html += `<div>Weekly Volume: ${weekVol}/${goals.goalWeeklyVolume} lbs ${weekVol >= goals.goalWeeklyVolume ? "✅" : ""}</div>`;
    goalStatus.innerHTML = html || "<em>No goals set.</em>";
}

// --- STREAK TRACKER ---
function getStreak(logs, type = "day") {
    if (!logs.length) return 0;
    const dates = logs.map(l => l.date).sort((a, b) => b.localeCompare(a));
    let streak = 0;
    let last = new Date(dates[0]);
    for (let i = 0; i < dates.length; i++) {
        const d = new Date(dates[i]);
        if (type === "day") {
            if (i === 0 || (last - d) / (1000 * 60 * 60 * 24) === 1) {
                streak++;
                last = d;
            } else if (last.toISOString().split("T")[0] !== d.toISOString().split("T")[0]) {
                break;
            }
        } else if (type === "week") {
            const weekNum = getWeekNumber(d);
            const lastWeekNum = getWeekNumber(last);
            if (i === 0 || lastWeekNum - weekNum === 1) {
                streak++;
                last = d;
            } else if (lastWeekNum !== weekNum) {
                break;
            }
        }
    }
    return streak;
}
function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    return Math.ceil((((d - yearStart) / 86400000) + 1)/7);
}
function updateStreakTracker() {
    if (!streakTracker) return;
    const uniqueDays = [...new Set(logs.map(l => l.date))];
    const dayStreak = getStreak(logs, "day");
    const weekStreak = getStreak(logs, "week");
    streakTracker.innerHTML = `
      <div>🔥 <b>${dayStreak}-day streak</b> (${uniqueDays.length} days logged)</div>
      <div>📅 <b>${weekStreak}-week streak</b></div>
    `;
}

// --- PERSONAL RECORDS HISTORY ---
function updatePersonalRecords() {
    if (!prList) return;
    const prs = {};
    logs.forEach(log => {
        const vol = log.sets * log.reps * log.weight;
        if (!prs[log.exercise] || vol > prs[log.exercise].volume) {
            prs[log.exercise] = {volume: vol, date: log.date, sets: log.sets, reps: log.reps, weight: log.weight};
        }
    });
    prList.innerHTML = Object.entries(prs).length
        ? Object.entries(prs).map(([ex, pr]) =>
            `<li><b>${ex}</b>: ${pr.sets}x${pr.reps} @ ${pr.weight}lbs = <b>${pr.volume} lbs</b> on ${pr.date}</li>`
        ).join("")
        : "<li>No records yet.</li>";
}

// --- AUTO-FILL SUGGESTIONS ---
function updateExerciseSuggestions() {
    if (!exerciseSuggestions) return;
    const exercises = [...new Set(logs.map(l => l.exercise))].sort();
    exerciseSuggestions.innerHTML = exercises.map(ex =>
        `<option value="${ex}"></option>`
    ).join("");
}
if (exerciseInput) {
    exerciseInput.addEventListener("input", () => {
        updateExerciseSuggestions();
    });
}

// --- TAG SUPPORT ---
function parseTags(str) {
    return str.split(",").map(t => t.trim().toLowerCase()).filter(Boolean);
}
function tagsToString(tags) {
    return (tags || []).join(", ");
}

// --- CHART (Main Bar Chart) ---
let mainChartInstance = null;
function drawMainChart(logs) {
    if (!chartCanvas) return;
    const ctx = chartCanvas.getContext("2d");
    if (mainChartInstance) mainChartInstance.destroy();
    mainChartInstance = new Chart(ctx, {
        type: "bar",
        data: {
            labels: logs.map(log => log.date),
            datasets: [{
                label: "Volume Lifted",
                data: logs.map(log => log.sets * log.reps * log.weight),
                backgroundColor: "#4CAF50"
            }]
        },
        options: {
            responsive: true,
            scales: {
                x: {title: {display: true, text: "Date"}},
                y: {title: {display: true, text: "Total Volume (lbs)"}}
            }
        }
    });
}

// --- EXPORT WORKOUT IMAGES (Summary Chart) ---
if (exportSummaryImageBtn && chartCanvas) {
    exportSummaryImageBtn.addEventListener("click", () => {
        const link = document.createElement("a");
        link.download = "fitness-summary.png";
        link.href = chartCanvas.toDataURL("image/png");
        link.click();
    });
}

// --- FETCH LOGS (with tags support) ---
async function fetchLogs() {
    updateSyncStatus(0);
    const snapshot = await getDocs(logsRef);
    const docs = snapshot.docs;
    const total = docs.length;
    logs = [];
    for (let i = 0; i < total; i++) {
        const doc = docs[i];
        const data = doc.data();
        data.tags = data.tags || [];
        logs.push({id: doc.id, ...data});
        // Update progress percentage
        let percent = Math.round(((i + 1) / total) * 100);
        syncProgress = percent;
        updateSyncStatus(percent);
    }
    updateSyncStatus(100);
    if (syncProgressBar) syncProgressBar.style.visibility = "hidden";
    renderLogs();
    updatePerformance();
    updateStreakTracker();
    updatePersonalRecords();
    updateExerciseSuggestions();
    showGoalStatus();
    drawMainChart(logs);
}

// --- RENDER LOGS (with circuits and tags) ---
function renderLogs() {
    logList.innerHTML = "";
    const filtered = logs.filter(log =>
        (!filterExercise.value || (log.isCircuit
            ? log.exercises.some(ex => ex.exercise.toLowerCase().includes(filterExercise.value.toLowerCase()))
            : log.exercise.toLowerCase().includes(filterExercise.value.toLowerCase()))) &&
        (!filterDate.value || log.date === filterDate.value) &&
        (!filterCategory.value || (log.isCircuit
            ? log.exercises.some(ex => ex.category === filterCategory.value)
            : log.category === filterCategory.value)) &&
        (!filterTags.value || (log.isCircuit
            ? log.exercises.some(ex => ex.tags && ex.tags.some(tag => tag.includes(filterTags.value.toLowerCase())))
            : (log.tags && log.tags.some(tag => tag.includes(filterTags.value.toLowerCase())))))
    );

    filtered.forEach(log => {
        let html;
        if (log.isCircuit) {
            html = `<div><strong>${log.date}</strong>: <b>Circuit</b> 
                <ul style="margin:0.5em 0 0 1em;padding:0;">
                  ${log.exercises.map(ex =>
                    `<li style="background:none;box-shadow:none;padding:0;margin:0 0 0.2em 0;">
                      ${ex.exercise} (${ex.category}) 
                      ${ex.sets}x${ex.reps} @ ${ex.weight}lbs 
                      ${ex.tags && ex.tags.length ? `<span style="font-size:0.9em;color:#888;">[${tagsToString(ex.tags)}]</span>` : ""}
                    </li>`
                  ).join("")}
                </ul>
              </div>`;
        } else {
            const tagStr = log.tags && log.tags.length ? `<span style="font-size:0.9em;color:#888;">[${tagsToString(log.tags)}]</span>` : "";
            html = `<div><strong>${log.date}</strong>: ${log.exercise} (${log.category}) ${tagStr} –
                ${log.sets}x${log.reps} @ ${log.weight}lbs</div>`;
        }
        const li = document.createElement("li");
        li.innerHTML = `
          ${html}
          <div>
            <button onclick='editLogById("${log.id}")'>✏️</button>
            <button onclick='deleteLog("${log.id}")'>🗑️</button>
          </div>`;
        logList.appendChild(li);
    });

    drawChart(filtered);
    updateSummary(filtered);
    updateStreakTracker();
    showGoalStatus();
}

// Weekly summary
function updateSummary(data) {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const recent = data.filter(log => new Date(log.date) >= weekAgo);
    const total = recent.reduce((sum, log) => sum + log.sets * log.reps * log.weight, 0);
    summary.textContent = `Past 7 days: ${recent.length} workouts, ${total} lbs lifted`;

    // --- Fill summary table ---
    const summaryTable = document.getElementById("summaryTable");
    if (summaryTable) {
        const tbody = summaryTable.querySelector("tbody");
        tbody.innerHTML = "";
        recent.forEach(log => {
            if (log.isCircuit && Array.isArray(log.exercises)) {
                log.exercises.forEach(ex => {
                    const tr = document.createElement("tr");
                    tr.innerHTML = `
                        <td>${log.date}</td>
                        <td>${ex.exercise}</td>
                        <td>${ex.sets}</td>
                        <td>${ex.reps}</td>
                        <td>${ex.weight}</td>
                        <td>${ex.sets * ex.reps * ex.weight}</td>
                    `;
                    tbody.appendChild(tr);
                });
            } else {
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td>${log.date}</td>
                    <td>${log.exercise}</td>
                    <td>${log.sets}</td>
                    <td>${log.reps}</td>
                    <td>${log.weight}</td>
                    <td>${log.sets * log.reps * log.weight}</td>
                `;
                tbody.appendChild(tr);
            }
        });
    }
}

// Chart.js bar chart
function drawChart(data) {
    const ctx = chartCanvas.getContext("2d");
    if (window.chartInstance) window.chartInstance.destroy();
    window.chartInstance = new Chart(ctx, {
        type: "bar",
        data: {
            labels: data.map(log => log.date),
            datasets: [{
                label: "Volume Lifted",
                data: data.map(log => log.sets * log.reps * log.weight),
                backgroundColor: "#4CAF50"
            }]
        },
        options: {
            responsive: true,
            scales: {
                x: {title: {display: true, text: "Date"}},
                y: {title: {display: true, text: "Total Volume (lbs)"}}
            }
        }
    });
}

// Submit log form
form.addEventListener("submit", async e => {
    e.preventDefault();
    const log = {
        date: form.date.value,
        exercise: form.exercise.value,
        sets: parseInt(form.sets.value),
        reps: parseInt(form.reps.value),
        weight: parseInt(form.weight.value || 0),
        category: form.category.value,
        tags: parseTags(tagsInput.value)
    };
    await saveLog(log);
    form.reset();
    tagsInput.value = "";
});

// --- CIRCUIT BUILDER LOGIC ---
let circuitExercises = [];

function resetCircuitBuilder() {
    circuitExercises = [];
    circuitExercisesDiv.innerHTML = "";
}

function showCircuitBuilder(show = true) {
    circuitBuilder.style.display = show ? "" : "none";
    if (!show) resetCircuitBuilder();
}

function renderCircuitExercises() {
    circuitExercisesDiv.innerHTML = "";
    circuitExercises.forEach((ex, idx) => {
        const row = document.createElement("div");
        row.className = "circuit-exercise-row";
        row.innerHTML = `
            <input type="text" placeholder="Exercise" value="${ex.exercise || ""}" required title="Exercise name"/>
            <input type="number" placeholder="Sets" value="${ex.sets || ""}" required min="1" title="Sets"/>
            <input type="number" placeholder="Reps" value="${ex.reps || ""}" required min="1" title="Reps"/>
            <input type="number" placeholder="Weight" value="${ex.weight || ""}" min="0" title="Weight (lbs)"/>
            <select title="Category">
              <option value="Strength" ${ex.category === "Strength" ? "selected" : ""}>Strength</option>
              <option value="Cardio" ${ex.category === "Cardio" ? "selected" : ""}>Cardio</option>
              <option value="Flexibility" ${ex.category === "Flexibility" ? "selected" : ""}>Flexibility</option>
            </select>
            <input type="text" placeholder="Tags" value="${ex.tags ? ex.tags.join(",") : ""}" title="Tags"/>
            <button type="button" data-idx="${idx}" title="Remove exercise">&times;</button>
        `;
        row.querySelector("button").onclick = () => {
            circuitExercises.splice(idx, 1);
            renderCircuitExercises();
        };
        // Update values on change
        const inputs = row.querySelectorAll("input,select");
        inputs[0].oninput = e => { ex.exercise = e.target.value; };
        inputs[1].oninput = e => { ex.sets = parseInt(e.target.value) || 1; };
        inputs[2].oninput = e => { ex.reps = parseInt(e.target.value) || 1; };
        inputs[3].oninput = e => { ex.weight = parseInt(e.target.value) || 0; };
        inputs[4].onchange = e => { ex.category = e.target.value; };
        inputs[5].oninput = e => { ex.tags = parseTags(e.target.value); };
        circuitExercisesDiv.appendChild(row);
    });
}

if (addCircuitBtn) {
    addCircuitBtn.onclick = () => {
        showCircuitBuilder(true);
        resetCircuitBuilder();
        renderCircuitExercises();
    };
}
if (addExerciseToCircuitBtn) {
    addExerciseToCircuitBtn.onclick = () => {
        circuitExercises.push({
            exercise: "",
            sets: 1,
            reps: 1,
            weight: 0,
            category: "Strength",
            tags: []
        });
        renderCircuitExercises();
    };
}
if (cancelCircuitBtn) {
    cancelCircuitBtn.onclick = () => {
        showCircuitBuilder(false);
    };
}
if (saveCircuitBtn) {
    saveCircuitBtn.onclick = async () => {
        // Validate all exercises
        if (!circuitExercises.length || circuitExercises.some(ex => !ex.exercise || !ex.sets || !ex.reps)) {
            alert("Please fill out all exercises in the circuit.");
            return;
        }
        const date = form.date.value || new Date().toISOString().split("T")[0];
        const circuitLog = {
            date,
            isCircuit: true,
            exercises: circuitExercises.map(ex => ({
                exercise: ex.exercise,
                sets: ex.sets,
                reps: ex.reps,
                weight: ex.weight,
                category: ex.category,
                tags: ex.tags || []
            }))
        };
        await saveLog(circuitLog);
        showCircuitBuilder(false);
        form.reset();
    };
}

// --- SAVE LOG (support circuits) ---
async function saveLog(log) {
    // Use Firestore add or update logic here as in your existing code
    // For demo, just push to logs and re-render
    // Replace with your Firestore logic if needed
    // ...existing code for saving log...
    // This is a placeholder for Firestore integration
    // logs.push(log); // Not needed, fetchLogs will reload
    await fetchLogs();
}

// --- TAB SYSTEM: Click & Keyboard Navigation, Accessibility ---

// Remove one of the tab switcher implementations to avoid duplicate event handlers
// Keep only the simple DOMContentLoaded handler for tab switching:
document.addEventListener('DOMContentLoaded', () => {
    const buttons = document.querySelectorAll('#navbar [data-tab]');
    const tabs = document.querySelectorAll('.tab');

    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.getAttribute('data-tab');
            // Show the selected tab, hide others
            tabs.forEach(tab => {
                tab.classList.toggle('active', tab.getAttribute('data-tab') === tabName);
            });
            // Update aria-current for accessibility
            buttons.forEach(b => b.removeAttribute('aria-current'));
            btn.setAttribute('aria-current', 'page');
        });
    });
});

// --- CONNECTION TEST SCREEN ---
// Ensure modal is hidden on load
if (connectionTestModal) {
    connectionTestModal.style.display = "none";
}

if (openConnectionTestBtn && connectionTestModal) {
    openConnectionTestBtn.onclick = () => {
        connectionTestModal.style.display = "flex";
        connectionTestStatus.textContent = "Press the button to test connection to Firestore.";
    };
}
if (closeConnectionTestBtn && connectionTestModal) {
    closeConnectionTestBtn.onclick = () => {
        connectionTestModal.style.display = "none";
    };
}
// Hide modal if clicking outside the modal content
if (connectionTestModal) {
    connectionTestModal.addEventListener("click", (e) => {
        if (e.target === connectionTestModal) {
            connectionTestModal.style.display = "none";
        }
    });
}
if (runConnectionTestBtn && connectionTestStatus) {
    runConnectionTestBtn.onclick = async () => {
        connectionTestStatus.textContent = "Testing connection...";
        try {
            // Try to fetch a single document from logsRef
            const snapshot = await getDocs(logsRef);
            if (snapshot.size >= 0) {
                connectionTestStatus.textContent = "✅ Connection successful! Firestore is reachable.";
            } else {
                connectionTestStatus.textContent = "⚠️ Could not verify connection.";
            }
        } catch (err) {
            connectionTestStatus.textContent = "❌ Connection failed: " + (err.message || err);
        }
    };
}
