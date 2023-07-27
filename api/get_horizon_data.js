export default async function get_horizon_data(request, response) {
    let target = request.query.target;
    let start_date = request.query.start_date;
    let stop_date = request.query.stop_date;    

    let result = await fetch(`https://ssd.jpl.nasa.gov/api/horizons.api?COMMAND=${target}&OBJ_DATA='NO'&START_TIME=${start_date}&STOP_TIME=${stop_date}&STEP_SIZE='60m'`);

    /*

    let result = await fetch('https://ssd.jpl.nasa.gov/api/horizons.api?' + new URLSearchParams({
        COMMAND: target,
        OBJ_DATA: 'NO',
        START_TIME: start_date,
        STOP_TIME: stop_date,
        STEP_SIZE: '60m'
    }));
    */
    let msg = await result.json();

    response.status(200).json({message: msg})

    return msg


}
