import {React, useState, useEffect} from 'react';
import Popup from 'reactjs-popup'
import {CITIES} from './cities-short.js';


function ControlBox() {

  let init_date = new Date(Date.now() - new Date().getTimezoneOffset()*60000).toJSON().slice(0,19);

  let [date, set_date] = useState(init_date);
  let [city_flag, set_city_flag] = useState(false);
  let [lat, set_lat] = useState(39);
  let [long, set_long] = useState(-76);

  const city_list = []

  for (let city of CITIES) {
    city_list.push(<option key={'id' + city.FIELD1 + city.FIELD3} value={'LAT'+city.FIELD3+'LNG'+city.FIELD4}>{city.FIELD1}</option>);
  }


  function dateChange(event) {
    set_date(event.target.value);
  }

  function citySelect(event) {
    const pattern = /LAT(-?\d+\.\d+)LNG(-?\d+\.\d+)/;
    const match = event.target.value.match(pattern);
    
    if (match) {
      const latitude = parseFloat(match[1]);
      const longitude = parseFloat(match[2]);
      set_lat(Math.floor(latitude* 100) / 100);
      set_long(Math.floor(longitude * 100) / 100);
      set_city_flag(!city_flag);
    } 


  }

  useEffect(() => {

    document.getElementById("lat").dispatchEvent(new Event("input"));
    document.getElementById("long").dispatchEvent(new Event("input"));

  }, [city_flag])


  useEffect(() => {
    const event = new Event('controlBoxMounted');
    document.dispatchEvent(event);
    console.log("dispatched");
  }, []);



  function changeLat(event){


    set_lat(event.target.value);
  }

  function changeLong(event){

    set_long(event.target.value);
  
  }

  return (
    <div>
      <div className="bg-white fixed p-2 top-1 left-1/2 -translate-x-1/2	z-10 flex align-middle justify-between w-3/4">
        <div>
          <p className="inline-block mr-2 font-extrabold p-1">Date:</p>
         <input className="inline-block mr-1 w-fit text-violet-600 p-1" type="datetime-local" value={date} onInput={dateChange} id="date"></input>
         <button id="date_button" className="bg-violet-600 rounded text-white p-1 text-sm">Change</button>
        </div>
        <div>
          <p className="inline-block mr-2 font-extrabold">Location:</p>
          <select className="text-violet-600" onInput={citySelect} defaultValue="LAT39.3051LNG-76.6144">
            {city_list}
          </select>
          Lat:
          <input className="inline-block mr-1 w-16 p-1 text-violet-600" id="lat" value={lat} onChange={changeLat}></input>
          Long:
          <input  className="inline-block mr-1 w-16 p-1 text-violet-600" id="long" value={long} onChange={changeLong}></input>
        </div>
      </div>
    </div>
  );
}

export default ControlBox;


/*Optional Settings Box, TODO
        <Popup trigger={<button className="text-xs pl-2 pr-2 pt-1 pb-1 bg-violet-200 hover:bg-violet-300 text-white rounded">Settings</button>} modal>
          <div className="bg-white p-3">
            <p className="text-lg font-bold mb-3">Settings</p>
            <div className="flex items-top mb-2">
              <label className="mr-3">Show Ecliptic Line</label>
              <input type="checkbox" id="show_ecliptic"/>
            </div>
            <div className="flex items-top mb-2">
              <label className="mr-3">Show Celestial Equator Line</label>
              <input type="checkbox" id="show_cel_eq"/>

            </div>
            <div className="text-xs text-right">Code: <a className="hover:text-gray-600" href="https://github.com/allenjiang17/star_explorer">allenjiang17.github.io/chess_react</a></div>
          </div>
        </Popup>

*/