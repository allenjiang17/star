import * as THREE from 'three';
import {STAR_DATA} from './bsc5-short';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

//constants
const b1950 = new Date('01 Jan 1970 00:00:00 GMT').getTime()/1000;
const sidereal_day = 86164.1;
const solar_day = 86400;
const dist = 50000;
const star_size = dist/200;
const earth_radius = 4000;
const sun_radius = 432690 * (dist/94443000) * 10;
const raycast_distance = dist*2;
const camera_distance = dist*2;


//global variables
let curr_date = Date.now()/1000; //milliseconds since 1970
let latitude = 39; //degrees, positive is north
let longitude = -76; //degrees, positive is east
let highlighted = [];
let rad_shift; //in radians

/*Initialization*********/
//initialize key elements
const renderer = new THREE.WebGLRenderer();
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );

const scene = new THREE.Scene();
scene.background = new THREE.Color( 0x04002E );

const camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 1, camera_distance);
const controls = new OrbitControls( camera, renderer.domElement );
camera.position.set(0, earth_radius, 0);
controls.target = new THREE.Vector3(0, earth_radius*1.0001, 0);
controls.update();

const raycaster = new THREE.Raycaster();
raycaster.far = raycast_distance;
raycaster.near = 0;
const pointer = new THREE.Vector2();

const perp_line_geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0), new THREE.Vector3(0, dist, 0)]);
const perp_line= new THREE.Line(perp_line_geo);
scene.add(perp_line);

const amb_light = new THREE.AmbientLight( 0x404040 ); // soft white light
scene.add(amb_light );

//initialize display
document.getElementById("date").value = new Date(Date.now() - new Date().getTimezoneOffset()*60000).toJSON().slice(0,19); //need to add the timezone offset to the UTC time to get current time
document.getElementById("lat_display").innerText = latitude;
document.getElementById("long_display").innerText = longitude;
document.getElementById("lat").value = latitude;
document.getElementById("long").value = longitude;

//event listeners
window.addEventListener( 'pointermove', onPointerMove );
document.getElementById("date").addEventListener("change", getDate);
document.getElementById("lat").addEventListener("change", changeLat);
document.getElementById("long").addEventListener("change", changeLong);

/************* */

/***STARS******* */
//star sphere
const star_sphere_geometry = new THREE.SphereGeometry(dist,128,128);
const star_sphere_material = new THREE.MeshBasicMaterial();
star_sphere_material.transparent = true;
star_sphere_material.opacity = 0.5;
const star_sphere = new THREE.Mesh(star_sphere_geometry, star_sphere_material);
star_sphere.name = "StarSphere";

//X, Y, Z Axis Guides for Debugging
const x_line_geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-dist,0,0), new THREE.Vector3(dist,0, 0)]);
const y_line_geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,-dist,0), new THREE.Vector3(0,dist, 0)]);
const z_line_geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0), new THREE.Vector3(0, 0, dist)]);

const x_line= new THREE.Line(x_line_geo);
const y_line= new THREE.Line(y_line_geo);
const z_line= new THREE.Line(z_line_geo);

star_sphere.add(x_line);
star_sphere.add(y_line);
star_sphere.add(z_line);

scene.add(star_sphere);

//NSEW Lines
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



//Import Star Data and move to positions
for (let star of STAR_DATA) {

    let cart_coords = raDecToCartesian(star.RA, star.Dec);
    let star_mag = Math.pow(3, -0.4 * star.V)*star_size; //correct apparent magnitude is base 10^-0.4, but using base 3 so that dimmer stars can be seen

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

    star_obj.add(select_obj);
    star_sphere.add(star_obj);
}

//celestial sphere equatorial line
let circle_line_points = [];
let circle_samples = 100;
for (let i = 0; i <= circle_samples; i++) {
    let theta = 2*Math.PI*i/circle_samples;
    let x = Math.cos(theta) * dist;
    let y = Math.sin(theta) * dist;

    circle_line_points.push(new THREE.Vector3(x, 0, y));
}

const circle_line_geo = new THREE.BufferGeometry().setFromPoints(circle_line_points);
const equa_line = new THREE.Line(circle_line_geo);
star_sphere.add(equa_line);

//initial latitude and longitude rotation
let lat_angle = ((90 - latitude) * (Math.PI / 180));
let long_angle = -longitude * (Math.PI / 180); //manual adjustment so longitude matches 

star_sphere.rotateOnAxis(new THREE.Vector3(1, 0, 0), lat_angle);
star_sphere.rotateOnAxis(new THREE.Vector3(0, 1, 0), long_angle);

//initialize star sphere rotation
rad_shift = -((curr_date - b1950) % sidereal_day/sidereal_day) * 2 * Math.PI;
star_sphere.rotateOnAxis(new THREE.Vector3(0, 1, 0), rad_shift);

//earth
const sphere_geometry = new THREE.SphereGeometry(earth_radius,64,64);
const sphere_material = new THREE.MeshLambertMaterial(0x016C19);
const sphere = new THREE.Mesh(sphere_geometry, sphere_material );
sphere.name = "Earth";
scene.add( sphere );

//sun
const sun_light = new THREE.PointLight( 0xffffff, 2, 0);
const sun_geo = new THREE.SphereGeometry(sun_radius, 64,64);
const sun_sphere = new THREE.Mesh(sun_geo);
sun_sphere.name = "Sun";

let sun_coords = calculateSunPosition();
sun_light.position.set(sun_coords[0]*dist, sun_coords[1]*dist, sun_coords[2]*dist);
sun_sphere.position.set(sun_coords[0]*dist, sun_coords[1]*dist, sun_coords[2]*dist);

//add transparent layers for effects
let sun_shell_mat = new THREE.MeshBasicMaterial();
sun_shell_mat.transparent = true;
for (let i=1; i<100; i++) {
    sun_shell_mat.opacity = 1 - (i/100);
    let sun_shell = new THREE.Mesh(new THREE.SphereGeometry((i*0.2 + 1) * sun_radius, 64, 64), sun_shell_mat);
    sun_shell.name = "Sun";
    sun_sphere.add(sun_shell)
}

star_sphere.add(sun_sphere);
star_sphere.add(sun_light );


renderer.render( scene, camera );


//getPlanetaryData();
//render();



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
	const intersects = raycaster.intersectObjects( scene.children );

    //unhighlight old stuff
    for ( let i = 0; i < highlighted.length; i ++ ) {
        //highlighted[ i ].object.material.color.set( 0xffffff );
        highlighted[ i ].scale.set(1, 1, 1);
    }

    highlighted = [];


	for ( let i = 0; i < intersects.length; i ++ ) {

        let selected = intersects[i].object;

        if (selected.name ===  "Earth" || selected.name === "StarSphere" || selected.name === "Sun") {continue};

        if(selected.name === "StarSelect") {
            selected.parent.scale.set(3, 3, 3);
            document.getElementById("star_name").innerText = selected.parent.name;
            highlighted.push(selected.parent);

        } else {
            selected.scale.set(3, 3, 3);
            document.getElementById("star_name").innerText = selected.name;
            highlighted.push(selected);
        }

	}

	renderer.render( scene, camera );

}


//main render loop
/*
function render() {

    window.requestAnimationFrame(render);
	controls.update();
	renderer.render( scene, camera );

}
*/


function getDate(event) {

    let date = event.target.value;
    let newDate = new Date(date);
    if (newDate.valueOf() !== NaN) {
        curr_date = newDate.getTime()/1000;
    }


    update_rotation();

    //update sun position
    let sun_coords = calculateSunPosition();
    sun_light.position.set(sun_coords[0]*dist, sun_coords[1]*dist, sun_coords[2]*dist);
    sun_sphere.position.set(sun_coords[0]*dist, sun_coords[1]*dist, sun_coords[2]*dist);


    /*

    let new_rad_shift = -((curr_date - b1950) % sidereal_day/sidereal_day) * 2 * Math.PI;
    let rad_shift_delta = new_rad_shift - rad_shift;
    star_sphere.rotateOnAxis(new THREE.Vector3(0, 1, 0), rad_shift_delta);

    rad_shift = new_rad_shift;*/


}




function update_rotation() {

    star_sphere.rotation.set( 0, 0, 0 );
    star_sphere.updateMatrix();

    //initial latitude and longitude rotation
    let lat_angle = ((90 - latitude) * (Math.PI / 180));
    let long_angle = -longitude * (Math.PI / 180); //manual adjustment so longitude matches 

    star_sphere.rotateOnAxis(new THREE.Vector3(1, 0, 0), lat_angle);
    star_sphere.rotateOnAxis(new THREE.Vector3(0, 1, 0), long_angle);

    //initialize star sphere rotation
    rad_shift = -((curr_date - b1950) % sidereal_day/sidereal_day) * 2 * Math.PI;
    star_sphere.rotateOnAxis(new THREE.Vector3(0, 1, 0), rad_shift);



}


//rotates star sphere instead of changing camera angle
function changeLat(event) {
    latitude = event.target.value;
    document.getElementById("lat_display").innerText = latitude;

    update_rotation();

    /*
    let new_latitude = event.target.value;
    let latitude_delta = new_latitude - latitude;
    let long_angle = longitude * (Math.PI / 180) + (-rad_shift); //positive because we are shifting back to the 0 longitude position to shift latitude

    const lat_angle= (latitude_delta * (Math.PI / 180));

    star_sphere.rotateOnAxis(new THREE.Vector3(0, 1, 0), long_angle);
    star_sphere.rotateOnAxis(new THREE.Vector3(1, 0, 0), lat_angle);
    star_sphere.rotateOnAxis(new THREE.Vector3(0, 1, 0), -long_angle);


    document.getElementById("lat_display").innerText = new_latitude;
    latitude = new_latitude;
    */

}

function changeLong(event) {

    longitude = event.target.value;
    document.getElementById("long_display").innerText = longitude;

    update_rotation();

    /*
    let new_longitude = event.target.value;
    let longitude_delta = new_longitude - longitude;

    const long_angle = -longitude_delta * (Math.PI / 180); //manual adjustment so longitude matches 
    
    star_sphere.rotateOnAxis(new THREE.Vector3(0, 1, 0), long_angle);

    document.getElementById("long_display").innerText = new_longitude;
    longitude = new_longitude;
    */

    
}


function raDecToCartesian(raString, decString){
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

    
    // Convert RA and Dec from degrees to radians
    const raRadians = -(raDegrees * Math.PI) / 180; //set so that GMT 1950 for the star catalog matches
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
  
    //change to cartesian coords
    // Convert RA and Dec from degrees to radians
    const raRadians = -(RA * Math.PI) / 180; //set so that GMT 1950 for the star catalog matches
    const decRadians = (Dec * Math.PI) / 180;
  
    // Calculate Cartesian coordinates
    const x = Math.cos(raRadians) * Math.cos(decRadians);
    const y = Math.sin(raRadians) * Math.cos(decRadians);
    const z = Math.sin(decRadians);

    if (x === NaN || y === NaN || z === NaN) {
        console.log("NaN for Sun's position");
        return [0, 0, 0];
    }
  
    // Return the result as an object
    return [ x, z, y ];
  }
