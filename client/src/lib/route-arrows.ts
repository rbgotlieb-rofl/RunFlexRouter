import mapboxgl from 'mapbox-gl';

type LngLat = [number, number];

function haversineKm(a: LngLat, b: LngLat): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * sinLng * sinLng;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function bearing(a: LngLat, b: LngLat): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const dLng = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function sampleArrowPoints(coordinates: LngLat[], spacingKm: number = 3): { point: LngLat; angle: number }[] {
  if (coordinates.length < 4) return [];

  let totalDist = 0;
  for (let i = 1; i < coordinates.length; i++) {
    totalDist += haversineKm(coordinates[i - 1], coordinates[i]);
  }

  const effectiveSpacing = totalDist < spacingKm * 1.5
    ? Math.max(totalDist / 3, 0.3)
    : spacingKm;

  const arrows: { point: LngLat; angle: number }[] = [];
  let accumulated = 0;
  let nextThreshold = effectiveSpacing * 0.4;

  for (let i = 1; i < coordinates.length; i++) {
    const prev = coordinates[i - 1];
    const curr = coordinates[i];
    const segDist = haversineKm(prev, curr);
    accumulated += segDist;

    if (accumulated >= nextThreshold && accumulated < totalDist * 0.95) {
      const lookBack = Math.max(i - 3, 0);
      const lookAhead = Math.min(i + 3, coordinates.length - 1);
      const angle = bearing(coordinates[lookBack], coordinates[lookAhead]);
      arrows.push({ point: curr, angle });
      nextThreshold = accumulated + effectiveSpacing;
    }
  }

  return arrows;
}

export function createArrowImage(map: mapboxgl.Map, imageName: string = 'route-arrow'): void {
  if (map.hasImage(imageName)) return;

  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, size, size);

  ctx.beginPath();
  ctx.moveTo(size / 2, 2);
  ctx.lineTo(size - 3, size - 4);
  ctx.lineTo(size / 2, size - 11);
  ctx.lineTo(3, size - 4);
  ctx.closePath();

  ctx.shadowColor = 'rgba(0,0,0,0.3)';
  ctx.shadowBlur = 2;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 1;

  ctx.fillStyle = '#1d4ed8';
  ctx.fill();

  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.stroke();

  const imageData = ctx.getImageData(0, 0, size, size);
  map.addImage(imageName, imageData, { sdf: false });
}

export function createChequeredFlagImage(map: mapboxgl.Map, imageName: string = 'chequered-flag'): void {
  if (map.hasImage(imageName)) return;

  const size = 40;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, size, size);

  ctx.shadowColor = 'rgba(0,0,0,0.3)';
  ctx.shadowBlur = 3;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 1;

  ctx.fillStyle = '#374151';
  ctx.fillRect(6, 4, 2, 34);

  ctx.shadowColor = 'transparent';

  const flagW = 22;
  const flagH = 16;
  const flagX = 8;
  const flagY = 4;
  const sq = 5.5;

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      const isBlack = (row + col) % 2 === 0;
      ctx.fillStyle = isBlack ? '#111827' : '#ffffff';
      const x = flagX + col * sq;
      const y = flagY + row * sq;
      const w = Math.min(sq, flagX + flagW - x);
      const h = Math.min(sq, flagY + flagH - y);
      ctx.fillRect(x, y, w, h);
    }
  }

  ctx.strokeStyle = '#374151';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(flagX, flagY, flagW, flagH);

  const imageData = ctx.getImageData(0, 0, size, size);
  map.addImage(imageName, imageData, { sdf: false });
}

export function createGreenFlagImage(map: mapboxgl.Map, imageName: string = 'green-flag'): void {
  if (map.hasImage(imageName)) return;

  const size = 40;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, size, size);

  ctx.shadowColor = 'rgba(0,0,0,0.3)';
  ctx.shadowBlur = 3;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 1;

  ctx.fillStyle = '#374151';
  ctx.fillRect(6, 4, 2, 34);

  ctx.shadowColor = 'transparent';

  const flagX = 8;
  const flagY = 4;
  const flagW = 22;
  const flagH = 16;

  ctx.fillStyle = '#22c55e';
  ctx.fillRect(flagX, flagY, flagW, flagH);

  ctx.strokeStyle = '#15803d';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(flagX, flagY, flagW, flagH);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('GO', flagX + flagW / 2, flagY + flagH / 2 + 1);

  const imageData = ctx.getImageData(0, 0, size, size);
  map.addImage(imageName, imageData, { sdf: false });
}

export function isAtoB(coordinates: LngLat[]): boolean {
  if (coordinates.length < 2) return false;
  const start = coordinates[0];
  const end = coordinates[coordinates.length - 1];
  const dist = haversineKm(start, end);
  return dist > 0.15;
}

export function addFlagLayers(
  map: mapboxgl.Map,
  startSourceId: string,
  startLayerId: string,
  coordinates: LngLat[],
  endSourceId?: string,
  endLayerId?: string
): void {
  const aToB = isAtoB(coordinates);
  const startImage = aToB ? 'green-flag' : 'chequered-flag';

  if (aToB) {
    createGreenFlagImage(map);
    createChequeredFlagImage(map);
  } else {
    createChequeredFlagImage(map);
  }

  const startGeojson: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature' as const,
      properties: {},
      geometry: { type: 'Point' as const, coordinates: coordinates[0] },
    }],
  };

  if (map.getSource(startSourceId)) {
    (map.getSource(startSourceId) as mapboxgl.GeoJSONSource).setData(startGeojson);
  } else {
    map.addSource(startSourceId, { type: 'geojson', data: startGeojson });
  }

  if (!map.getLayer(startLayerId)) {
    map.addLayer({
      id: startLayerId,
      type: 'symbol',
      source: startSourceId,
      layout: {
        'icon-image': startImage,
        'icon-size': 0.85,
        'icon-anchor': 'bottom-left',
        'icon-offset': [2, 0],
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
    });
  }

  if (aToB && endSourceId && endLayerId) {
    const endGeojson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature' as const,
        properties: {},
        geometry: { type: 'Point' as const, coordinates: coordinates[coordinates.length - 1] },
      }],
    };

    if (map.getSource(endSourceId)) {
      (map.getSource(endSourceId) as mapboxgl.GeoJSONSource).setData(endGeojson);
    } else {
      map.addSource(endSourceId, { type: 'geojson', data: endGeojson });
    }

    if (!map.getLayer(endLayerId)) {
      map.addLayer({
        id: endLayerId,
        type: 'symbol',
        source: endSourceId,
        layout: {
          'icon-image': 'chequered-flag',
          'icon-size': 0.85,
          'icon-anchor': 'bottom-left',
          'icon-offset': [2, 0],
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
      });
    }
  }
}

export function addArrowLayer(
  map: mapboxgl.Map,
  sourceId: string,
  layerId: string,
  coordinates: LngLat[],
  spacingKm: number = 3,
  color: string = '#1e3a5f'
): void {
  createArrowImage(map);

  const arrows = sampleArrowPoints(coordinates, spacingKm);
  if (arrows.length === 0) return;

  const geojson: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: arrows.map(({ point, angle }) => ({
      type: 'Feature' as const,
      properties: { angle },
      geometry: {
        type: 'Point' as const,
        coordinates: point,
      },
    })),
  };

  if (map.getSource(sourceId)) {
    (map.getSource(sourceId) as mapboxgl.GeoJSONSource).setData(geojson);
  } else {
    map.addSource(sourceId, { type: 'geojson', data: geojson });
  }

  if (!map.getLayer(layerId)) {
    map.addLayer({
      id: layerId,
      type: 'symbol',
      source: sourceId,
      layout: {
        'icon-image': 'route-arrow',
        'icon-size': 0.7,
        'icon-rotate': ['get', 'angle'],
        'icon-rotation-alignment': 'map',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
    });
  }
}
