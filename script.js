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
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
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
function updateSummary(filteredData) {
    // Use filteredData for the summary text
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const recent = filteredData.filter(log => new Date(log.date) >= weekAgo);
    const total = recent.reduce((sum, log) => sum + log.sets * log.reps * log.weight, 0);
    summary.textContent = `Past 7 days: ${recent.length} workouts, ${total} lbs lifted`;

    // --- Fill summary table with last 7 days from ALL logs, not just filtered ---
    const summaryTable = document.getElementById("summaryTable");
    if (summaryTable) {
        const tbody = summaryTable.querySelector("tbody");
        tbody.innerHTML = "";
        // Always use the last 7 days from the full logs array
        const weekAgoAll = new Date();
        weekAgoAll.setDate(weekAgoAll.getDate() - 7);
        const recentAll = logs.filter(log => new Date(log.date) >= weekAgoAll);
        recentAll.forEach(log => {
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
                backgroundColor: window._userChartColor || "#4CAF50"
            }]
        },
        options: {
            responsive: true,
            animation: window._chartAnimation !== false,
            scales: {
                x: {
                    title: {display: true, text: "Date"},
                    grid: {display: window._showChartGridlines !== false}
                },
                y: {
                    title: {display: true, text: "Total Volume (lbs)"},
                    grid: {display: window._showChartGridlines !== false}
                }
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
    // Use table body for circuit exercises
    circuitExercisesDiv.innerHTML = "";
    circuitExercises.forEach((ex, idx) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><input type="text" placeholder="Exercise" value="${ex.exercise || ""}" required title="Exercise name" style="width:110px;"/></td>
            <td><input type="number" placeholder="Sets" value="${ex.sets || ""}" required min="1" title="Sets" style="width:55px;"/></td>
            <td><input type="number" placeholder="Reps" value="${ex.reps || ""}" required min="1" title="Reps" style="width:55px;"/></td>
            <td><input type="number" placeholder="Weight" value="${ex.weight || ""}" min="0" title="Weight (lbs)" style="width:70px;"/></td>
            <td>
                <select title="Category" style="width:100px;">
                  <option value="Strength" ${ex.category === "Strength" ? "selected" : ""}>Strength</option>
                  <option value="Cardio" ${ex.category === "Cardio" ? "selected" : ""}>Cardio</option>
                  <option value="Flexibility" ${ex.category === "Flexibility" ? "selected" : ""}>Flexibility</option>
                </select>
            </td>
            <td><input type="text" placeholder="Tags" value="${ex.tags ? ex.tags.join(",") : ""}" title="Tags" style="width:90px;"/></td>
            <td><button type="button" data-idx="${idx}" title="Remove exercise" style="color:#c00; font-size:1.2em; background:none; border:none; cursor:pointer;">🗑️</button></td>
        `;
        tr.querySelector("button").onclick = () => {
            circuitExercises.splice(idx, 1);
            renderCircuitExercises();
        };
        // Update values on change
        const inputs = tr.querySelectorAll("input,select");
        inputs[0].oninput = e => {
            ex.exercise = e.target.value;
        };
        inputs[1].oninput = e => {
            ex.sets = parseInt(e.target.value) || 1;
        };
        inputs[2].oninput = e => {
            ex.reps = parseInt(e.target.value) || 1;
        };
        inputs[3].oninput = e => {
            ex.weight = parseInt(e.target.value) || 0;
        };
        inputs[4].onchange = e => {
            ex.category = e.target.value;
        };
        inputs[5].oninput = e => {
            ex.tags = parseTags(e.target.value);
        };
        circuitExercisesDiv.appendChild(tr);
// --- EXERCISE LIBRARY DATA ---
        const EXERCISE_LIBRARY = [
            {
                name: "Bench Press",
                category: "Strength",
                tags: ["chest", "push", "barbell"],
                instructions: "Lie on a bench, grip the bar slightly wider than shoulder-width, lower to chest, press up.",
                img: "https://assets.fitnesslogger.app/exercises/bench-press.jpg"
            },
            {
                name: "Squat",
                category: "Strength",
                tags: ["legs", "barbell", "compound"],
                instructions: "Stand with feet shoulder-width, bar on upper back, squat down keeping chest up, drive up.",
                img: "https://assets.fitnesslogger.app/exercises/squat.jpg"
            },
            {
                name: "Deadlift",
                category: "Strength",
                tags: ["back", "legs", "barbell", "pull"],
                instructions: "Stand with feet hip-width, grip bar, keep back flat, lift by extending hips and knees.",
                img: "https://assets.fitnesslogger.app/exercises/deadlift.jpg"
            },
            {
                name: "Push Up",
                category: "Strength",
                tags: ["chest", "push", "bodyweight"],
                instructions: "Start in plank, lower chest to floor, keep elbows at 45°, push back up.",
                img: "https://assets.fitnesslogger.app/exercises/push-up.jpg"
            },
            {
                name: "Pull Up",
                category: "Strength",
                tags: ["back", "pull", "bodyweight"],
                instructions: "Hang from bar, pull chin above bar, lower with control.",
                img: "https://assets.fitnesslogger.app/exercises/pull-up.jpg"
            },
            {
                name: "Plank",
                category: "Flexibility",
                tags: ["core", "bodyweight"],
                instructions: "Hold a straight line from head to heels, elbows under shoulders, brace core.",
                img: "https://assets.fitnesslogger.app/exercises/plank.jpg"
            },
            {
                name: "Bicep Curl",
                category: "Strength",
                tags: ["arms", "dumbbell", "isolation"],
                instructions: "Hold dumbbells, curl up keeping elbows at sides, lower slowly.",
                img: "https://assets.fitnesslogger.app/exercises/bicep-curl.jpg"
            },
            {
                name: "Tricep Dip",
                category: "Strength",
                tags: ["arms", "push", "bodyweight"],
                instructions: "Hands on bench, lower body by bending elbows, press up.",
                img: "https://assets.fitnesslogger.app/exercises/tricep-dip.jpg"
            },
            {
                name: "Lunge",
                category: "Strength",
                tags: ["legs", "bodyweight"],
                instructions: "Step forward, lower until both knees at 90°, push back to start.",
                img: "https://assets.fitnesslogger.app/exercises/lunge.jpg"
            },
            {
                name: "Burpee",
                category: "Cardio",
                tags: ["full body", "bodyweight", "cardio"],
                instructions: "Squat, kick feet back, push up, jump up.",
                img: "https://assets.fitnesslogger.app/exercises/burpee.jpg"
            },
            {
                name: "Jump Rope",
                category: "Cardio",
                tags: ["cardio", "conditioning"],
                instructions: "Jump over rope with both feet, keep elbows close, turn rope with wrists.",
                img: "https://assets.fitnesslogger.app/exercises/jump-rope.jpg"
            },
            {
                name: "Mountain Climber",
                category: "Cardio",
                tags: ["core", "cardio", "bodyweight"],
                instructions: "Start in plank, alternate driving knees to chest quickly.",
                img: "https://assets.fitnesslogger.app/exercises/mountain-climber.jpg"
            }
            // Add more as needed
        ];

// --- EXERCISE LIBRARY UI ---
        const exerciseSearch = document.getElementById("exerciseSearch");
        const exerciseList = document.getElementById("exerciseList");

        function renderExerciseLibrary(filter = "") {
            if (!exerciseList) return;
            const q = (filter || "").toLowerCase();
            const filtered = EXERCISE_LIBRARY.filter(ex =>
                ex.name.toLowerCase().includes(q) ||
                ex.category.toLowerCase().includes(q) ||
                (ex.tags && ex.tags.some(tag => tag.includes(q)))
            );
            exerciseList.innerHTML = filtered.length
                ? filtered.map(ex => `
            <div class="exercise-card">
                <div class="exercise-card-title">${ex.name}</div>
                <img class="exercise-card-img" src="${ex.img}" alt="${ex.name} image" loading="lazy" />
                <div class="exercise-card-category">${ex.category}</div>
                <div class="exercise-card-instructions">${ex.instructions}</div>
                <div class="exercise-card-tags">${ex.tags.map(t => "#" + t).join(" ")}</div>
            </div>
        `).join("")
                : `<div style="grid-column:1/-1;text-align:center;color:#888;">No exercises found.</div>`;
        }

        if (exerciseSearch) {
            exerciseSearch.addEventListener("input", e => {
                renderExerciseLibrary(e.target.value);
            });
        }

        document.addEventListener("DOMContentLoaded", () => {
            renderExerciseLibrary();
        });

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
function initTabSwitcher() {
    const nav = document.getElementById('navbar');
    if (!nav) {
        console.warn('Navbar element with id="navbar" not found.');
        return;
    }
    const tabButtons = nav.querySelectorAll('button[data-tab]');
    const tabs = document.querySelectorAll('.tab');

    nav.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-tab]');
        if (btn) {
            const tabName = btn.getAttribute('data-tab');
            // Remove active/aria-current from all
            tabButtons.forEach(b => b.removeAttribute('aria-current'));
            tabs.forEach(tab => tab.classList.remove('active'));
            // Set active/aria-current on selected
            btn.setAttribute('aria-current', 'page');
            const activeTab = document.querySelector(`.tab[data-tab="${tabName}"]`);
            if (activeTab) activeTab.classList.add('active');
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initTabSwitcher();
    // --- SAMPLE DATA BUTTON ---
    document.addEventListener('DOMContentLoaded', () => {
        // Add single "Show All Samples" button to settings tab
        const settingsTab = document.querySelector('.tab[data-tab="settings"]');
        let sampleBtnContainer = document.getElementById("sampleButtons");
        if (settingsTab && sampleBtnContainer) {
            // Remove any old sample buttons
            sampleBtnContainer.innerHTML = "";

            // --- Show All Samples Button ---
            if (!document.getElementById("showAllSamplesBtn")) {
                const showAllBtn = document.createElement("button");
                showAllBtn.id = "showAllSamplesBtn";
                showAllBtn.type = "button";
                showAllBtn.textContent = "Show All Samples";
                showAllBtn.title = "Auto-fill the log form, circuit builder, chart, and table with sample/demo data";
                showAllBtn.onclick = async () => {
                    // 1. Fill log form
                    if (form) {
                        const today = new Date().toISOString().split("T")[0];
                        form.date.value = today;
                        form.exercise.value = "Bench Press";
                        form.sets.value = 4;
                        form.reps.value = 8;
                        form.weight.value = 135;
                        form.category.value = "Strength";
                        tagsInput.value = "push,chest";
                        // Optionally scroll to the log tab and highlight the form
                        const logTabBtn = document.querySelector('#navbar [data-tab="log"]');
                        if (logTabBtn) logTabBtn.click();
                        form.classList.add("highlight");
                        setTimeout(() => form.classList.remove("highlight"), 1200);
                    }

                    // 2. Fill circuit builder
                    if (circuitBuilder) {
                        showCircuitBuilder(true);
                        circuitExercises.length = 0;
                        circuitExercises.push(
                            {
                                exercise: "Push Up",
                                sets: 3,
                                reps: 15,
                                weight: 0,
                                category: "Strength",
                                tags: ["push", "bodyweight"]
                            },
                            {
                                exercise: "Squat",
                                sets: 3,
                                reps: 12,
                                weight: 0,
                                category: "Strength",
                                tags: ["legs", "bodyweight"]
                            },
                            {exercise: "Plank", sets: 3, reps: 1, weight: 0, category: "Flexibility", tags: ["core"]}
                        );
                        renderCircuitExercises();
                    }

                    // 3. Fill chart demo logs (unique dates, tag: chart)
                    const chartLogs = logs.filter(l => l.tags && l.tags.includes("chart"));
                    for (const log of chartLogs) {
                        if (log.id) {
                            // Remove from Firestore if possible
                            // await deleteLog(log.id); // Uncomment if you have deleteLog implemented
                        }
                    }
                    const today = new Date();
                    for (let i = 0; i < 7; i++) {
                        const d = new Date(today);
                        d.setDate(today.getDate() - i);
                        const log = {
                            date: d.toISOString().split("T")[0],
                            exercise: "Demo Chart " + (i + 1),
                            sets: 3 + i,
                            reps: 8,
                            weight: 100 + i * 10,
                            category: "Strength",
                            tags: ["chart", "demo" + (i + 1)]
                        };
                        await saveLog(log);
                    }

                    // 4. Fill table demo logs (unique dates, tag: table, offset so no overlap)
                    const tableLogs = logs.filter(l => l.tags && l.tags.includes("table"));
                    for (const log of tableLogs) {
                        if (log.id) {
                            // Remove from Firestore if possible
                            // await deleteLog(log.id); // Uncomment if you have deleteLog implemented
                        }
                    }
                    for (let i = 0; i < 7; i++) {
                        const d = new Date(today);
                        d.setDate(today.getDate() - i - 7);
                        const log = {
                            date: d.toISOString().split("T")[0],
                            exercise: "Demo Table " + (i + 1),
                            sets: 2 + i,
                            reps: 10,
                            weight: 80 + i * 5,
                            category: "Cardio",
                            tags: ["table", "demoTable" + (i + 1)]
                        };
                        await saveLog(log);
                    }

                    alert("Sample data filled: log form, circuit, chart, and table.");
                };
                sampleBtnContainer.appendChild(showAllBtn);
            }
        }
    });

    // --- DIAGNOSTICS TAB TOOLS ---
    const diagOut = document.getElementById("diagnosticsOutput");
    const btnTestConn = document.getElementById("diagTestConnection");
    const btnShowLS = document.getElementById("diagShowLocalStorage");
    const btnClearLS = document.getElementById("diagClearLocalStorage");
    const btnShowLogsCount = document.getElementById("diagShowLogsCount");
    const btnReload = document.getElementById("diagReload");
    // New tool buttons
    const btnShowUserAgent = document.getElementById("diagShowUserAgent");
    const btnShowScreenSize = document.getElementById("diagShowScreenSize");
    const btnShowAppVersion = document.getElementById("diagShowAppVersion");

    if (btnTestConn) {
        btnTestConn.onclick = async () => {
            diagOut.textContent = "Testing Firestore connection...";
            try {
                const snapshot = await getDocs(logsRef);
                diagOut.textContent = `✅ Firestore reachable. Log count: ${snapshot.size}`;
            } catch (e) {
                diagOut.textContent = "❌ Firestore connection failed: " + (e.message || e);
            }
        };
    }
    if (btnShowLS) {
        btnShowLS.onclick = () => {
            let out = "";
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                out += `${k}: ${localStorage.getItem(k)}\n`;
            }
            diagOut.textContent = out || "(Local storage is empty)";
        };
    }
    if (btnClearLS) {
        btnClearLS.onclick = () => {
            if (confirm("Clear all local storage? This will remove saved goals and settings.")) {
                localStorage.clear();
                diagOut.textContent = "Local storage cleared.";
            }
        };
    }
    if (btnShowLogsCount) {
        btnShowLogsCount.onclick = () => {
            diagOut.textContent = `Loaded logs in memory: ${logs.length}`;
        };
    }
    if (btnReload) {
        btnReload.onclick = () => {
            location.reload();
        };
    }
    if (btnShowUserAgent) {
        btnShowUserAgent.onclick = () => {
            diagOut.textContent = `User Agent:\n${navigator.userAgent}`;
        };
    }
    if (btnShowScreenSize) {
        btnShowScreenSize.onclick = () => {
            diagOut.textContent = `Screen Size:\n${window.innerWidth} x ${window.innerHeight} px`;
        };
    }
    if (btnShowAppVersion) {
        btnShowAppVersion.onclick = () => {
            diagOut.textContent = `App Version:\nFitness Logger v1.0.0`;
        };
    }

    // --- Toggle summary chart/table visibility ---
    document.addEventListener('DOMContentLoaded', () => {
        // Toggle summary chart/table
        const toggleBtn = document.getElementById("toggleSummaryVisuals");
        const visualsDiv = document.getElementById("summaryVisuals");
        if (toggleBtn && visualsDiv) {
            let visible = false;
            toggleBtn.onclick = () => {
                visible = !visible;
                visualsDiv.style.display = visible ? "" : "none";
                toggleBtn.querySelector("span:last-child").textContent = visible ? "Hide Chart & Table" : "Show Chart & Table";
            };
        }
    });

    // --- PREFERENCES TAB LOGIC ---
    document.addEventListener('DOMContentLoaded', () => {
        const prefForm = document.getElementById("preferencesForm");
        const prefTheme = document.getElementById("prefTheme");
        const prefFontSize = document.getElementById("prefFontSize");
        const prefPrimaryColor = document.getElementById("prefPrimaryColor");
        const prefChartColor = document.getElementById("prefChartColor");
        const prefRounded = document.getElementById("prefRounded");
        const prefCompact = document.getElementById("prefCompact");
        const prefDefaultCategory = document.getElementById("prefDefaultCategory");
        const prefChartType = document.getElementById("prefChartType");
        const prefStatus = document.getElementById("preferencesStatus");

        // --- New customization controls ---
        const prefFontFamily = document.getElementById("prefFontFamily"); // e.g. select
        const prefShowGridlines = document.getElementById("prefShowGridlines"); // e.g. checkbox
        const prefChartAnimation = document.getElementById("prefChartAnimation"); // e.g. checkbox
        const prefSidebarPosition = document.getElementById("prefSidebarPosition"); // e.g. select
        const prefAccentColor = document.getElementById("prefAccentColor"); // e.g. color input

        // --- New appearance controls ---
        const prefBorderRadius = document.getElementById("prefBorderRadius");
        const borderRadiusValue = document.getElementById("borderRadiusValue");
        const prefShadow = document.getElementById("prefShadow");
        const shadowValue = document.getElementById("shadowValue");
        const prefTransition = document.getElementById("prefTransition");
        const transitionValue = document.getElementById("transitionValue");

        // Show live value for sliders
        if (prefBorderRadius && borderRadiusValue) {
            prefBorderRadius.addEventListener("input", () => {
                borderRadiusValue.textContent = prefBorderRadius.value + "px";
            });
        }
        if (prefShadow && shadowValue) {
            prefShadow.addEventListener("input", () => {
                shadowValue.textContent = prefShadow.value + "px";
            });
        }
        if (prefTransition && transitionValue) {
            prefTransition.addEventListener("input", () => {
                transitionValue.textContent = prefTransition.value + "s";
            });
        }

        // Load preferences from localStorage
        function loadPreferences() {
            try {
                return JSON.parse(localStorage.getItem("fitnessPreferences")) || {};
            } catch {
                return {};
            }
        }

        // Save preferences to localStorage
        function savePreferences(prefs) {
            localStorage.setItem("fitnessPreferences", JSON.stringify(prefs));
        }

        // Apply preferences to UI
        function applyPreferences(prefs) {
            // Theme
            if (prefs.theme === "dark") {
                document.body.classList.add("dark");
            } else if (prefs.theme === "light") {
                document.body.classList.remove("dark");
            } else {
                document.body.classList.toggle("dark", window.matchMedia("(prefers-color-scheme: dark)").matches);
            }
            // Font size
            document.body.style.fontSize =
                prefs.fontSize === "large" ? "1.2em" :
                    prefs.fontSize === "xlarge" ? "1.4em" : "";
            // Primary color
            document.documentElement.style.setProperty('--primary-color', prefs.primaryColor || "#4CAF50");
            // Chart color (used in drawChart/drawMainChart)
            window._userChartColor = prefs.chartColor || "#4CAF50";
            // Rounded corners
            if (prefs.rounded) {
                document.body.classList.add("rounded");
            } else {
                document.body.classList.remove("rounded");
            }
            // Compact layout
            if (prefs.compact) {
                document.body.classList.add("compact");
            } else {
                document.body.classList.remove("compact");
            }
            // Default category for log form
            if (prefs.defaultCategory && form && form.category) {
                form.category.value = prefs.defaultCategory;
            }
            // Chart type (for future use)
            // You can use prefs.chartType in your chart rendering logic if desired

            // --- New preferences ---
            // Font family
            if (prefs.fontFamily) {
                document.body.style.fontFamily = prefs.fontFamily;
            } else {
                document.body.style.fontFamily = "";
            }
            // Chart gridlines
            window._showChartGridlines = prefs.showGridlines !== false; // default true
            // Chart animation
            window._chartAnimation = prefs.chartAnimation !== false; // default true
            // Sidebar position
            if (prefs.sidebarPosition === "right") {
                document.body.classList.add("sidebar-right");
                document.body.classList.remove("sidebar-left");
            } else {
                document.body.classList.add("sidebar-left");
                document.body.classList.remove("sidebar-right");
            }
            // Accent color
            if (prefs.accentColor) {
                document.documentElement.style.setProperty('--accent-color', prefs.accentColor);
            }
            // Border radius
            if (typeof prefs.borderRadius !== "undefined") {
                document.documentElement.style.setProperty('--border-radius', prefs.borderRadius + "px");
            }
            // Shadow
            if (typeof prefs.shadow !== "undefined") {
                document.documentElement.style.setProperty('--shadow', `0 2px ${prefs.shadow}px rgba(0,0,0,0.1)`);
            }
            // Transition
            if (typeof prefs.transition !== "undefined") {
                document.documentElement.style.setProperty('--transition', `all ${prefs.transition}s ease-in-out`);
            }
        }

        // Initialize preferences form with saved values
        if (prefForm && prefTheme && prefFontSize && prefPrimaryColor && prefChartColor && prefRounded && prefCompact && prefDefaultCategory && prefChartType) {
            const prefs = loadPreferences();
            if (prefs.theme) prefTheme.value = prefs.theme;
            if (prefs.fontSize) prefFontSize.value = prefs.fontSize;
            if (prefs.primaryColor) prefPrimaryColor.value = prefs.primaryColor;
            if (prefs.chartColor) prefChartColor.value = prefs.chartColor;
            if (prefs.rounded) prefRounded.checked = !!prefs.rounded;
            if (prefs.compact) prefCompact.checked = !!prefs.compact;
            if (prefs.defaultCategory) prefDefaultCategory.value = prefs.defaultCategory;
            if (prefs.chartType) prefChartType.value = prefs.chartType;

            // --- New preferences ---
            if (prefFontFamily && prefs.fontFamily) prefFontFamily.value = prefs.fontFamily;
            if (prefShowGridlines) prefShowGridlines.checked = prefs.showGridlines !== false;
            if (prefChartAnimation) prefChartAnimation.checked = prefs.chartAnimation !== false;
            if (prefSidebarPosition && prefs.sidebarPosition) prefSidebarPosition.value = prefs.sidebarPosition;
            if (prefAccentColor && prefs.accentColor) prefAccentColor.value = prefs.accentColor;
            if (prefBorderRadius && typeof prefs.borderRadius !== "undefined") {
                prefBorderRadius.value = prefs.borderRadius;
                if (borderRadiusValue) borderRadiusValue.textContent = prefs.borderRadius + "px";
            }
            if (prefShadow && typeof prefs.shadow !== "undefined") {
                prefShadow.value = prefs.shadow;
                if (shadowValue) shadowValue.textContent = prefs.shadow + "px";
            }
            if (prefTransition && typeof prefs.transition !== "undefined") {
                prefTransition.value = prefs.transition;
                if (transitionValue) transitionValue.textContent = prefs.transition + "s";
            }

            applyPreferences(prefs);

            prefForm.addEventListener("submit", e => {
                e.preventDefault();
                const newPrefs = {
                    theme: prefTheme.value,
                    fontSize: prefFontSize.value,
                    primaryColor: prefPrimaryColor.value,
                    chartColor: prefChartColor.value,
                    rounded: prefRounded.checked,
                    compact: prefCompact.checked,
                    defaultCategory: prefDefaultCategory.value,
                    chartType: prefChartType.value,
                    // --- New preferences ---
                    fontFamily: prefFontFamily ? prefFontFamily.value : "",
                    showGridlines: prefShowGridlines ? prefShowGridlines.checked : true,
                    chartAnimation: prefChartAnimation ? prefChartAnimation.checked : true,
                    sidebarPosition: prefSidebarPosition ? prefSidebarPosition.value : "left",
                    accentColor: prefAccentColor ? prefAccentColor.value : "",
                    borderRadius: prefBorderRadius ? parseInt(prefBorderRadius.value) : 8,
                    shadow: prefShadow ? parseInt(prefShadow.value) : 8,
                    transition: prefTransition ? parseFloat(prefTransition.value) : 0.25
                };
                savePreferences(newPrefs);
                applyPreferences(newPrefs);
                prefStatus.textContent = "Appearance saved!";
                setTimeout(() => {
                    prefStatus.textContent = "";
                }, 1500);
            });

            // Apply theme and appearance immediately on change
            [
                prefTheme, prefFontSize, prefPrimaryColor, prefChartColor, prefRounded, prefCompact,
                prefFontFamily, prefShowGridlines, prefChartAnimation, prefSidebarPosition, prefAccentColor,
                prefBorderRadius, prefShadow, prefTransition
            ].forEach(el => {
                if (el) {
                    el.addEventListener("change", () => {
                        applyPreferences({
                            theme: prefTheme.value,
                            fontSize: prefFontSize.value,
                            primaryColor: prefPrimaryColor.value,
                            chartColor: prefChartColor.value,
                            rounded: prefRounded.checked,
                            compact: prefCompact.checked,
                            defaultCategory: prefDefaultCategory.value,
                            chartType: prefChartType.value,
                            fontFamily: prefFontFamily ? prefFontFamily.value : "",
                            showGridlines: prefShowGridlines ? prefShowGridlines.checked : true,
                            chartAnimation: prefChartAnimation ? prefChartAnimation.checked : true,
                            sidebarPosition: prefSidebarPosition ? prefSidebarPosition.value : "left",
                            accentColor: prefAccentColor ? prefAccentColor.value : "",
                            borderRadius: prefBorderRadius ? parseInt(prefBorderRadius.value) : 8,
                            shadow: prefShadow ? parseInt(prefShadow.value) : 8,
                            transition: prefTransition ? parseFloat(prefTransition.value) : 0.25
                        });
                    });
                }
            });
        }
    });

    // --- Update chart rendering to use new preferences ---
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
                    backgroundColor: window._userChartColor || "#4CAF50"
                }]
            },
            options: {
                responsive: true,
                animation: window._chartAnimation !== false,
                scales: {
                    x: {
                        title: {display: true, text: "Date"},
                        grid: {display: window._showChartGridlines !== false}
                    },
                    y: {
                        title: {display: true, text: "Total Volume (lbs)"},
                        grid: {display: window._showChartGridlines !== false}
                    }
                }
            }
        });
    }

    // Test script for tab switcher (call manually if needed)
    function testTabSwitcher() {
        const tabButtons = document.querySelectorAll('button[data-tab]');
        const tabs = document.querySelectorAll('.tab');

        tabButtons.forEach((button) => {
            const tabName = button.getAttribute('data-tab');
            button.click();
            console.assert(
                button.getAttribute('aria-current') === 'page',
                `Failed: Button for tab "${tabName}" should have aria-current="page".`
            );
            const activeTab = document.querySelector(`.tab[data-tab="${tabName}"]`);
            console.assert(
                activeTab.classList.contains('active'),
                `Failed: Tab "${tabName}" should be active.`
            );
            tabs.forEach((tab) => {
                if (tab !== activeTab) {
                    console.assert(
                        !tab.classList.contains('active'),
                        `Failed: Tab "${tab.getAttribute('data-tab')}" should not be active.`
                    );
                }
            });
        });

        console.log('Tab switcher tests completed.');
    }

    // To run the test, call testTabSwitcher() from the browser console if needed.
});
