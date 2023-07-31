import * as THREE from 'three';
import {STAR_DATA} from './bsc5-short';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject} from 'three/addons/renderers/CSS2DRenderer.js';

//constants
const b1950 = new Date('01 Jan 1950 00:00:00 GMT').getTime()/1000; //not used
const vernal_equinox = new Date('20 Mar 2023 21:24:00 GMT').getTime()/1000; //latest equinox to set as zero point for sidereal time
const sidereal_day = 86164.0905;
const solar_day = 86400;
const dist = 100000;
const star_size = dist/200;
const earth_radius = 4000;
const sun_radius = 432690 * (dist/94443000) * 10;
const raycast_distance = dist*2;
const camera_distance = dist*2;

const PLANET_INFO= [{id: 199, name: "Mercury", color:0xF3F3F2},
{id: 299, name: "Venus", color:0xFFFCD1},
{id: 499, name: "Mars", color:0xF87E0B},
{id: 599, name: "Jupiter", color:0xffffff},
{id: 699, name: "Saturn", color:0xFFF9AB},
{id: 799, name: "Uranus", color:0x00BDFF},
{id: 899, name: "Neptune", color:0x00BDFF},
{id: 301, name: "Moon", color:0xFFFFFF}];


//global variables
let curr_date = Date.now()/1000; //milliseconds since 1970
let latitude;//degrees, positive is north
let longitude;//degrees, positive is east
let highlighted = [];
let rad_shift; //in radians
let planet_spheres = [];

//Wait until React Component is fully mounted
document.addEventListener('controlBoxMounted', main);

export function main() {

/*Initialization*********/
//initialize key elements
//confirm load_react.jsx has already finished
//

latitude = parseLat(document.getElementById("lat").value);
longitude = parseLong(document.getElementById("long").value);



const renderer = new THREE.WebGLRenderer();
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );

const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize( window.innerWidth, window.innerHeight );
labelRenderer.domElement.style.position = 'absolute';
labelRenderer.domElement.style.top = '0px';
document.body.appendChild( labelRenderer.domElement );

const scene = new THREE.Scene();
scene.background = new THREE.Color( 0x04002E );

const camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 1, camera_distance);
const controls = new OrbitControls( camera, labelRenderer.domElement );

camera.position.set(0, earth_radius, 0);
controls.target = new THREE.Vector3(0, earth_radius*1.0005, 0);
controls.update();

const raycaster = new THREE.Raycaster();
raycaster.far = raycast_distance;
raycaster.near = 0;
const pointer = new THREE.Vector2();

/* For debugging
const perp_line_geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0), new THREE.Vector3(0, dist, 0)]);
const perp_line= new THREE.Line(perp_line_geo);
scene.add(perp_line);
*/

const amb_light = new THREE.AmbientLight( 0x404040 ); // soft white light
scene.add(amb_light );

//event listeners
window.addEventListener( 'pointermove', onPointerMove );
window.addEventListener('wheel', render);
window.addEventListener(
    'resize',
      () => {
        const width = window.innerWidth;
        const height = window.innerHeight;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);        
        labelRenderer.setSize(width, height);
        /*
        const ratio = window.devicePixelRatio;
        renderer.domElement.width = width * ratio;
        renderer.domElement.height = height * ratio;
        renderer.domElement.style.width = `${width}px`;
        renderer.domElement.style.height = `${height}px`;
        */
      }

  );
document.getElementById("date_button").addEventListener("click", getDate);
document.getElementById("lat").addEventListener("input", changeLat);
document.getElementById("long").addEventListener("input", changeLong);

/************* */

/***STARS******* */
//star sphere
const star_sphere_geometry = new THREE.SphereGeometry(dist,128,128);
const star_sphere_material = new THREE.MeshBasicMaterial();
star_sphere_material.transparent = true;
star_sphere_material.opacity = 0.5;
const star_sphere = new THREE.Mesh(star_sphere_geometry, star_sphere_material);
//star_sphere.layers.set(1);
star_sphere.name = "StarSphere";

//X, Y, Z Axis Guides for Debugging
/*
const x_line_geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-dist,0,0), new THREE.Vector3(dist,0, 0)]);
const y_line_geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,-dist,0), new THREE.Vector3(0,dist, 0)]);
const z_line_geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0), new THREE.Vector3(0, 0, dist)]);

const x_line= new THREE.Line(x_line_geo);
const y_line= new THREE.Line(y_line_geo);
const z_line= new THREE.Line(z_line_geo);


star_sphere.add(x_line);
star_sphere.add(y_line);
star_sphere.add(z_line);
*/

scene.add(star_sphere);

//NSEW Labels
generateNSEWLabels();

//Altitude Azimuth Guidelines
generateAltAziGuidelines();

//Import Star Data and move to positions
for (let star of STAR_DATA) {

    let star_degrees = parseBSCstring(star.RA, star.Dec);
    let cart_coords = raDecToCartesian(star_degrees[0], star_degrees[1]);
    let star_mag = starSizeFromMagnitude(star.V);

    const star_geo = new THREE.SphereGeometry(star_mag,16,16);
    const star_mat= new THREE.MeshBasicMaterial();

    const star_obj = new THREE.Mesh(star_geo, star_mat);

    //create a larger sphere surrounding the star that can be selected, for easier mouseover
    const select_geo = new THREE.SphereGeometry(4*star_mag,16,16);
    const select_mat= new THREE.MeshBasicMaterial();
    select_mat.transparent = true;
    select_mat.opacity = 0.1;
    const select_obj = new THREE.Mesh(select_geo, select_mat);
    select_obj.name = "StarSelect";

    star.N !== undefined ? star_obj.name = star.N : star_obj.name = star.HR;
    star_obj.position.set(cart_coords[0]*dist, cart_coords[1]*dist, cart_coords[2]*dist);

    //create a label
    const starDiv = document.createElement( 'div' );
    starDiv.className = 'label';
    starDiv.innerHTML = `
    <div style="font-size:1.5rem; margin-bottom: 0.3rem;">${star_obj.name}</div>
    <p style="font-size:0.8rem; margin-top:0;">Magnitude: ${star.V}</br>Right Ascension: ${star.RA}</br>Declination: ${star.Dec}</p>`
    //starDiv.innerText = `${star_obj.name}\nMagnitude: ${star.V}\n Right Ascension: ${star.RA} \n Declination: ${star.Dec}`
    starDiv.style.backgroundColor = 'transparent';
    starDiv.style.color = 'white';

    const starLabel = new CSS2DObject(starDiv);
    starLabel.visible = false;
    starLabel.name = 'StarLabel';
    starLabel.position.set(0, star_mag, 0);
    starLabel.center.set(0,1);  

    star_obj.add(select_obj);
    star_obj.add(starLabel);
    star_sphere.add(star_obj);
}
//earth
const sphere_geometry = new THREE.SphereGeometry(earth_radius,64,64);
const sphere_material = new THREE.MeshLambertMaterial({color:0x00380F});
const sphere = new THREE.Mesh(sphere_geometry, sphere_material );
sphere.name = "Earth";
scene.add( sphere );

//sun
const sun_light = new THREE.DirectionalLight( 0xffffff, 2, 0);
const sun_geo = new THREE.SphereGeometry(sun_radius, 64,64);
const sun_sphere = new THREE.Mesh(sun_geo);
sun_sphere.name = "Sun";

let sun_coords = calculateSunPosition();
sun_light.position.set(sun_coords[0]*dist*1000, sun_coords[1]*dist*1000, sun_coords[2]*dist*1000);
sun_sphere.position.set(sun_coords[0]*dist, sun_coords[1]*dist, sun_coords[2]*dist);
sun_coords[1]*dist;

//add transparent layers for effects
let sun_shell_mat = new THREE.MeshBasicMaterial();
sun_shell_mat.transparent = true;
for (let i=1; i<25; i++) {
    sun_shell_mat.opacity = 1 - (i/25);
    let sun_shell = new THREE.Mesh(new THREE.SphereGeometry((i*0.2 + 1) * sun_radius, 64, 64), sun_shell_mat);
    sun_shell.name = "Sun";
    sun_sphere.add(sun_shell);
}

star_sphere.add(sun_sphere);
star_sphere.add(sun_light );

//celestial sphere equatorial line
let equa_line_points = [];
let eclip_line_points = [];
let circle_samples = 100;

const ecliptic_normal = new THREE.Vector3(sun_coords[0], sun_coords[1], sun_coords[2]).cross(new THREE.Vector3(1, 0, 0)).normalize();
const ecliptic_rot = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), ecliptic_normal);

for (let i = 0; i <= circle_samples; i++) {
    let theta = 2*Math.PI*i/circle_samples;
    let x = Math.cos(theta) * dist;
    let y = Math.sin(theta) * dist;

    equa_line_points.push(new THREE.Vector3(x, 0, y));
    eclip_line_points.push(new THREE.Vector3(x, 0, y).applyQuaternion(ecliptic_rot));
}

const equa_line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(equa_line_points),  new THREE.LineBasicMaterial({transparent: true, opacity: 0.5}));
const ecliptic = new THREE.Line(new THREE.BufferGeometry().setFromPoints(eclip_line_points), new THREE.LineBasicMaterial({color: 0xFFEA00, transparent: true, opacity: 0.8}));



star_sphere.add(equa_line);
star_sphere.add(ecliptic);

update_rotation();
init_planets();
render();

function onPointerMove( event ) {

	// calculate pointer position in normalized device coordinates
	// (-1 to +1) for both components
	pointer.x = ( event.clientX / window.innerWidth ) * 2 - 1;
	pointer.y = - ( event.clientY / window.innerHeight ) * 2 + 1;

    // update the picking ray with the camera and pointer position
	raycaster.setFromCamera( pointer, camera );

    //controls
    	// required if controls.enableDamping or controls.autoRotate are set to true
	//controls.update();

	// calculate objects intersecting the picking ray
	const intersects = raycaster.intersectObjects( star_sphere.children );

    //unhighlight old stuff
    for ( let i = 0; i < highlighted.length; i ++ ) {
        //highlighted[ i ].object.material.color.set( 0xffffff );
        highlighted[ i ].scale.set(1, 1, 1);
        highlighted[ i ].getObjectByName('StarLabel').visible = false;
    }

    highlighted = []; //reset highlighted to empty


	for ( let i = 0; i < intersects.length; i ++ ) {

        let selected = intersects[i].object;

        if (selected.name ===  "Earth" || selected.name === "Sun") {continue};

        if(selected.name === "StarSelect") {
            selected.parent.scale.set(2, 2, 2);
            //document.getElementById("star_name").innerText = selected.parent.name;
            selected.parent.getObjectByName('StarLabel').visible = true;
            highlighted.push(selected.parent);

        } 
	}
    render();
}


//main render loop
function render() {

    //window.requestAnimationFrame(render);
	controls.update();
	renderer.render( scene, camera );
    labelRenderer.render( scene, camera );


}



/*Handler for date change*/
async function getDate(event) {

    let date = document.getElementById("date").value;
    let newDate = new Date(date);
    if (newDate.valueOf() !== NaN) {
        curr_date = newDate.getTime()/1000;
        console.log(curr_date);
    }

    update_rotation();

    //update sun position
    let sun_coords = calculateSunPosition();
    sun_light.position.set(sun_coords[0]*dist, sun_coords[1]*dist, sun_coords[2]*dist);
    sun_sphere.position.set(sun_coords[0]*dist, sun_coords[1]*dist, sun_coords[2]*dist);


    //update planets
    
    let planet_data = await get_planetary_data();

    for (let i=0; i< planet_spheres.length; i++) {

       //console.log(planet_data[i]);
        //console.log(planet_spheres[i]);
        let new_planet_coords = raDecToCartesian(planet_data[i][0], planet_data[i][1]);

        if (planet_spheres[i].name === "Moon") {
            planet_spheres[i].position.set(new_planet_coords[0]*(dist), new_planet_coords[1]*(dist), new_planet_coords[2]*(dist));

        } else {
            planet_spheres[i].geometry.dispose();
            planet_spheres[i].geometry = new THREE.SphereGeometry(planet_data[i][2],16,16);
            planet_spheres[i].position.set(new_planet_coords[0]*dist, new_planet_coords[1]*dist, new_planet_coords[2]*dist);
        }

    }
    


}



/*Updates the rotation of the star sphere according to latitude, longitude or date changes*/
function update_rotation() {

    star_sphere.rotation.set( 0, 0, 0 );
    star_sphere.updateMatrix();

    //initial latitude and longitude rotation
    let lat_angle = ((90 - latitude) * (Math.PI / 180));
    let long_angle = -((longitude + 49) * (Math.PI / 180)); //manual adjustment so longitude matches 
    console.log(long_angle);

    star_sphere.rotateOnAxis(new THREE.Vector3(1, 0, 0), lat_angle);
    star_sphere.rotateOnAxis(new THREE.Vector3(0, 1, 0), long_angle);

    //initialize star sphere rotation
    rad_shift = -((curr_date - vernal_equinox) % sidereal_day/sidereal_day) * 2 * Math.PI;
    star_sphere.rotateOnAxis(new THREE.Vector3(0, 1, 0), rad_shift);



}


/*Handler for latitude change*/
function changeLat(event) {
    latitude = parseLat(event.target.value);
    update_rotation();
    render();
}


/*Handler for longitude change*/
function changeLong(event) {

    longitude = parseLong(event.target.value);
    update_rotation();
    render();

    
}


/*Parses string from the Bright Star Catalog into RA and Dec Degrees*/
function parseBSCstring(raString, decString) {

        //parse RA
        // Regular expression to extract hours, minutes, and seconds from the RA string
        const raRegex = /^(\d+)h (\d+)m ([\d.]+)s$/;

        // Extract hours, minutes, and seconds using the regular expression
        const ra_match = raString.match(raRegex);

        if (!ra_match) {
            throw new Error("Invalid RA format. Please use the format '00h 04m 36.7s'.");
        }

        const hours = parseFloat(ra_match[1]);
        const minutes = parseFloat(ra_match[2]);
        const seconds = parseFloat(ra_match[3]);

        // Calculate the total RA in degrees
        const raDegrees = (hours + minutes / 60 + seconds / 3600) * 15;
        //console.log(raDegrees);


    //parse DEC

            // Regular expression to extract degrees, minutes, and seconds from the Dec string
            const decRegex = /^([+-]?\d+)° (\d+)′ ([\d.]+)″$/;


            // Extract degrees, minutes, and seconds using the regular expression
            const dec_match = decString.match(decRegex);

            if (!dec_match) {
                throw new Error("Invalid Dec format. Please use the format '+42° 05′ 32″'.");
            }

            const dec_degrees = parseFloat(dec_match[1]);
            const dec_minutes = parseFloat(dec_match[2]);
            const dec_seconds = parseFloat(dec_match[3]);

            // Calculate the total Dec in degrees
            let decDegrees = Math.abs(dec_degrees) + dec_minutes / 60 + dec_seconds / 3600;

            // Add the sign for positive or negative Declination
            dec_match[0][0] === "-" ? decDegrees = -decDegrees : decDegrees = decDegrees;
            //console.log(decDegrees);

    return [raDegrees, decDegrees];
}

/*Converts RA and Dec into X, Y, Z coordinates*/
function raDecToCartesian(raDegrees, decDegrees){

    // Convert RA and Dec from degrees to radians
    const raRadians = -((raDegrees) * Math.PI) / 180; //set so that GMT 1950 for the star catalog matches
    const decRadians = (decDegrees * Math.PI) / 180;
  
    // Calculate Cartesian coordinates
    const x = Math.cos(raRadians) * Math.cos(decRadians);
    const y = Math.sin(raRadians) * Math.cos(decRadians);
    const z = Math.sin(decRadians);

    if (x === NaN || y === NaN || z === NaN) {
        console.log("Error, xyz not a number");
        return [0, 0, 0];
    }
  
    // Return the result as an object
    return [ x, z, y ];
  }


/*Sun position is calculated rather than retrieved from the Horizons API since it is relatively easier to calculate, reducing the number of requests we need to make*/
function calculateSunPosition() {

    let JD = 2451545.0 + (curr_date - (Date.UTC(2000, 0, 1)/1000))/(60 * 60 * 24);

    // Calculate the number of Julian centuries (T) from J2000.0
    const T = (JD - 2451545.0) / 36525;
  
    // Calculate the Sun's mean longitude (L) in degrees
    const L = 280.46646 + 36000.76983 * T + 0.0003032 * T ** 2;
    
    // Calculate the Sun's mean anomaly (M) in degrees
    const M = 357.52911 + 35999.05029 * T - 0.0001537 * T ** 2;
  
    // Calculate the Sun's eccentricity of Earth's orbit (e)
    const e = 0.016708634 - 0.000042037 * T - 0.0000001267 * T ** 2;
  
    // Calculate the Sun's equation of center (C) in degrees
    const C = (1.914602 - 0.004817 * T - 0.000014 * T ** 2) * Math.sin((M * Math.PI) / 180)
      + (0.019993 - 0.000101 * T) * Math.sin((2 * M * Math.PI) / 180)
      + 0.000289 * Math.sin((3 * M * Math.PI) / 180);
  
    // Calculate the Sun's true longitude (λ) in degrees
    const λ = L + C;
  
    // Calculate the Sun's mean obliquity of the ecliptic (ε) in degrees
    const ε = 23.439292 - 0.00013 * T;
  
    // Calculate the Sun's right ascension (RA) in degrees
    const RA = Math.atan2(Math.cos(ε * Math.PI / 180) * Math.sin(λ * Math.PI / 180), Math.cos(λ * Math.PI / 180)) * 180 / Math.PI;
  
    // Calculate the Sun's declination (Dec) in degrees
    const Dec = Math.asin(Math.sin(ε * Math.PI / 180) * Math.sin(λ * Math.PI / 180)) * 180 / Math.PI;

    console.log(raDecToCartesian(RA, Dec));

    return raDecToCartesian(RA, Dec);
  }



/*Gets Planetary Data from JPL Horizons API using a proxy serverless function in the API folder
Note: Each planet requires an individual HTTP get response, which is inefficient but this is how the Horizons API works
Horizons API also returns a text file which has to be parsed with specific indices, which isn't great

We get a day's worth of positions for our play button that simulates a day, so that we don't need to keep making requests
*/
async function get_planetary_data() {

    let target_date = new Date(curr_date*1000);
    let start_date_string = formatHorizonDate(target_date);
    let end_date = new Date(target_date.setHours(target_date.getHours()+1));
    let planet_data = [];

    let end_date_string = formatHorizonDate(end_date); 

    for (let planet of PLANET_INFO) {

        console.log("loading " + planet.name);

        let result = await fetch('api/get_horizon_data?' + new URLSearchParams({
            target: planet.id,
            start_date: start_date_string,
            stop_date: end_date_string
        }));
        let msg = await result.json();

        //console.log(msg.message.result);

        //hard-coded based on the Horizon API's response text. TODO: any ways around this?
        let data = msg.message.result.split('\n')[37].split(/\s+/);
        //console.log(data);
        let raDegrees = (parseFloat(data[3]) + parseFloat(data[4])/60 + parseFloat(data[5])/3600)*15;
        let decDegrees = (parseFloat(data[6]) + parseFloat(data[7])/60 + parseFloat(data[8])/3600);
        let planet_mag = starSizeFromMagnitude(parseFloat(data[27]));
    
        planet_data.push([raDegrees, decDegrees, planet_mag]);
    }

    return planet_data;
}


async function init_planets() {

    let planet_data = await get_planetary_data();

    for (let i=0; i < PLANET_INFO.length; i++) {

            let raDegrees = planet_data[i][0];
            let decDegrees = planet_data[i][1];
            let planet_mag = planet_data[i][2];


            let planet = PLANET_INFO[i];
            let planet_coords = raDecToCartesian(raDegrees, decDegrees);

            let planet_geo;
            let planet_obj;

            if (planet.name === "Moon") {
                planet_mag = sun_radius;
                planet_geo = new THREE.SphereGeometry(planet_mag, 16,16);
                planet_obj = new THREE.Mesh(planet_geo, new THREE.MeshLambertMaterial({color: planet.color}));
                planet_obj.position.set(planet_coords[0]*(dist), planet_coords[1]*(dist), planet_coords[2]*(dist));
                planet_obj.name = "Moon";

                //const moonlight = new THREE.PointLight( 0xff0000, 1, 0);
                //moonlight.position.set(0, 0,  1);
                //planet_obj.add(moonlight );

            } else {
                planet_geo = new THREE.SphereGeometry(planet_mag,16,16);
                planet_obj = new THREE.Mesh(planet_geo, new THREE.MeshBasicMaterial({color: planet.color}));
    
                //create a larger sphere surrounding the star that can be selected, for easier mouseover
                const select_geo = new THREE.SphereGeometry(4*planet_mag,16,16);
                const select_mat= new THREE.MeshBasicMaterial();
                select_mat.transparent = true;
                select_mat.opacity = 0.1;
                const select_obj = new THREE.Mesh(select_geo, select_mat);
        
                planet_obj.position.set(planet_coords[0]*dist, planet_coords[1]*dist, planet_coords[2]*dist);
                planet_obj.add(select_obj);

            }
    
            const planetDiv = document.createElement( 'div' );
            planetDiv.className = 'label';
            planetDiv.textContent = planet.name;
            planetDiv.style.backgroundColor = 'transparent';
            planetDiv.style.color = 'white';
    
            const planetLabel = new CSS2DObject( planetDiv );
            planetLabel.position.set(planet_mag*3, 0, 0);
            planetLabel.center.set( 0, 1 );
            planet_obj.add(planetLabel );
    
            star_sphere.add(planet_obj);
            planet_spheres.push(planet_obj);
        }

}


function formatHorizonDate(date) {

  
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const seconds = date.getSeconds();
    const milliseconds = date.getMilliseconds();
  
    return `'${year}-${month}-${day}%20${hours}:${minutes}'`;
  }

/*Returns a star size for the apparent magnitude (Vmag) of the star/planet*/
function starSizeFromMagnitude(vmag) {
    let max = 1500;
    let steep = 0.6;
    return max / (1 + Math.exp(steep*vmag));
    //return (Math.pow(3, -0.4 * vmag)*star_size); 

}

function generateAltAziGuidelines() {

    const radius = dist;
    const latLines = 12;
    const lonLines = 24;

    const LineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
    LineMaterial.transparent = true;
    LineMaterial.opacity = 0.1;


    const latStep = Math.PI / latLines;
    const lonStep = (2 * Math.PI) / lonLines;
  
    for (let lat = -Math.PI / 2; lat <= Math.PI / 2; lat += latStep) {
        const points = [];
        for (let lon = -Math.PI; lon <= Math.PI; lon += 0.1) {
          points.push(new THREE.Vector3(radius * Math.cos(lat) * Math.cos(lon), radius * Math.sin(lat), radius * Math.cos(lat) * Math.sin(lon)));
        }
        const latLineGeometry = new THREE.BufferGeometry().setFromPoints(points);
        const latLine = new THREE.Line(latLineGeometry, LineMaterial);
        scene.add(latLine);
      }
    
      // Longitude circles
      for (let lon = -Math.PI; lon <= Math.PI; lon += lonStep) {
        const points = [];
        for (let lat = -Math.PI / 2; lat <= Math.PI / 2; lat += 0.1) {
          points.push(new THREE.Vector3(radius * Math.cos(lat) * Math.cos(lon), radius * Math.sin(lat), radius * Math.cos(lat) * Math.sin(lon)));
        }
        const lonLineGeometry = new THREE.BufferGeometry().setFromPoints(points);
        const lonLine = new THREE.Line(lonLineGeometry, LineMaterial);
        scene.add(lonLine);
      }

}

function generateNSEWLabels() {

const northDiv = document.createElement( 'div' );
northDiv.className = 'label';
northDiv.textContent = 'North'
northDiv.style.backgroundColor = 'transparent';
northDiv.style.color = 'white';

const eastDiv = document.createElement( 'div' );
eastDiv.className = 'label';
eastDiv.textContent = 'East'
eastDiv.style.backgroundColor = 'transparent';
eastDiv.style.color = 'white';

const southDiv = document.createElement( 'div' );
southDiv.className = 'label';
southDiv.textContent = 'South'
southDiv.style.backgroundColor = 'transparent';
southDiv.style.color = 'white';

const westDiv = document.createElement( 'div' );
westDiv.className = 'label';
westDiv.textContent = 'West'
westDiv.style.backgroundColor = 'transparent';
westDiv.style.color = 'white';

const northLabel = new CSS2DObject(northDiv);
northLabel.position.set(0, earth_radius, dist);
northLabel.center.set(0,1);
scene.add(northLabel);

const southLabel = new CSS2DObject(southDiv);
southLabel.position.set(0, earth_radius, -dist);
southLabel.center.set(0,1);
scene.add(southLabel);

const westLabel = new CSS2DObject(westDiv);
westLabel.position.set(dist, earth_radius, 0);
westLabel.center.set(0,1);
scene.add(westLabel);

const eastLabel = new CSS2DObject(eastDiv);
eastLabel.position.set(-dist, earth_radius, );
eastLabel.center.set(0,1);
scene.add(eastLabel);

const east_geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0), new THREE.Vector3(-dist,0, 0)]);
const west_geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0), new THREE.Vector3(dist,0, 0)]);
const north_geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0), new THREE.Vector3(0, 0, dist)]);
const south_geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0), new THREE.Vector3(0, 0, -dist)]);

const north_line = new THREE.Line(north_geo, new THREE.LineBasicMaterial({color: 0xff0000}));
const south_line = new THREE.Line(south_geo, new THREE.LineBasicMaterial({color: 0x0000ff}));
const west_line = new THREE.Line(west_geo, new THREE.LineBasicMaterial({color: 0x00ffff}));
const east_line = new THREE.Line(east_geo, new THREE.LineBasicMaterial({color: 0x00ff00}));

scene.add(north_line);
scene.add(south_line);
scene.add(west_line);
scene.add(east_line);

}

/*Converts Latitude and Longitude to X, Y, Z Coordinates in an Earth centered frame. Not used*/
function llaToECEF(latitude, longitude, radius) {

    const latitudeRad = latitude * (Math.PI / 180);
    const longitudeRad = -longitude * (Math.PI / 180); //manual adjustment so longitude matches
    
    const cosLat = Math.cos(latitudeRad);
    const sinLat = Math.sin(latitudeRad);
    const cosLon = Math.cos(longitudeRad);
    const sinLon = Math.sin(longitudeRad);
    
    const x = (radius) * cosLat * cosLon;
    const y = (radius) * cosLat * sinLon;
    const z = (radius) * sinLat;
    
    return [ x,z,y ];
    }


function parseLat(value) {

    let lat = parseFloat(value);
    if (lat < -90 || lat > 90) {
        return NaN 
    } else {
        return lat;
    }


}

function parseLong(value) {
    let long = parseFloat(value);
    if (long < -180 || long > 180) {
        return NaN 
    } else {
        return long;
    }

}

function checkReactInit() {
    if (!document.getElementById("lat")) {
        return false
    } else {
        return true
    }

}

}