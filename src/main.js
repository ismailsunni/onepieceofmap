import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import L from "leaflet";
import "leaflet.markercluster";
import Papa from "papaparse";

// ── State ────────────────────────────────────────
let allFeatures = [];
let filteredFeatures = []; // { feature, index }
let markerMap = new Map();
let clusterGroup;
let activeIndex = null;
let userMarker = null;

// ── DOM refs ─────────────────────────────────────
const listEl = document.getElementById("location-list");
const searchInput = document.getElementById("search-input");
const countEl = document.getElementById("location-count");
const sortSelect = document.getElementById("sort-select");
const skeletonEl = document.getElementById("skeleton-list");
const detailPanel = document.getElementById("detail-panel");
const detailImg = document.getElementById("detail-img");
const detailName = document.getElementById("detail-name");
const detailLocation = document.getElementById("detail-location");
const detailOpLink = document.getElementById("detail-op-link");
const detailRwLink = document.getElementById("detail-rw-link");
const detailRwLabel = document.getElementById("detail-rw-label");

// ── Custom marker icon ───────────────────────────
function createMarkerIcon() {
  return L.divIcon({
    className: "",
    html: '<div class="custom-marker"><span class="custom-marker-inner">&#9875;</span></div>',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
}

// ── Custom cluster icons ─────────────────────────
function createClusterIcon(cluster) {
  const count = cluster.getChildCount();
  let size, cssClass;
  if (count < 5) {
    size = 36;
    cssClass = "cluster-small";
  } else if (count < 15) {
    size = 42;
    cssClass = "cluster-medium";
  } else {
    size = 50;
    cssClass = "cluster-large";
  }
  return L.divIcon({
    html: `<div class="custom-cluster ${cssClass}">${count}</div>`,
    className: "",
    iconSize: [size, size],
  });
}

// ── Map setup ────────────────────────────────────
const map = L.map("map", { zoomControl: false }).setView([20, 0], 2);

L.control.zoom({ position: "topright" }).addTo(map);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap contributors",
  maxZoom: 18,
}).addTo(map);

clusterGroup = L.markerClusterGroup({
  iconCreateFunction: createClusterIcon,
  showCoverageOnHover: false,
  maxClusterRadius: 50,
  spiderfyOnMaxZoom: true,
  animate: true,
});
map.addLayer(clusterGroup);

// ── Google Sheet data source ─────────────────────
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
    applyFilterAndSort();
    skeletonEl.classList.add("hidden");
  });

// ── Markers ──────────────────────────────────────
function addMarkers(features) {
  clusterGroup.clearLayers();
  markerMap.clear();

  features.forEach((feature, i) => {
    const [lng, lat] = feature.geometry.coordinates;
    const marker = L.marker([lat, lng], { icon: createMarkerIcon() });
    marker.on("click", () => openDetail(i));
    markerMap.set(i, marker);
    clusterGroup.addLayer(marker);
  });
}

// ── HTML escaping ────────────────────────────────
function esc(str) {
  const el = document.createElement("span");
  el.textContent = str;
  return el.innerHTML;
}

// ── Sidebar list ─────────────────────────────────
function renderList(items) {
  listEl.innerHTML = "";
  items.forEach(({ feature, index }) => {
    const li = document.createElement("li");
    li.className = "location-item";
    li.dataset.index = index;
    const initial = feature.properties.name.charAt(0).toUpperCase();
    li.innerHTML = `
      <div class="location-icon">${esc(initial)}</div>
      <div class="location-info">
        <h3>${esc(feature.properties.name)}</h3>
        <span class="real-location">${esc(feature.properties.realWorldLocation)}</span>
      </div>`;
    li.addEventListener("click", () => flyToFeature(index));
    listEl.appendChild(li);
  });
}

function updateCount(shown, total) {
  countEl.textContent = shown === total ? `${total} locations` : `${shown} of ${total} locations`;
}

// ── Filter & sort ────────────────────────────────
function applyFilterAndSort() {
  const q = searchInput.value.toLowerCase().trim();
  const sortBy = sortSelect.value;

  filteredFeatures = allFeatures
    .map((f, i) => ({ feature: f, index: i }))
    .filter(({ feature }) => {
      const p = feature.properties;
      return p.name.toLowerCase().includes(q) || p.realWorldLocation.toLowerCase().includes(q);
    });

  filteredFeatures.sort((a, b) => {
    const nameA = a.feature.properties.name.toLowerCase();
    const nameB = b.feature.properties.name.toLowerCase();
    return sortBy === "name-desc" ? nameB.localeCompare(nameA) : nameA.localeCompare(nameB);
  });

  renderList(filteredFeatures);
  updateCount(filteredFeatures.length, allFeatures.length);

  // Sync map markers
  clusterGroup.clearLayers();
  filteredFeatures.forEach(({ index }) => {
    const marker = markerMap.get(index);
    if (marker) clusterGroup.addLayer(marker);
  });
}

searchInput.addEventListener("input", applyFilterAndSort);
sortSelect.addEventListener("change", applyFilterAndSort);

// ── Fly to feature ───────────────────────────────
function flyToFeature(index) {
  const feature = allFeatures[index];
  const [lng, lat] = feature.geometry.coordinates;

  map.flyTo([lat, lng], 10, { duration: 1.2 });

  highlightListItem(index);
  openDetail(index);

  // Close sidebar on mobile
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

// ── Detail panel ─────────────────────────────────
function openDetail(index) {
  const feature = allFeatures[index];
  const p = feature.properties;

  highlightListItem(index);

  detailName.textContent = p.name;
  detailLocation.textContent = p.realWorldLocation;
  detailOpLink.href = p.onePieceWikia;
  detailRwLink.href = p.wikipedia;
  detailRwLabel.textContent = p.realWorldLocation;

  // Fetch Wikipedia thumbnail
  detailImg.classList.remove("loaded");
  detailImg.src = "";
  fetchWikiThumbnail(p.wikipedia).then((url) => {
    if (url) {
      detailImg.src = url;
      detailImg.alt = p.realWorldLocation;
      detailImg.onload = () => detailImg.classList.add("loaded");
    }
  });

  detailPanel.classList.add("open");
}

function closeDetail() {
  detailPanel.classList.remove("open");
  if (activeIndex !== null) {
    const prev = listEl.querySelector(`[data-index="${activeIndex}"]`);
    if (prev) prev.classList.remove("active");
    activeIndex = null;
  }
}

document.getElementById("detail-close").addEventListener("click", closeDetail);

// ── Wikipedia thumbnail fetch ────────────────────
async function fetchWikiThumbnail(wikiUrl) {
  try {
    const title = decodeURIComponent(wikiUrl.split("/wiki/")[1]);
    const apiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
    const resp = await fetch(apiUrl);
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.thumbnail?.source || data.originalimage?.source || null;
  } catch {
    return null;
  }
}

// ── Sidebar toggle (mobile) ─────────────────────
document.getElementById("sidebar-toggle").addEventListener("click", () => {
  document.getElementById("sidebar").classList.toggle("open");
});

// ── Locate me ────────────────────────────────────
const locateBtn = document.getElementById("locate-btn");
locateBtn.addEventListener("click", () => {
  if (!navigator.geolocation) return;
  locateBtn.classList.add("active");
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      if (userMarker) map.removeLayer(userMarker);
      userMarker = L.circleMarker([latitude, longitude], {
        radius: 8,
        fillColor: "#2e86c1",
        fillOpacity: 0.9,
        color: "#fff",
        weight: 2,
      }).addTo(map);
      map.flyTo([latitude, longitude], 6, { duration: 1 });
    },
    () => {
      locateBtn.classList.remove("active");
    },
  );
});

// ── Dark/light mode ──────────────────────────────
const themeToggle = document.getElementById("theme-toggle");
const savedTheme = localStorage.getItem("theme");
if (savedTheme) {
  document.documentElement.setAttribute("data-theme", savedTheme);
}

themeToggle.addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);
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

// Close detail panel on Escape
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeDetail();
    modal.classList.remove("open");
  }
});
