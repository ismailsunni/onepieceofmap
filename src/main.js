import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import L from "leaflet";
import "leaflet.markercluster";
import Papa from "papaparse";

// Fix default marker icon paths (Vite asset handling breaks them)
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

// ── State ────────────────────────────────────────
let allFeatures = [];
let markerMap = new Map(); // feature index → Leaflet marker
let clusterGroup;
let activeIndex = null;

// ── Map setup ────────────────────────────────────
const map = L.map("map").setView([20, 0], 2);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap contributors",
  maxZoom: 18,
}).addTo(map);

clusterGroup = L.markerClusterGroup();
map.addLayer(clusterGroup);

// ── Google Sheet as data source ──────────────────
const SHEET_ID = "1wNdaObivkhCiIIxVZJkJDg2N2LniYBzuPsdR4rl5us4";
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;

function csvToFeatures(csvText) {
  const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
  return parsed.data.map((row) => ({
    type: "Feature",
    properties: {
      name: row.name,
      onePieceWikia: row.onePieceWikia,
      realWorldLocation: row.realWorldLocation,
      wikipedia: row.wikipedia,
    },
    geometry: {
      type: "Point",
      coordinates: [parseFloat(row.longitude), parseFloat(row.latitude)],
    },
  }));
}

// ── Load data ────────────────────────────────────
fetch(CSV_URL)
  .then((r) => r.text())
  .then((csv) => {
    allFeatures = csvToFeatures(csv);
    addMarkers(allFeatures);
    renderList(allFeatures);
    updateCount(allFeatures.length, allFeatures.length);
  });

function addMarkers(features) {
  clusterGroup.clearLayers();
  markerMap.clear();

  features.forEach((feature, i) => {
    const [lng, lat] = feature.geometry.coordinates;
    const marker = L.marker([lat, lng]);
    marker.bindPopup(popupHTML(feature));
    marker.on("click", () => highlightListItem(i));
    markerMap.set(i, marker);
    clusterGroup.addLayer(marker);
  });
}

function popupHTML(feature) {
  const p = feature.properties;
  return `
    <div class="popup">
      <h3>${esc(p.name)}</h3>
      <div class="popup-links">
        <a href="${esc(p.onePieceWikia)}" target="_blank" rel="noopener">
          <span class="popup-tag op">OP</span> One Piece Wiki
        </a>
        <a href="${esc(p.wikipedia)}" target="_blank" rel="noopener">
          <span class="popup-tag rw">RW</span> ${esc(p.realWorldLocation)}
        </a>
      </div>
    </div>`;
}

function esc(str) {
  const el = document.createElement("span");
  el.textContent = str;
  return el.innerHTML;
}

// ── Sidebar list ─────────────────────────────────
const listEl = document.getElementById("location-list");
const searchInput = document.getElementById("search-input");
const countEl = document.getElementById("location-count");

function renderList(features) {
  listEl.innerHTML = "";
  features.forEach((feature, i) => {
    const li = document.createElement("li");
    li.className = "location-item";
    li.dataset.index = i;
    li.innerHTML = `
      <h3>${esc(feature.properties.name)}</h3>
      <span class="real-location">${esc(feature.properties.realWorldLocation)}</span>`;
    li.addEventListener("click", () => flyToFeature(i));
    listEl.appendChild(li);
  });
}

function updateCount(shown, total) {
  countEl.textContent = shown === total ? `${total} locations` : `${shown} of ${total} locations`;
}

function flyToFeature(index) {
  const feature = allFeatures[index];
  const [lng, lat] = feature.geometry.coordinates;
  map.setView([lat, lng], 13);

  const marker = markerMap.get(index);
  if (marker) {
    // Unspider the cluster so the marker is visible
    clusterGroup.zoomToShowLayer(marker, () => {
      marker.openPopup();
    });
  }

  highlightListItem(index);

  // Close sidebar on mobile after selecting
  if (window.innerWidth <= 768) {
    document.getElementById("sidebar").classList.remove("open");
  }
}

function highlightListItem(index) {
  if (activeIndex !== null) {
    const prev = listEl.querySelector(`[data-index="${activeIndex}"]`);
    if (prev) prev.classList.remove("active");
  }
  activeIndex = index;
  const el = listEl.querySelector(`[data-index="${index}"]`);
  if (el) {
    el.classList.add("active");
    el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
}

// ── Search / filter ──────────────────────────────
searchInput.addEventListener("input", () => {
  const q = searchInput.value.toLowerCase().trim();
  const filtered = allFeatures
    .map((f, i) => ({ feature: f, index: i }))
    .filter(({ feature }) => {
      const p = feature.properties;
      return p.name.toLowerCase().includes(q) || p.realWorldLocation.toLowerCase().includes(q);
    });

  // Re-render list with original indices
  listEl.innerHTML = "";
  filtered.forEach(({ feature, index }) => {
    const li = document.createElement("li");
    li.className = "location-item";
    li.dataset.index = index;
    li.innerHTML = `
      <h3>${esc(feature.properties.name)}</h3>
      <span class="real-location">${esc(feature.properties.realWorldLocation)}</span>`;
    li.addEventListener("click", () => flyToFeature(index));
    listEl.appendChild(li);
  });

  // Update markers to show only filtered
  clusterGroup.clearLayers();
  filtered.forEach(({ index }) => {
    const marker = markerMap.get(index);
    if (marker) clusterGroup.addLayer(marker);
  });

  updateCount(filtered.length, allFeatures.length);
});

// ── Sidebar toggle (mobile) ─────────────────────
document.getElementById("sidebar-toggle").addEventListener("click", () => {
  document.getElementById("sidebar").classList.toggle("open");
});

// ── About modal ──────────────────────────────────
const modal = document.getElementById("about-modal");

document.getElementById("about-btn").addEventListener("click", () => {
  modal.classList.add("open");
});

document.getElementById("modal-close").addEventListener("click", () => {
  modal.classList.remove("open");
});

modal.addEventListener("click", (e) => {
  if (e.target === modal) modal.classList.remove("open");
});
