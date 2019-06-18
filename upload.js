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
    const INTERVAL_CHECK_UPLOAD_FOLDER =  5 * 1000 * 60; // 5 Minutos
    const MAX_PRESERVE_TIME = 5 * 1000 * 60; // 5 Minutos

    const REMOVE_CHARACTERS_FROM_UPLOAD_FILE = /(?:UPLOAD\d{3}!|\..+)/gmi;
    const GET_DATE_FROM_FILENAME = /^(\d{2})-(\d{2})-(\d{4})/g;
    const GET_TIME_FROM_FILENAME = /(\d{2})-(\d{2})-(\d{2})$/g;
    const IS_UPLOAD_FILE = /UPLOAD/gmi;

    let upload_number = 0;
    
    function get_date_for_filenames(){
        // Obtenemos la fecha actual
        let current_date = new Date();
        // Separamos en componentes
        let day = String(current_date.getDate()).padStart(2,'0');
        let month = String(current_date.getMonth() +1).padStart(2,'0');
        let year = current_date.getFullYear();

        let hour = String(current_date.getHours()).padStart(2, '0');
        let minute = String(current_date.getMinutes()).padStart(2, '0');
        let seconds = String(current_date.getSeconds()).padStart(2, '0');
        // Devolvemos el valor procesado
        return day + "-"+ month + "-" + year + "_" + hour + "-" + minute + "-" + seconds;
    }
    
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
            // Obtenemos la fecha actual
            callback(null, UPLOAD_PREFIX + String(upload_number).padStart(3, '0') + "!" + get_date_for_filenames() + extension);
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
                            });
                        // Iniciamos el chequeo de archivos temporarios
                        this.StartCheckUploadFolder();
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
            // Preparamos el path del archivo
            let path = UPLOAD_PATH + '/' + file_to_read.temporaryname;
            // Realizamos la lectura de archivo y guardamos en un buffer temporal
            let buffer = fs.createReadStream(path);
            // Almacenamos el buffer en el objeto a devolver
            file_to_read.buffer = buffer;
            // Como el archivo ya no se necesita, se procede a eliminar del directorio temporal
            fs.unlink(path, function(err) {
                if(err) log.Register(ACTION_LOG + "No se pudo eliminar archivo " + file_to_read.temporaryname + " de la ruta " + UPLOAD_PATH + ". Detalle: " + err );
            });
            // Validamos si existen mas archivos para desvincular
            CheckIsFilesPendingToSend();            
            // Devolvemos el file con el buffer agregado
            return file_to_read;
            
        } catch(e){ 
            return log.Register(ERROR_LOG + e.message);
        }
    }

    this.remove_temporary_files = function({files_to_remove} ={}){
        // Disponemos de las variables de logueo
        let ACTION_LOG = "RemoveTemporaryFiles - ";
        let ERROR_LOG = BASE_ERROR_LOG_PREFIX + ACTION_LOG;
        // Validamos si se han comunicado los nombres de archivo a remover
        if(files_to_remove == undefined) return log.Register(ERROR_LOG + "No se comunicaron correctamente los nombres de archivo a desvincular");
        // Iteramos sobre todos los archivos recibidos
        for(let filesIndex = 0; filesIndex < files_to_remove.length; filesIndex++){
            // Separamos el archivo en una variable particular
            let file = files_to_remove[filesIndex];
            // Preparamos la ruta del archivo a eliminar
            let path = UPLOAD_PATH + '/' + file.temporaryname;
            // Ejecutamos la remoción efectiva del archivo
            fs.unlink(path, (err) => { 
                if(err) log.Register(ERROR_LOG + "Error al eliminar archivo " + file.temporaryname + " con nombre real " + file.originalname + ". Error: " + err);
            });
        }
    }

    let RemoveTemporaryUploadFiles = function() {        
        // Disponemos de la variable para log
        let ACTION_LOG = "CheckUploadFolder - ";
        let ERROR_LOG = BASE_ERROR_LOG_PREFIX + ACTION_LOG;
        fs.readdirSync(UPLOAD_PATH).forEach(file => {
            // Iteramos sobre toda la carpeta de archivos
            if(file.match(IS_UPLOAD_FILE)){
                // Si el archivo es de formato de subida de archivos

                // Removemos parte del archivo que no contenga fecha y hora
                let cleaned_date = file.replace(REMOVE_CHARACTERS_FROM_UPLOAD_FILE, '');
                
                // Obtenemos la sección de la fecha en el nombre de archivo
                let date = cleaned_date.match(GET_DATE_FROM_FILENAME)[0];
                // Obtenemos la sección del horario del archivo
                let time = cleaned_date.match(GET_TIME_FROM_FILENAME)[0];
                
                // Dividimos la fecha en Dia/MES/AÑO
                let splitted_date = date.split('-');
                // Dividimos la hora en Horas/Minutos/Segundos
                let splitted_time = time.split('-');
                
                // Construimos formato fecha en base a los componentes de fecha y hora                
                let file_date = new Date(splitted_date[2], splitted_date[1] - 1, splitted_date[0], splitted_time[0], splitted_time[1], splitted_time[2]);
                
                // Obtenemos la fecha actual
                current_date = new Date().getTime();
        
                // Calculamos la diferencia entre la fecha del archivo y la fecha actual
                let difference = current_date - file_date;
                
                if(difference > MAX_PRESERVE_TIME) {
                    // Si la fecha supera el máximo de tiempo de preservación
                    fs.unlinkSync(UPLOAD_PATH + "/" + file)
                }
            }
        });
        // Llamamos a la función que comprobará si aún hay archivos pendientes para enviar
        CheckIsFilesPendingToSend();
    }

    this.StartCheckUploadFolder = function(){        
        // Al llamar esta función se llama a iniciar el chequeo de intervalos
        this.interval = setInterval(RemoveTemporaryUploadFiles, INTERVAL_CHECK_UPLOAD_FOLDER);
    }

    var CheckIsFilesPendingToSend = function() {
        // Disponemos un acumulador que cuente los archivos
        let is_files_pending_to_send = false;
        // Iteramos sobre la carpeta
        let files = fs.readdirSync(UPLOAD_PATH);
        // Iteramos sobre todos los archivos encontrados
        for(let filesIndex = 0; filesIndex < files.length; filesIndex++){
            // Separamos el archivo
            let file = files[filesIndex];
            // Validamos si el archivo cumple con el requisito de archivo de subida
            if(file.match(IS_UPLOAD_FILE)){
                // En caso de ser encontrado se rompe con el ciclo
                is_files_pending_to_send = true;
                break;
            }
        }            
        // Validamos si el total de subidas de archivos fue 0
        if(is_files_pending_to_send == false){
            // Detenemos el chequeo llegado el caso de no encontrar mas archivos de subidas temporales
            clearInterval(this.interval);            
        }
    }
    return this;
}