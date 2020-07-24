# postgis2inp
![](https://github.com/watergis/postgis2inp/workflows/Node.js%20Package/badge.svg)
![GitHub](https://img.shields.io/github/license/watergis/postgis2inp)

This module is to create EPANET INP file directory from PostGIS

## Installation

```
npm install @watergis/postgis2inp
```

## Usage

```js
const {postgis2inp} = require('@watergis/postgis2inp');

const config = require('./config');
const pg2inp = new postgis2inp(config);
const file = await pg2inp.generate() //return exported inp file path
```

This module depends on the following two packages.
- [watergis/postgis2geojson](https://github.com/watergis/postgis2geojson): extract geojson files from PostGIS
- [watergis/geojson2inp](https://github.com/watergis/geojson2inp): convert geojson files into INP file.

You must configure SQLs for your PostGIS database, the sample of `config.js` is under [test](./test) directory. Please have a look of it.

## Build

```
npm run build
```

## Test

```
npm test
```