import type { CityDesignGeoPoint, CityDesignLocalPoint, CityDesignOrigin } from '../types';

const EARTH_RADIUS_METERS = 6378137;

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function projectGeoPointToLocal(
  point: CityDesignGeoPoint,
  origin: CityDesignOrigin
): CityDesignLocalPoint {
  const latRadians = toRadians(origin.lat);
  const x = toRadians(point.lon - origin.lon) * EARTH_RADIUS_METERS * Math.cos(latRadians);
  const z = toRadians(origin.lat - point.lat) * EARTH_RADIUS_METERS;

  return {
    x: Math.round(x * 1000) / 1000,
    z: Math.round(z * 1000) / 1000,
  };
}

export function unprojectLocalPointToGeo(
  point: CityDesignLocalPoint,
  origin: CityDesignOrigin
): CityDesignGeoPoint {
  const lat = origin.lat - (point.z / EARTH_RADIUS_METERS) * (180 / Math.PI);
  const lon =
    origin.lon +
    (point.x / (EARTH_RADIUS_METERS * Math.cos(toRadians(origin.lat)))) * (180 / Math.PI);

  return {
    lat,
    lon,
  };
}
