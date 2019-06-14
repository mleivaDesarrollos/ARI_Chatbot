const DATABASE = "./CMDB/localCMDB.db";
var database = require('../Database');

var getByUser = async({username} = {}) => {
    // Generamos una nueva instancia de base de datos
    var db = new database({databaseLocation:DATABASE})
    // Dejamos un acumulador de elementos que nos permite almacenar el listado de maquinas a procesar
    var workstations = [];
    // Ejecutamos la consulta a la base de datos
    await db.get({qs: "SELECT workstation FROM workstations WHERE username=?", pms: [username]}).then((totalMachines) => {
        totalMachines.forEach( machine => {
            // Agregamos la maquina al listado de máquinas
            workstations.push(machine.workstation);
        });
    })
    return workstations;// Devolvemos el listado de máquinas vinculado al usuario en cuestión
}

var getWorkstationLocation = async({username, workstation} = {}) => {
    // Generamos una nueva instancia de base de datos
    var db = new database({databaseLocation: DATABASE});
    // Preparamos la variable a devolver al final del proceso
    var location;
    // Ejecutamos la consulta parametrizando la consulta esperando el resultado
    await db.get({qs:"SELECT address from view_workstations_address WHERE username=? AND workstation=?", pms: [username, workstation]}).then((workstation_data) => {
        if(workstation_data[0]) { // Validamos si devuelve algún tipo de dato
            location = workstation_data[0].address;    
        }        
    });
    
    // Devolvemos el resultado procesado
    return location;
}

module.exports = {
    GetByUser: getByUser,
    GetWorkstationLocation: getWorkstationLocation
}