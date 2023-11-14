var map = L.map("map").setView([0, 0], 2);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap contributors",
}).addTo(map);

// Load GeoJSON data
fetch("data.geojson")
  .then((response) => response.json())
  .then((data) => {
    // Create a marker cluster group
    var markers = L.markerClusterGroup();

    L.geoJSON(data, {
      onEachFeature: function (feature, layer) {
        // Create a popup with feature properties
        var popupContent = `
        <div class="popup">
            <h3>${feature.properties.name}</h3>
            <ul>
                <li><b>One Piece Wikia:</b> <a href='${feature.properties.onePieceWikia}' target='_blank'>${feature.properties.name}</a></li>
                <li><b>Real World Location:</b> ${feature.properties.realWorldLocation}</li>
                <li><b>Wikipedia:</b> <a href='${feature.properties.wikipedia}' target='_blank'>Link</a></li>
            </ul>
        </div>`;

        layer.bindPopup(popupContent);
        markers.addLayer(layer);
      },
    });

    // Add the marker cluster group to the map
    map.addLayer(markers);
  });
