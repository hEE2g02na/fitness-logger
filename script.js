import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  enableIndexedDbPersistence
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Firebase config
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "XXXX",
  appId: "XXXX"
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
const summary = document.getElementById("weeklySummary");
const chartCanvas = document.getElementById("chart");
const syncStatus = document.getElementById("syncStatus");
const performanceSummary = document.getElementById("performanceSummary");

let logs = [];
let editingId = null;

// Theme toggle
document.getElementById("toggleTheme").addEventListener("click", () => {
  document.body.classList.toggle("dark");
});

// Layout preference
const layoutRadios = document.querySelectorAll('input[name="layout"]');
layoutRadios.forEach(radio =>
    radio.addEventListener("change", () => {
      const val = document.querySelector('input[name="layout"]:checked').value;
      document.body.classList.toggle("has-topnav", val === "top");
      document.body.classList.toggle("has-bottomnav", val === "bottom");
      localStorage.setItem("layout", val);
    })
);
const savedLayout = localStorage.getItem("layout") || "bottom";
document.body.classList.add(`has-${savedLayout}`);
document.querySelector(`input[value="${savedLayout}"]`).checked = true;

// Sync indicator
function updateSyncStatus() {
  if (!navigator.onLine) {
    syncStatus.textContent = "🔌 Offline Mode";
    syncStatus.style.background = "#f0ad4e";
  } else {
    syncStatus.textContent = "✅ Online";
    syncStatus.style.background = "#5cb85c";
  }
}
window.addEventListener("online", updateSyncStatus);
window.addEventListener("offline", updateSyncStatus);

// Fetch all logs
async function fetchLogs() {
  updateSyncStatus();
  const snapshot = await getDocs(logsRef);
  logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  renderLogs();
  updatePerformance();
}

// Save entry
async function saveLog(log) {
  if (editingId) {
    await updateDoc(doc(db, "logs", editingId), log);
    editingId = null;
  } else {
    await addDoc(logsRef, log);
  }
  await fetchLogs();
}

// Delete
window.deleteLog = async function (id) {
  await deleteDoc(doc(db, "logs", id));
  fetchLogs();
};

// Edit
window.editLogById = function (id) {
  const log = logs.find(l => l.id === id);
  if (log) {
    form.date.value = log.date;
    form.exercise.value = log.exercise;
    form.sets.value = log.sets;
    form.reps.value = log.reps;
    form.weight.value = log.weight;
    form.category.value = log.category;
    editingId = id;
    form.scrollIntoView({ behavior: "smooth" });
  }
};

// Render filtered logs
function renderLogs() {
  logList.innerHTML = "";
  const filtered = logs.filter(log =>
      (!filterExercise.value || log.exercise.toLowerCase().includes(filterExercise.value.toLowerCase())) &&
      (!filterDate.value || log.date === filterDate.value) &&
      (!filterCategory.value || log.category === filterCategory.value)
  );

  filtered.forEach(log => {
    const li = document.createElement("li");
    li.innerHTML = `
      <div>
        <strong>${log.date}</strong>: ${log.exercise} (${log.category}) –
        ${log.sets}x${log.reps} @ ${log.weight}lbs
      </div>
      <div>
        <button onclick='editLogById("${log.id}")'>✏️</button>
        <button onclick='deleteLog("${log.id}")'>🗑️</button>
      </div>
    `;
    logList.appendChild(li);
  });

  drawChart(filtered);
  updateSummary(filtered);
}

// Summary (past 7 days)
function updateSummary(data) {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const recent = data.filter(log => new Date(log.date) >= weekAgo);
  const total = recent.reduce((sum, log) => sum + log.sets * log.reps * log.weight, 0);
  summary.textContent = `Past 7 days: ${recent.length} workouts, ${total} lbs lifted`;
}

// Chart.js graph
function drawChart(data) {
  const ctx = chartCanvas.getContext("2d");
  if (window.chartInstance) window.chartInstance.destroy();
  const labels = data.map(log => log.date);
  const values = data.map(log => log.sets * log.reps * log.weight);
  window.chartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Volume Lifted",
        data: values,
        backgroundColor: "#4CAF50"
      }]
    },
    options: {
      responsive: true,
      scales: {
        x: { title: { display: true, text: "Date" } },
        y: { title: { display: true, text: "Total Volume (lbs)" } }
      }
    }
  });
}

// Submit form
form.addEventListener("submit", async e => {
  e.preventDefault();
  const log = {
    date: form.date.value,
    exercise: form.exercise.value,
    sets: parseInt(form.sets.value),
    reps: parseInt(form.reps.value),
    weight: parseInt(form.weight.value || 0),
    category: form.category.value
  };
  await saveLog(log);
  form.reset();
});

// Export
document.getElementById("exportJSON").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(logs, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "fitness-logs.json";
  a.click();
});

document.getElementById("exportCSV").addEventListener("click", () => {
  const csv = logs.map(log =>
      `${log.date},${log.exercise},${log.sets},${log.reps},${log.weight},${log.category}`
  ).join("\n");
  const blob = new Blob([`Date,Exercise,Sets,Reps,Weight,Category\n${csv}`], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "fitness-logs.csv";
  a.click();
});

// Filters
filterExercise.addEventListener("input", renderLogs);
filterDate.addEventListener("input", renderLogs);
filterCategory.addEventListener("change", renderLogs);

// Nav switching
document.querySelectorAll("#navbar button, #topnav button").forEach(btn =>
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll(".tab").forEach(div => {
        div.classList.remove("active");
        if (div.dataset.tab === tab) {
          setTimeout(() => div.classList.add("active"), 10);
        }
      });
    })
);

// Placeholder for Performance Tab
function updatePerformance() {
  if (!performanceSummary) return;
  performanceSummary.innerHTML = `
    <p>This tab will soon show trends in volume lifted, weekly comparisons, and personal bests.</p>
    <p>You'll see 📈 gains, 📉 dips, and highlights of your top lifts here!</p>
  `;
}

// Initialize
updateSyncStatus();
fetchLogs();