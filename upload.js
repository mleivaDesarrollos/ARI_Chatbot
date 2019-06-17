var multer = require('multer');
var log = require('./Log');
var fs = require('fs');

module.exports = function(){        
    // Subida de archivos
    const MAX_UPLOAD_SIZE = 10485760;
    const MAX_UPLOAD_FILES = 5;
    const UPLOAD_PREFIX = "UPLOAD";
    const UPLOAD_PATH = "./uploads";
    const UPLOAD_MULTIPLE_FIELD = "upload_file[]";
    const SUPPORTED_FORMATS = ['text/plain', 'image', 'spreadsheet', 'pdf', 'wordprocessing', 'msword', 'excel', 'powerpoint', 'presentation', 'octet-stream', 'zip']
    const BASE_ERROR_LOG_PREFIX = "ERROR - UploadModule - ";
    let upload_number = 0;
    
    // Leemos el contenido de la carpeta de subidas
    fs.readdirSync(UPLOAD_PATH).forEach(file => {    
        // Validamos que el archivo tenga de nombre UPLOAD + NUMERO
        if(file.includes(UPLOAD_PREFIX)) {
            try{
                // Disponemos una expresión regular para obtener el numero de archivo
                let rg_get_number = /\d{6}/gmi;                
                // Removemos los componentes del nombre para dejar solo el número
                let number = parseInt(file.match(rg_get_number), 10);
                // Comparamos si el valor actual supera al valor guardado
                if(number > upload_number){
                    // Guardamos el valor máximo en la variable
                    upload_number = number;
                }
            } catch (e){
                console.log("Error obteniendo el proximo número de descarga " + e);
            }
    }});
    // Una vez localizado el número final de subida le incrementamos por uno
    upload_number++;
    
    //Configuramos la ubicación de subida de archivos en multer
    var storage = multer.diskStorage({
        destination: function(req, file, callback) {
            callback(null, UPLOAD_PATH);
        },
        filename: function(req, file, callback) {          
            let extension = file.originalname.match(/\.[^\.*]*$/gmi);
            if(extension == null) {
                // A los archivos sin extension se le pondrá por defecto como txt
                extension = ".txt";
            }
            callback(null, UPLOAD_PREFIX + String(upload_number).padStart(6, '0') + extension);
            upload_number++;                
        }    
    });

    let fileFilter = function(req, file, cb){        
        for(let formatIndex=0; formatIndex < SUPPORTED_FORMATS.length; formatIndex++) {
            if(file.mimetype.includes(SUPPORTED_FORMATS[formatIndex])){            
                return cb(null, true);
            }
        }
        cb(new Error("El tipo de archivo de " + file.originalname + " no está soportado."));
    }

    // Se chequea si el total de tamaño de archivos en conjunto no supera el máximo establecido
    let is_total_size_correct = function(files) {
        // Preparamos las opciones de logueo
        let ACTION_LOG = "isTotalSizeCorrect - ";
        let ERROR_LOG = BASE_ERROR_LOG_PREFIX + ACTION_LOG;
        // Dejamos un acumulador temporal de total de tamaño
        let total_size = 0;
        // Iteramos y almacenamos el total en el acumulador establecido
        files.forEach(file => {
            total_size += file.size;
        });        
        // Validamos si el tamaño supera los 10mb
        if(total_size > MAX_UPLOAD_SIZE){                
            files.forEach(file => {
                fs.unlink(file.destination + '/' + file.filename, function(err) {
                    if(err) {
                        log.Register(ERROR_LOG + err);
                    }
                });
            });

            return false;
        }
        return true;
    }

    this.upload_multiple_and_return_filenames = function({request, response} = {}) {
        let promise = new Promise((resolve, reject) => {
            try{
                // Configuramos las opciones de subida de archivo del API
                let upload_config = multer({ storage: storage, limits: {fileSize: MAX_UPLOAD_SIZE, files: MAX_UPLOAD_FILES}, fileFilter: fileFilter });
                // Inicializamos una instancia de array
                upload_config.array(UPLOAD_MULTIPLE_FIELD)(request, response, function(err){
                    // En caso de error se filtra
                    if(err){
                        let error = err;
                        switch(err.message){
                            case "Too many files":
                                error = new Error("Se ha superado el máximo de " + MAX_UPLOAD_FILES + " archivos por incidencia.");
                                break;
                            case "File too large":
                                error = new Error("Uno de los archivos que intento subir supero el máximo de " + MAX_UPLOAD_SIZE / 1024 / 1024 + "MB.")
                                break;
                        }
                        return reject(error);
                    }
                    if(is_total_size_correct(request.files) == true){                        
                        // Preparamos la variable para devolver el listado de nombres
                        let file_names = [];
                        // Iteramos sobre los nombres de archivos cargados
                        request.files.forEach(file => 
                            {                                
                                file_names.push({originalname: file.originalname , temporaryname: file.filename});
                            })
                        // Resolvemos la promesa con el listado de nombre de archivos
                        resolve(file_names);
                    } else { 
                        reject(new Error('El conjunto de archivos enviado supera el maximo de ' + MAX_UPLOAD_SIZE / 1024 / 1024 + 'MB.'));                    }                })
            } catch (e) {
                reject(e);
            }
        });
        // Devolvemos la promesa cargada
        return promise;
    }

    this.get_file_buffers_for_request_send = function({file_to_read} = {}){
        // Disponemos de constantes de logueo
        let ACTION_LOG = "GetFileBuffersForRequestSend - ";
        let ERROR_LOG = BASE_ERROR_LOG_PREFIX + ACTION_LOG;
        // Validamos que los datos de archivo hayan sido comunicados
        if(file_to_read == undefined) return log.Register(ERROR_LOG + "Faltaron los archivos a leer en la patición.");
        // Validamos si el nombre de archivo temporal esta cargado
        if(file_to_read.temporaryname == undefined) return log.Register(ERROR_LOG + "El campo nombre temporal no fue informado debidamente.")
        try {            
            // Realizamos la lectura de archivo y guardamos en un buffer temporal
            let buffer = fs.createReadStream(UPLOAD_PATH + '/' + file_to_read.temporaryname);
            // Almacenamos el buffer en el objeto a devolver
            file_to_read.buffer = buffer;
            // Devolvemos el file con el buffer agregado
            return file_to_read;
            
        } catch(e){ 
            return log.Register(ERROR_LOG + e.message);
        }

    }
    return this;
}