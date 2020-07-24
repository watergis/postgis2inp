import {postgis2geojson} from '@watergis/postgis2geojson';
import {geojson2inp} from '@watergis/geojson2inp';
import fs from 'fs';

type Config = {
  geojson2inp : {
    title : string,
    geojson : { [key: string]: string },
    output : string,
  },
  postgis2geojson : {
    db : any,
    layers : Layer[]
  }
}

type Layer = {
  name: string;
  geojsonFileName: string; //File path for GeoJSON
  select: string; //SQL for PostGIS
};

class postgis2inp{
  constructor(private config : Config){}

  generate(){
    return new Promise<string>((resolve: (value?: string) => void, reject: (reason?: any) => void) =>{
      const pg2json = new postgis2geojson(this.config.postgis2geojson);
      let geojsonfiles : string[];
      pg2json.run().then((geojsons: string[])=>{
          geojsonfiles = geojsons;
          const config2 = this.config.geojson2inp;
          const js2inp = new geojson2inp(config2.geojson,config2.output, config2.title);
          return js2inp.generate()
      })
      .then(file=>{
        if (geojsonfiles && geojsonfiles.length > 0){
          geojsonfiles.forEach((f:string)=>{
            if (fs.existsSync(f)){
              fs.unlinkSync(f);
            }
          })
        }
        resolve(file);
      }).catch(err=>{
        reject(err);
      })
    })
    
  }
}

export default postgis2inp;