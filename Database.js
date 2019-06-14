// Cargamos la libreria SQLite
var sqlite = require('sqlite3').verbose();

let privates = new WeakMap();

// Disponemos la función que se devolvera en el proceso de consultas
var Database = function({databaseLocation}={}) {
    if(databaseLocation == undefined) return "Error: No se puede instanciar una base de datos sin especificar la ubicación de la misma.";    
    var savingPrivates = {
        dbloc : databaseLocation
    }

    privates.set(this, savingPrivates);

    var getDbInstance = function(object) {
        return privates.get(object).dbInstance;        
    }

    var setDbInstance = function(object, instance){
        // Obtenemos el conjunto de propiedades
        var privateProperties = privates.get(object);
        // Almacenamos los valores sobre las variables
        privateProperties.dbInstance = instance;
        // Guardamos la variable almacenada
        privates.set(object,privateProperties);
    }

    var getConnectionString = function(object) {
        return privates.get(object).dbloc;
    }

    var connect = function(object) {
        var promise = new Promise((resolve, reject) => {
            var connectionString = getConnectionString(object);
            // Obtenemos la instancia de la base
            var db = new sqlite.Database(connectionString, (err) => {
                // Validamos si hay errores
                if(err) return reject(console.log('Error conectando a la base de datos: ' + err.message));
                // Almacenamos la instancia de base de datos
                setDbInstance(object, db);
                // Si no existe error, damos por resuelta la conexión
                resolve();
            });

        });
        return promise;
    }

    var getAll = function({object, queryString, params} = {}){
        // Disponemos la query de prueba
        var promise = new Promise((resolve, reject) => {
            // obtenemos la instancia de la base
            var db = getDbInstance(object);
            // Validamos si está iniciada
            if(db == undefined) return reject('Error de conexión. La base no está iniciado.');
            // Ejecutamos la consulta
            db.all(queryString, params, (err, rows) => {
                // Validamos si existen errores antes de avanzar
                if(err) return reject('Error al realizar la consulta: ' + err.message);
                // Registramos los cambios
                setDbInstance(object, db);
                // Devolvemos el valor procesado
                resolve(rows);
            });            
        });
        return promise;
    }

    var run = function({object, queryString, params} = {}){
        var promise = new Promise((resolve,reject) => { 
            // Obtenemos el valor de la instancia
            var db = getDbInstance(object);
            // Validamos la existencia de la instancia
            if(db == undefined) return reject('Error al conectarse, conexión no iniciada');
            // Ejecutamos la consulta
            db.run(queryString, params, function(err){
                // Validamos si existen errores
                if(err) return reject('Error al correr la consulta: ' + err.message);
                // Guardamos el cambio de la instancia
                setDbInstance(object, db);
                // Si pasamos instancia de error significa que la operación salió correcta
                resolve();
            })
        });
        return promise;
    }

    var close = function(object) {
        var promise = new Promise((resolve, reject) => { 
            // Obtenemos la instancia privada de la base de datos
            var db = getDbInstance(object);
            // Validamos si está cargada la variable
            if(db == undefined) return reject(console.log('Error cerrando la conexión. La instancia no está generada'));
            // Cerramos la conexión utilizando la función dedicada
            db.close(function(err) { 
                // Validamos si existe errores
                if(err) return reject(console.log('Error cerrando la conexión :' + err.message));
                // Borramos la instancia de conexión
                setDbInstance(object, undefined);
                // Cerramos la operación
                resolve();
            });
        });
        
        return promise;
    }

    this.get = async({qs, pms} = {}) => {
        // Disponemos de un acumulador de resultados
        var resultados;
        // Ejecutamos la cadena de promesas esperando el resultado
        await connect(this).then(() => getAll({object: this, queryString:qs, params: pms})).then((filas) => resultados = filas).finally(() => close(this));
        return resultados;
    }

    this.run = async({qs, pms} = {}) => { 
        await connect(this).then(() => run({object: this, queryString: qs, params: pms})).finally(() => close(this));
    }
    return this;
}

// Exportamos el modulo de base de datos para trabajarlo
module.exports = Database;