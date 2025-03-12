Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIzNDE3YzQzYi05ZTE3LTRkZDgtYTQ5Zi04MGRkZTk1MTAxYzQiLCJpZCI6Mjc4NTg5LCJpYXQiOjE3NDE3NDk3Njl9.o7Xh0DDzWZwI9MZrjamB2JnRbIOb6OqV7HFNHKFJNL8'; // Замените на ваш токен Cesium Ion

// Инициализация Cesium с ночным слоем
const viewer = new Cesium.Viewer('cesiumContainer', {
    imageryProvider: new Cesium.IonImageryProvider({ assetId: 3812 }), // Earth at Night,
    terrainProvider: Cesium.createWorldTerrain(),
    animation: false,          // Убираем анимацию
    baseLayerPicker: true,    // Убираем выбор слоёв
    fullscreenButton: false,   // Убираем кнопку полноэкранного режима
    geocoder: false,           // Убираем поиск
    homeButton: false,         // Убираем кнопку "домой"
    infoBox: false,            // Убираем информационное окно
    sceneModePicker: false,    // Убираем выбор режима сцены
    selectionIndicator: false, // Убираем индикатор выбора
    timeline: false,           // Убираем временную шкалу
    navigationHelpButton: false, // Убираем помощь по навигации
    navigationInstructionsInitiallyVisible: false
});
viewer.cesiumWidget.creditContainer.style.display = "none";

// Центрируем камеру над Казахстаном (вид строго сверху)
viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(67, 48, 2400000), // Центр Казахстана, высота ~2400 км
    orientation: {
        heading: Cesium.Math.toRadians(0),  // Поворот камеры (0 - север)
        pitch: Cesium.Math.toRadians(-90), // Наклон строго вниз
        roll: 0
    }
});

Cesium.GeoJsonDataSource.load('kazakhstan.geojson')
      .then(function (dataSource) {
          viewer.dataSources.add(dataSource);
         const entities = dataSource.entities.values;
         for (let i = 0; i < entities.length; i++) {
              const entity = entities[i];
             entity.polygon.material = Cesium.Color.TRANSPARENT; // Убираем заливку
              entity.polygon.outline = true;
              entity.polygon.outlineColor = Cesium.Color.CYAN; // Голубой контур
             entity.polygon.outlineWidth = 4; // Делаем линию толще
             entity.polygon.outlineColor = Cesium.Color.CYAN.withAlpha(0.8); // Полупрозрачный неон
             }
})
.catch(error => console.error('Ошибка загрузки границ:', error));

let reservoirsData = [];

const ws = new WebSocket('ws://backend:8000/ws/reservoirs');
ws.onmessage = function(event) {
    const data = JSON.parse(event.data);
    updateReservoir(data);
};

function updateReservoir(data) {
    if (data.lat && data.lon) {
        const entity = viewer.entities.getOrCreateEntity(data.id);
        entity.position = Cesium.Cartesian3.fromDegrees(data.lon, data.lat);
        entity.billboard = {
            image: getColorCircle(data.fill_percent),
            scale: 0.5
        };
        entity.label = {
            text: `${data.name}: ${data.fill_percent}%`,
            font: '14px sans-serif',
            pixelOffset: new Cesium.Cartesian2(0, -20),
            fillColor: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2
        };
    }

    const existingIndex = reservoirsData.findIndex(r => r.id === data.id);
    if (existingIndex !== -1) {
        reservoirsData[existingIndex] = data;
    } else {
        reservoirsData.push(data);
    }

    updateLeftPanel();
    updateDashboard();
}

function getColorCircle(percent) {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    let color;
    if (percent >= 90) color = 'red';
    else if (percent >= 70) color = 'orange';
    else if (percent >= 50) color = 'yellow';
    else if (percent >= 30) color = 'green';
    else color = 'blue';
    ctx.beginPath();
    ctx.arc(16, 16, 14, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
    return canvas.toDataURL();
}

function updateLeftPanel() {
    const list = document.getElementById('reservoir-list');
    list.innerHTML = '';
    reservoirsData.forEach(data => {
        const item = document.createElement('li');
        item.id = `reservoir-${data.id}`;
        item.textContent = `${data.name}: ${data.fill_percent || 0}%`;
        if (data.fill_percent >= 90) item.className = 'critical';
        else if (data.fill_percent >= 70) item.className = 'warning';
        item.onclick = () => {
            const entity = viewer.entities.getById(data.id);
            if (entity) viewer.flyTo(entity, { duration: 1.5 });
        };
        list.appendChild(item);
    });
}

function updateDashboard() {
    const total = reservoirsData.length;
    const critical = reservoirsData.filter(r => r.fill_percent >= 90).length;
    const warning = reservoirsData.filter(r => r.fill_percent >= 70 && r.fill_percent < 90).length;
    const averageFilling = reservoirsData.length > 0
        ? (reservoirsData.reduce((sum, r) => sum + (r.fill_percent || 0), 0) / reservoirsData.length).toFixed(1)
        : 0;

    document.getElementById('total-reservoirs').textContent = total;
    document.getElementById('critical-count').textContent = critical;
    document.getElementById('warning-count').textContent = warning;
    document.getElementById('average-filling').textContent = `${averageFilling}%`;
}

// Инициализация существующих данных
fetch('http://backend:8000/api/reservoirs/all')
    .then(res => res.json())
    .then(reservoirs => {
        reservoirs.forEach(async r => {
            const response = await fetch(`http://backend:8000/api/reservoirs/${r.id}/latest`);
            const status = await response.json();
            updateReservoir({ id: r.id, name: r.name, lat: r.lat, lon: r.lon, fill_percent: status.filling || 0 });
        });
    });