import {postgis2inp} from '../src/index';
import fs from 'fs';

describe('success case', (): void => {
  test('includes all assets', async() => {  
    const config = require('./config');
    const pg2inp = new postgis2inp(config);
    const file = await pg2inp.generate()
    expect(fs.existsSync(file)).toBeTruthy();
    if (fs.existsSync(file)){
      fs.unlinkSync(file);
    }
  });
})