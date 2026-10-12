/* exif_change – PWA géolocalisation EXIF */
(function () {
  'use strict';

  // ---------- State ----------
  let currentFile = null;
  let currentArrayBuffer = null;
  let currentDataURL = null;
  let origLat = null;
  let origLon = null;
  let editLat = null;
  let editLon = null;
  let mapOrig = null;
  let mapEdit = null;
  let markerOrig = null;
  let markerEdit = null;
  let baseLayers = {};

  // ---------- DOM ----------
  const $ = (sel) => document.querySelector(sel);
  const fileInput = $('#file-input');
  const dropZone = $('#drop-zone');
  const photoPreview = $('#photo-preview');
  const filenameEl = $('#filename');
  const importSection = $('#import-section');
  const photoSection = $('#photo-section');
  const exifSection = $('#exif-section');
  const editSection = $('#edit-section');
  const actionsSection = $('#actions-section');
  const noGps = $('#no-gps');
  const gpsInfo = $('#gps-info');
  const origLatEl = $('#orig-lat');
  const origLonEl = $('#orig-lon');
  const mapOrigEl = $('#map-orig');
  const mapEditEl = $('#map-edit');
  const editLatInput = $('#edit-lat');
  const editLonInput = $('#edit-lon');
  const basemapSelect = $('#basemap');
  const btnSave = $('#btn-save');
  const outNameEl = $('#out-name');
  const formatWarn = $('#format-warn');

  // ---------- Helpers ----------
  function fmtCoord(n) {
    if (n == null || isNaN(n)) return '—';
    return n.toFixed(4);
  }

  function isJpeg(file) {
    return file && (file.type === 'image/jpeg' || /\.jpe?g$/i.test(file.name));
  }

  function outFilename(name) {
    const i = name.lastIndexOf('.');
    if (i === -1) return name + '_loc';
    return name.slice(0, i) + '_loc' + name.slice(i);
  }

  // ---------- Leaflet layers ----------
  function createBaseLayers() {
    const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    });

    const ignPlan = L.tileLayer(
      'https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile' +
      '&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&FORMAT=image/png' +
      '&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',
      {
        maxZoom: 18,
        attribution: '<a href="https://www.ign.fr/">IGN</a> – Plan V2'
      }
    );

    const ignOrtho = L.tileLayer(
      'https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile' +
      '&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&FORMAT=image/jpeg' +
      '&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',
      {
        maxZoom: 19,
        attribution: '<a href="https://www.ign.fr/">IGN</a> – BD Ortho'
      }
    );

    return { osm, 'ign-plan': ignPlan, 'ign-ortho': ignOrtho };
  }

  function initMapEdit() {
    if (mapEdit) {
      mapEdit.remove();
      mapEdit = null;
      markerEdit = null;
    }
    baseLayers = createBaseLayers();
    mapEdit = L.map(mapEditEl, {
      center: [46.6, 2.4],
      zoom: 6,
      layers: [baseLayers.osm]
    });
    L.control.scale({ metric: true, imperial: false }).addTo(mapEdit);

    markerEdit = L.marker([46.6, 2.4], { draggable: true }).addTo(mapEdit);
    markerEdit.on('dragend', () => {
      const p = markerEdit.getLatLng();
      editLat = p.lat;
      editLon = p.lng;
      syncInputsFromMarker();
    });

    basemapSelect.value = 'osm';
    basemapSelect.onchange = () => {
      Object.values(baseLayers).forEach(l => mapEdit.removeLayer(l));
      baseLayers[basemapSelect.value].addTo(mapEdit);
    };
  }

  function initMapOrig(lat, lon) {
    if (mapOrig) {
      mapOrig.remove();
      mapOrig = null;
      markerOrig = null;
    }
    mapOrigEl.classList.remove('hidden');
    const layers = createBaseLayers();
    mapOrig = L.map(mapOrigEl, {
      center: [lat, lon],
      zoom: 14,
      layers: [layers.osm]
    });
    L.control.scale({ metric: true, imperial: false }).addTo(mapOrig);
    markerOrig = L.marker([lat, lon]).addTo(mapOrig);
    // petit contrôle de couches
    L.control.layers(
      { 'OSM': layers.osm, 'IGN Plan': layers['ign-plan'], 'IGN Ortho': layers['ign-ortho'] },
      null,
      { collapsed: true }
    ).addTo(mapOrig);
  }

  function syncInputsFromMarker() {
    editLatInput.value = editLat != null ? editLat.toFixed(6) : '';
    editLonInput.value = editLon != null ? editLon.toFixed(6) : '';
  }

  function syncMarkerFromInputs() {
    const lat = parseFloat(editLatInput.value);
    const lon = parseFloat(editLonInput.value);
    if (!isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
      editLat = lat;
      editLon = lon;
      if (markerEdit) {
        markerEdit.setLatLng([lat, lon]);
        mapEdit.panTo([lat, lon]);
      }
    }
  }

  editLatInput.addEventListener('change', syncMarkerFromInputs);
  editLonInput.addEventListener('change', syncMarkerFromInputs);
  editLatInput.addEventListener('input', () => {
    const lat = parseFloat(editLatInput.value);
    if (!isNaN(lat)) editLat = lat;
  });
  editLonInput.addEventListener('input', () => {
    const lon = parseFloat(editLonInput.value);
    if (!isNaN(lon)) editLon = lon;
  });

  // ---------- File handling ----------
  async function handleFile(file) {
    if (!file) return;
    currentFile = file;
    filenameEl.textContent = file.name;
    outNameEl.textContent = outFilename(file.name);
    formatWarn.classList.toggle('hidden', isJpeg(file));

    // Lire en ArrayBuffer + DataURL
    const buffer = await file.arrayBuffer();
    currentArrayBuffer = buffer;
    const blob = new Blob([buffer], { type: file.type || 'image/jpeg' });
    currentDataURL = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = rej;
      r.readAsDataURL(blob);
    });

    // Afficher la photo (dimensions écran)
    photoPreview.src = currentDataURL;
    photoPreview.onload = () => {
      // force layout
      photoSection.classList.remove('hidden');
    };
    photoPreview.onerror = () => {
      photoPreview.alt = 'Aperçu non disponible pour ce format';
      photoSection.classList.remove('hidden');
    };

    // EXIF GPS
    let gps = null;
    try {
      gps = await exifr.gps(file);
    } catch (e) {
      console.warn('exifr.gps error', e);
    }

    origLat = null;
    origLon = null;
    if (gps && typeof gps.latitude === 'number' && typeof gps.longitude === 'number') {
      origLat = gps.latitude;
      origLon = gps.longitude;
      noGps.classList.add('hidden');
      gpsInfo.classList.remove('hidden');
      origLatEl.textContent = fmtCoord(origLat);
      origLonEl.textContent = fmtCoord(origLon);
      initMapOrig(origLat, origLon);
      editLat = origLat;
      editLon = origLon;
    } else {
      noGps.classList.remove('hidden');
      gpsInfo.classList.add('hidden');
      mapOrigEl.classList.add('hidden');
      if (mapOrig) {
        mapOrig.remove();
        mapOrig = null;
      }
      // position par défaut (centre France)
      editLat = 46.603354;
      editLon = 1.888334;
    }

    // Section édition
    editSection.classList.remove('hidden');
    actionsSection.classList.remove('hidden');
    initMapEdit();
    markerEdit.setLatLng([editLat, editLon]);
    mapEdit.setView([editLat, editLon], origLat != null ? 14 : 6);
    syncInputsFromMarker();

    // Invalidate size after show
    setTimeout(() => {
      if (mapEdit) mapEdit.invalidateSize();
      if (mapOrig) mapOrig.invalidateSize();
    }, 150);
  }

  // ---------- Save ----------
  function degToDmsRational(degFloat) {
    // piexif GPSHelper or fallback
    if (window.piexif && piexif.GPSHelper && piexif.GPSHelper.degToDmsRational) {
      return piexif.GPSHelper.degToDmsRational(Math.abs(degFloat));
    }
    const degAbs = Math.abs(degFloat);
    const minFloat = (degAbs % 1) * 60;
    const secFloat = (minFloat % 1) * 60;
    const deg = Math.floor(degAbs);
    const min = Math.floor(minFloat);
    const sec = Math.round(secFloat * 100);
    return [[deg, 1], [min, 1], [sec, 100]];
  }

  async function saveWithGps() {
    if (!currentFile || editLat == null || editLon == null) return;
    if (isNaN(editLat) || isNaN(editLon)) {
      alert('Coordonnées invalides');
      return;
    }

    const name = outFilename(currentFile.name);

    if (!isJpeg(currentFile)) {
      // Télécharger l'original tel quel (pas d'écriture EXIF)
      const a = document.createElement('a');
      a.href = currentDataURL;
      a.download = name;
      a.click();
      return;
    }

    try {
      // Lire en binary string pour piexif
      const binary = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.onerror = rej;
        r.readAsBinaryString(currentFile);
      });

      let exifObj;
      try {
        exifObj = piexif.load(binary);
      } catch (e) {
        exifObj = { '0th': {}, Exif: {}, GPS: {} };
      }
      if (!exifObj.GPS) exifObj.GPS = {};

      const lat = editLat;
      const lon = editLon;
      exifObj.GPS[piexif.GPSIFD.GPSVersionID] = [2, 3, 0, 0];
      exifObj.GPS[piexif.GPSIFD.GPSLatitudeRef] = lat >= 0 ? 'N' : 'S';
      exifObj.GPS[piexif.GPSIFD.GPSLatitude] = degToDmsRational(lat);
      exifObj.GPS[piexif.GPSIFD.GPSLongitudeRef] = lon >= 0 ? 'E' : 'W';
      exifObj.GPS[piexif.GPSIFD.GPSLongitude] = degToDmsRational(lon);

      const exifBytes = piexif.dump(exifObj);
      const newBinary = piexif.insert(exifBytes, binary);

      // Binary string → Blob
      const len = newBinary.length;
      const arr = new Uint8Array(len);
      for (let i = 0; i < len; i++) arr[i] = newBinary.charCodeAt(i);
      const blob = new Blob([arr], { type: 'image/jpeg' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (err) {
      console.error(err);
      alert('Erreur lors de l\'écriture EXIF : ' + (err.message || err));
    }
  }

  btnSave.addEventListener('click', saveWithGps);

  // ---------- Drag & drop / input ----------
  fileInput.addEventListener('change', () => {
    if (fileInput.files && fileInput.files[0]) handleFile(fileInput.files[0]);
  });

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  });

  // ---------- Service Worker (brise-caches) ----------
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js', { scope: './' })
        .then((reg) => {
          // Forcer la vérification d'une nouvelle version
          reg.update();
          console.log('SW registered', reg.scope);
        })
        .catch((err) => console.warn('SW registration failed', err));
    });
  }
})();
