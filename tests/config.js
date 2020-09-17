require('dotenv').config();

const export_dir = __dirname;
const epsg = 4326;
const wss_id = '50319';

module.exports = {
    geojson2inp:{
      title: `${wss_id} WSS`,
      geojson: {
        junctions: export_dir + '/junctions.geojson',
        pipes: export_dir + '/pipes.geojson',
        pumps: export_dir + '/pumps.geojson',
        reservoirs: export_dir + '/reservoirs.geojson',
        tanks: export_dir + '/tanks.geojson',
        valves: export_dir + '/data/valves.geojson'
      },
      output: __dirname + `/${wss_id}.inp`
    },
    postgis2geojson: {
      db: {
        user:process.env.DB_USER,
        password:process.env.DB_PASSWORD,
        host:process.env.DB_HOST,
        port:process.env.DB_PORT,
        database:'rwss_assets',
      },
      layers : [
        {
          name: 'junctions',
          geojsonFileName: export_dir + '/junctions.geojson',
          select: `
          WITH points2d AS (
            SELECT (ST_DumpPoints(geom)).geom AS geom 
            FROM pipeline 
            where wss_id=${wss_id}
          ),
          cells AS (
            SELECT 
              p.geom AS geom, 
              ST_Value(a.rast, 1, p.geom) AS alt, 
              ST_X(geom) as lon, ST_Y(geom) as lat
            FROM rwanda_dem_10m a 
            RIGHT JOIN points2d p 
            ON ST_Intersects(a.rast, p.geom)), 
          points3d AS (
            SELECT 
            row_number() OVER () as id,
            ST_SetSRID(COALESCE(ST_MakePoint(lon, lat, alt), 
            ST_MakePoint(lon, lat)), ${epsg}) AS geom, 
            lon, 
            lat, 
            alt 
            FROM cells
          ), 
          demands AS (
            SELECT connection_id, geom, COALESCE(cast(no_user as float)*80/86400,0.0) as demand 
            FROM water_connection 
          WHERE wss_id=${wss_id}
          ) 
          SELECT row_to_json(featurecollection) AS json FROM (
              SELECT
                'FeatureCollection' AS type,
                array_to_json(array_agg(feature)) AS features
              FROM (
                SELECT
                  'Feature' AS type,
                  ST_AsGeoJSON(ST_MakeValid(x.geom),4326)::json AS geometry,
                  row_to_json((
                    SELECT p FROM (
                      SELECT 
                      'Node-' || x.id as id,
                      st_x(x.geom) as lon, 
                      st_y(x.geom) as lat, 
                      st_z(x.geom)as elevation,
                      COALESCE(y.demand, 0.0) as demand 
                    ) AS p
                  )) AS properties
                FROM points3d x 
                LEFT JOIN demands y 
                ON x.geom && y.geom 
                WHERE x.geom is not NULL
              ) AS feature
            ) AS featurecollection
          `
        },
        {
            name: 'pipes',
            geojsonFileName: export_dir + '/pipes.geojson',
            select: `
            SELECT row_to_json(featurecollection) AS json FROM (
                SELECT
                  'FeatureCollection' AS type,
                  array_to_json(array_agg(feature)) AS features
                FROM (
                  SELECT
                    'Feature' AS type,
                    ST_AsGeoJSON(ST_MakeValid(x.geom),4326)::json AS geometry,
                    row_to_json((
                      SELECT p FROM (
                        SELECT
                          'Pipe-' || x.pipe_id as id, 
                          x.pipe_size as diameter
                      ) AS p
                    )) AS properties
                  FROM pipeline x
                  WHERE wss_id=${wss_id}
                ) AS feature
              ) AS featurecollection
            `
        },
        {
            name: 'reservoirs',
            geojsonFileName: export_dir + '/reservoirs.geojson',
            select: `
            SELECT row_to_json(featurecollection) AS json FROM (
                SELECT
                  'FeatureCollection' AS type,
                  array_to_json(array_agg(feature)) AS features
                FROM (
                  SELECT
                    'Feature' AS type,
                    ST_AsGeoJSON(ST_MakeValid(x.geom),4326)::json AS geometry,
                    row_to_json((
                      SELECT p FROM (
                        SELECT
                          COALESCE(x.source_type,'Reservoir') || '-' || x.watersource_id as id, 
                          st_x(x.geom) as lon, 
                          st_y(x.geom) as lat, 
                          x.elevation, 
                          x.source_type
                      ) AS p
                    )) AS properties
                  FROM watersource x
                  WHERE x.wss_id=${wss_id}
                ) AS feature
              ) AS featurecollection
            `
        },
        {
            name: 'tanks',
            geojsonFileName: export_dir + '/tanks.geojson',
            select: `
            SELECT row_to_json(featurecollection) AS json FROM (
                SELECT
                  'FeatureCollection' AS type,
                  array_to_json(array_agg(feature)) AS features
                FROM (
                  SELECT
                    'Feature' AS type,
                    ST_AsGeoJSON(ST_MakeValid(x.geom),4326)::json AS geometry,
                    row_to_json((
                      SELECT p FROM (
                        SELECT
                          'Tank-' || x.reservoir_id as id, 
                          st_x(x.geom) as lon, 
                          st_y(x.geom) as lat, 
                          x.elevation, 
                          x.capacity,
                          0.75 as init_level, 
                          0.15 as min_level, 
                          1.5 as max_level
                      ) AS p
                    )) AS properties
                  FROM reservoir x
                  WHERE x.wss_id=${wss_id}
                ) AS feature
              ) AS featurecollection
            `
        },
        {
            name: 'valves',
            geojsonFileName: export_dir + '/valves.geojson',
            select: `
            SELECT row_to_json(featurecollection) AS json FROM (
                SELECT
                  'FeatureCollection' AS type,
                  array_to_json(array_agg(feature)) AS features
                FROM (
                  SELECT
                    'Feature' AS type,
                    ST_AsGeoJSON(ST_MakeValid(x.geom),4326)::json AS geometry,
                    row_to_json((
                      SELECT p FROM (
                        SELECT
                          x.chamber_id as id, 
                          st_x(x.geom) as lon, 
                          st_y(x.geom) as lat,
                          x.elevation, 
                          max(a.pipe_size) as diameter,
                          case x.chamber_type when 'Valve chamber' then 'TCV' when 'PRV chamber' then 'PRV' END as valve_type
                      ) AS p
                    )) AS properties
                    FROM chamber x 
                    INNER JOIN pipeline a 
                    ON st_intersects(x.geom, a.geom)
                    WHERE x.wss_id = ${wss_id} 
                    AND x.chamber_type IN ('Valve chamber', 'PRV chamber')
                    GROUP BY x.chamber_id, x.geom, x.elevation
                ) AS feature
              ) AS featurecollection
            `
        },
        {
          name: 'pumps',
          geojsonFileName: export_dir + '/pumps.geojson',
          select: `
          SELECT row_to_json(featurecollection) AS json FROM (
              SELECT
                'FeatureCollection' AS type,
                array_to_json(array_agg(feature)) AS features
              FROM (
                SELECT
                  'Feature' AS type,
                  ST_AsGeoJSON(ST_MakeValid(x.geom),4326)::json AS geometry,
                  row_to_json((
                    SELECT p FROM (
                      SELECT
                        'Pump-' || x.pumpingstation_id as id, 
                        st_x(x.geom) as lon, 
                        st_y(x.geom) as lat,
                        x.elevation, 
                        x.head_pump as head, 
                        x.discharge_pump as discharge
                    ) AS p
                  )) AS properties
                  FROM pumping_station x 
                  WHERE x.wss_id = ${wss_id}
              ) AS feature
            ) AS featurecollection
          `
      }
    ],
    }
};