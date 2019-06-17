/* 
    Módulo de interacción con GLPI
    ------------------------------
    Este módulo está dispuesto para poder servir de interfaz entre el usuario y
    el sistema de ticketado interno de Megatech.

    Autor: Maximiliano Leiva
    Fecha: 08/05/2019

*/

// Disponemos de constantes de aplicación
    // URL de GLPI
    const URL_GLPI = "http://10.3.1.33";
    // Prefijo de error
    const GLPI_ERROR_LOG_PREFIX = "Error: GLPi - ";
    // Clave y usuario de MEGO
    const MEGO_AUTHORIZATION = "bWVnbzpNZWdvMjAxOS4=";
    // Id cargado en base de datos de GLPi, modificar en caso de producirse un cambio en base de datos
    const MEGO_GLPI_ID = 37;
    // Id de perfil de empleado
    const EMPLOYEE_PROFILE = 9;
    // Mensaje preestablecido de cierre de tickets en GLPi
    const MEGO_CLOSE_TICKET_MESSAGE = "Resolución automática de problema realizada por Mego - Chatbot.";
    // Mensaje preestablecido de cierre de tickets en followup
    const USER_CLOSE_TICKET_MESSAGE = "Se da conforme a la solución planteada por el chatbot.";
    // Al utilizar el header y querer modificarlo, realizar un clonado
    const GLPI_BASIC_HEADER = {"Content-Type" : "application/json"};
    // Disponemos del HEADER para subida de archivos
    const GLPI_UPLOAD_HEADER = {"Content-Type" : "multipart/form-data"};
    // URL para solicitar inicio de Sessión
    const URL_INITSESSION = URL_GLPI + "/apirest.php/initSession";
    // URL para Crear u Obtener ticket
    const URL_TICKET = URL_GLPI + "/apirest.php/Ticket";
    // URL para finalizar session
    const URL_KILLSESSION = URL_GLPI + "/apirest.php/killSession";
    // URL para obtener tickets de grupo
    const URL_GROUPTICKET = URL_GLPI + "/apirest.php/Group_Ticket";
    // URL para ticket de usuarios
    const URL_TICKETUSER = URL_GLPI + "/apirest.php/Ticket_User";
    // URL para administrar soluciones de tickets
    const URL_ITILSOLUTION = URL_GLPI + "/apirest.php/ITILSolution"
    // URL para administrar seguimiento de tickets
    const URL_ITILFOLLOWUP = URL_GLPI + "/apirest.php/ITILFollowup"
    // URL para cambiar el perfil activo
    const URL_CHANGEACTIVEPROFILE = URL_GLPI + "/apirest.php/changeActiveProfile";
    // URL para obtener las ubicaciones de la empresa
    const URL_LOCATIONS = URL_GLPI + "/apirest.php/Location";
    // URL para obtener información de los usuarios en GLPI
    const URL_USERS = URL_GLPI + "/apirest.php/User";
    // URL para obtener máquinas
    const URL_COMPUTER = URL_GLPI + "/apirest.php/search/Computer?is_deleted=0&criteria[0][field]=70&criteria[0][searchtype]=equals&criteria[0][value]=%user_id%&criteria[1][link]=AND&criteria[1][field]=31&criteria[1][searchtype]=contains&criteria[1][value]=En uso&withindexes=true";
    // URL para cargar items dentro de los tickets
    const URL_ITEM_TICKET = URL_GLPI + "/apirest.php/Item_Ticket";
    // URL para cargar documentos en tickets
    const URL_DOCUMENT_UPLOAD = URL_GLPI + "/apirest.php/Document";
    // URL para vincular documentos a tickets
    const URL_DOCUMENT_ITEM = URL_GLPI + "/apirest.php/Document_Item";

    // ID de estado de Inventario
    const COMPUTER_NAME_FIELD = 1;



// Cargamos la librería request
var request = require('request');
// Cargamos el sistema de logs
var log = require('../Log');

function get_error_message_from_api(response) {
    const ERROR_DETAILS_FROM_API = 1;
    if(response.length == 2) {
        return response[ERROR_DETAILS_FROM_API];
    }
}

// Función que controla los errores de petición
function handle_request_errors(request_result, prefix, token_session) {
    // Configuramos el mensaje
    let message = prefix;    
    // dependiendo del tipo de error que sea, lo manejamos para mostrarlo
    switch(request_result.statusCode){
        case 400:
            message += "La solicitud hacia la API está incorrectamente armada o fue rechazada: " + request_result.body;
            break;
        case 401:
            message += "Error de autenticación con la API de GLPI o Token de Session revocado. "
            // Si el token de sesion fue comunicado, lo concatenamos
            if(token_session) {
                // Concatenamos el token
                message += "Token de session rechazada: " + token_session + ". ";
            }                        
            break;
        case 404:
            message += "URL de GLPI incorrecta"
            break;
        case 500:
            message += "Error interno de servidor GLPI"
            break;
        default:
            message += "Error no especificado. Codigo de Navegación: " + request_result + ". Body: " + request_result.body; 
            break;
    }
    // Agregamos el body proveniente de la API de GLPI
    let response = JSON.parse(request_result.body);
    message += get_error_message_from_api(response);
    // Registramos el log
    log.Register(message);
}

// Funcion que procesa la fecha actual y devuelve una fecha formateada
function get_current_date_formatted_for_api(){
    // Obtenemos la fecha actual
    let current_date = new Date();
    // Particionamos la fecha en sus correspondientes
    let day = String(current_date.getDate()).padStart(2, '0');
    let month = String(current_date.getMonth() + 1).padStart(2, '0');
    let year = String(current_date.getFullYear()).padStart(4, '0');

    let hour = String(current_date.getHours()).padStart(2, '0');
    let minute = String(current_date.getMinutes()).padStart(2, '0');
    let second = String(current_date.getSeconds()).padStart(2, '0');

    // Devolvemos el valor de la fecha
    return year + "-" + month + "-" + day + " " + hour + ":" + minute + ":" + second;
}

// Función que controla el estado de código de la petición
function is_request_ok({statusCode}={}){
    if(statusCode == 200 || statusCode == 201){
        return true;
    } else {
        return false;
    }
}

// Cabeceras de ingreso sobre el sitio
function get_login_glpi_headers({base_64_auth} = {}){
    // Copiamos el header base
    let headers = GLPI_BASIC_HEADER;
    // Agregamos la contraseña
    headers.Authorization = "Basic " + base_64_auth;
    // Regresamos el valor procesado
    return headers;
}

// Valida si la autorización es correcto
function validate_auth({base64_auth} = {}) {
    // Convertimos la autorización a base 64
    var auth_string = Buffer.from(base64_auth, 'base64');
    // Averiguamos si la petición viene con dos puntos
    if(auth_string.includes(':')) {
        return true;
    } else {
        return false;
    }
}

// Desde el auth obtenemos el nombre de usuario
function get_user_by_auth({base64_auth} = {}) {
    // Hacemos conversión de Base64 a string
    let auth_string = Buffer.from(base64_auth, 'base64').toString('utf-8');
    // Dividimos el string usando el separador de dos puntos :
    let authorization_splitted = auth_string.split(":");
    // Devolvemos el usuario
    return authorization_splitted[0];
}

function get_token_headers({s_token} = {}){
    // Copiamos el header base
    let headers = GLPI_BASIC_HEADER;
    // Agregamos el token
    headers["Session-Token"] = s_token;
    // Devolvemos el valor procesado
    return headers;
}

function get_upload_headers({s_token} = {}){
    // Copiarmos el header para subidas de archivo
    let headers = GLPI_UPLOAD_HEADER;
    // Agregamos el token de subida de archivo
    headers["Session-Token"] = s_token;
    // Devolvemos el header procesado
    return headers;
}

function get_body_request_new_ticket({tkt_title, tkt_description, tkt_category, is_req } = {}){
    // Validamos si en la petición de generación de ticket se solicito
    var type = is_req == undefined || is_req == false ? 1 : 2;
    // Preparamos el body de envío para la generación de ticket
    let body = {
        input: {
            name: tkt_title,
            content: tkt_description,
            itilcategories_id: tkt_category,
            type: type
        }
    }
    // Devolvemos el objeto procesado en formato string
    return JSON.stringify(body);
}

function get_body_request_change_active_profile() {
    // Preparamos el body para enviar
    let body = {
        profiles_id: EMPLOYEE_PROFILE
    }
    // Devolvemos el body pasado a string
    return JSON.stringify(body);
}

// Body en formato string pasado desde JSON
function get_body_request_mego_modify_ticket({tkt_id} ={}){
    // Preparamos el cuerpo de la consulta
    let body = {
        input: {
            tickets_id: tkt_id,
            users_id: MEGO_GLPI_ID,
            type: 2,
            use_notification: 1,
            alternative_email: ""
        }
    }
    // Devolvemos el objeto body en string
    return JSON.stringify(body);
}

// Función dispuesta para que se pueda dar una solución a un ticket
function get_body_request_mego_set_solution({tkt_id} ={}){
    // Disponemos el body del elementos
    let body = {
        input: {
            itemtype: "Ticket",
            items_id: tkt_id,
            content: MEGO_CLOSE_TICKET_MESSAGE,
            users_id: MEGO_GLPI_ID
        }
    }
    // Devolvemos el body pasado a string
    return JSON.stringify(body);
}

// Funcion que prepara el cuerpo de petición para aprobar una solución
function get_body_request_mego_approve_solution({sol_id, user_id}){
    
    // Disponemos del body para poder prepara la respuesta
    let body = {
        input: {
            id: sol_id,
            date_approval: get_current_date_formatted_for_api(),
            users_id_approval: user_id,
            status: 3
        }
    }
    // Devolvemos el objeto procesado
    return JSON.stringify(body);
}

function get_body_request_user_approve_comment({tkt_id, user_id}={}){
    // Levantamos el body
    let body = {
        input: {
            items_id: tkt_id,
            itemtype: "Ticket",
            users_id: user_id,
            content: USER_CLOSE_TICKET_MESSAGE
        }
    }
    // Devolvemos el body en string
    return JSON.stringify(body);
}

function get_body_request_close_ticket({tkt_id} = {}){
    // Preparamos el body para devolver procesado
    let body = {
        input: {
            id: tkt_id,
            status: 6
        }
    }
    // Procesamos el body lo convertimos a string
    return JSON.stringify(body);
}

function get_body_request_workstation_add({tkt_id, wks_id} = {}){
    let body = {
        input: {
            itemtype: "Computer",
            items_id: wks_id,
            tickets_id: tkt_id
        }
    }
    return JSON.stringify(body);
}

function get_body_request_document_link({doc_id, tkt_id, usr_id} ={}){
    // Preparamos el body a regresar
    let body = {}
    // Cargamos los componentes
    body.input = {
        documents_id: doc_id,
        items_id: tkt_id,
        itemtype: "Ticket",
        users_id: usr_id
    }
    // Devolvemos el body procesado
    return JSON.stringify(body);
}

function get_formdata_request_upload_file({up_file, tkt_id} ={}){
    // Preparamos el formdata a devolver en el proceso
    let formData = {}
    // Cargamos la libreria de upload
    let upload = require('../upload')();
    // Cargamos el buffer del archivo a subir
    file_upload = upload.get_file_buffers_for_request_send({file_to_read: up_file});
    // Validamos si el proceso de obtención de buffer fue exitoso, chequeando el objeto
    if(file_upload){
        // Procedemos a cargar el formdata con la información
        formData["uploadManifest"] = '{"input" : {"name":"Documentar incidente ' + tkt_id + '", "_filename": "[' + file_upload.originalname + ']"}}';
        formData["type"] = "application/json";
        formData["filename[0]"] = { value: file_upload.buffer, options: {filename: file_upload.originalname}};
        // Devolvemos el formdata procesado
        return formData;
    } else {
        return new Error("No se pudo subir el archivo " + up_file.temporaryname + ", " + up_file.originalname);
    }
}

function ConnectGLPIUserAndGetSessionToken({base_64_authorization} = {}) {
    let ACTION_LOG = "CreateSessionToken - ";
    let ERROR_LOG = GLPI_ERROR_LOG_PREFIX + ACTION_LOG;
    // Preparamos una promesa que será regresada en el proceso
    var promise = new Promise((resolve, reject) => { 
        // Validamos que la clave haya sido enviada
        if(base_64_authorization == undefined) return reject("Error: La autorización no fué enviada.");
        // Validamos la autorización recibida
        if(validate_auth({base64_auth:base_64_authorization}) == false) return reject(log.Register(ERROR_LOG + "La autorización no cuenta con el formato adecuado"));
        // Preparamos la petición obteniendo cabeceras
        let headers = get_login_glpi_headers({ base_64_auth: base_64_authorization });
        // Realizamos el request
        request({
            uri: URL_INITSESSION,
            headers: headers,
            method: "GET"            
        }, (error, response, body_response) => {
            // Validamos si la petición llega con algún tipo de error
            if(error) return reject(log.Register(ERROR_LOG + error));
            // Validamos si la solicitud llega con estado 200
            if(response.statusCode == 200 || response.statusCode == 201) {              
                // Parseamos el cuerpo del body  
                body_response = JSON.parse(body_response);
                // Recolectamos el token
                let token = body_response.session_token;
                // Resolvemos la solicitud
                resolve(token);
            } else {
                return reject(handle_request_errors(response, ERROR_LOG));
            }
        });
    });
    // Devolvemos la promesa
    return promise;
}

// Cambiamos el perfil activo a empleado
function ChangeActiveProfileToEmployee({session_token} = {}){
    // Disponemos el prefijo para los logs
    let ACTION_LOG = "ChangeActiveProfile - ";
    let ERROR_LOG = GLPI_ERROR_LOG_PREFIX + ACTION_LOG;
    // Preparamos la promesa a devolver
    let promise = new Promise((resolve, reject) => {
        // Validamos si existe el token
        if(session_token == undefined) return reject(log.Register(ERROR_LOG + "El token no fue comunicado"));
        // Disponemos el header
        let headers = get_token_headers({s_token: session_token});
        // Preparamos el body
        let body = get_body_request_change_active_profile();
        // Ejecutamos el request
        request({
            url: URL_CHANGEACTIVEPROFILE,
            headers: headers,
            method: "POST",
            body: body
        }, (error, response, body_response) => {
            // Validamos si existen errores
            if(error) return reject(log.Register(ERROR_LOG + error));
            // Controlamos los estado de respuesta
            if(is_request_ok({statusCode: response.statusCode})){
                // Resolvemos el cambio
                resolve(true);
            } else {
                // Rechazamos la petición
                return reject(handle_request_errors(response, ERROR_LOG, session_token));
            }
        })

    });
    // Devolvemos la promesa procesada
    return promise;
}

function CreateTicketOnUserName({session_token, ticket_title, ticket_description, ticket_category, is_request } = {}){
    // Disponemos un prefijo para logs
    let ACTION_LOG = "CreateTicketToUser - ";
    let ERROR_LOG = GLPI_ERROR_LOG_PREFIX + ACTION_LOG;
    var promise = new Promise((resolve, reject) => {
        // Validamos si la petición viene con el token
        if(session_token == undefined) return reject(log.Register(ERROR_LOG + "El token no está comunicado"));
        // Validamos si todos los datos llegan con la información requerida
        if(ticket_title == undefined) return reject(log.Register(ERROR_LOG + "El titulo del ticket no está informado"));
        // Validamos descripcion
        if(ticket_description == undefined) return reject(log.Register(ERROR_LOG + "Esta faltando la descripcion del ticket"));
        // Validamos categoria
        if(ticket_category == undefined) return reject(log.Register(ERROR_LOG + "Esta faltando la categoria del ticket"));
        // Recolectamos el header
        let headers = get_token_headers({s_token: session_token});
        // Preparamos el body de la petición
        let body = get_body_request_new_ticket({tkt_title: ticket_title, tkt_description: ticket_description, tkt_category: ticket_category, is_req: is_request });
        // Ejecutamos la petición
        request({
            uri: URL_TICKET,
            headers: headers,
            method: "POST",
            body: body
        }, (error, response, body_response) => {
            // Validamos si tenemos algún error en la petición
            if(error) {                
                return reject(log.Register(ERROR_LOG + error));
            }
            // Validamos si la petición llega como 200
            if(response.statusCode == 200 || response.statusCode == 201) {
                // Parseamos en JSON la respuesta
                body_response = JSON.parse(body_response);
                // En primera instancia logueamos
                resolve(body_response.id);
            } else {                
                // Manejamos el error de petición utilizndo la función preparado
                return reject(handle_request_errors(response, ERROR_LOG));
            }
        });

    });
    // Validamos si esta cargado el token de session
    return promise;    
}

// Utilizando credenciales de MEGO, se suben archivos al sistema de tickets
// Si hay una falla en uno de los archivos que se debe subir, se continua con el siguiente archivo
function UploadFilesToGLPI ({session_token, files, ticket_id} ={}) {
    // Se disponen de las variable de logs
    let ACTION_LOG = "UploadFilesToGLPI - ";
    let ERROR_LOG = GLPI_ERROR_LOG_PREFIX + ACTION_LOG;
    // Preparamos una promesa que se devolvera al final del proceso
    let promise = new Promise((resolve, reject) => {
        // Validamos token y nombre de archivos
        if(session_token == undefined) return reject(log.Register(ERROR_LOG + "Falta token de session para proceder con la subida de archivos"));
        // Validamos si los nombres fueron comunicados
        if(files == undefined || files.length < 1) return reject(log.Register(ERROR_LOG + "No se ha comunicado nombres de archivos o se ha comunicado incorrectamente"));
        // Validamos que se haya comunicado el id de ticket
        if(ticket_id == undefined) return reject(log.Register(ERROR_LOG + "Falta el ID del Ticket para que pueda ser informado en la subida de archivos"));
        // Disponemos de los ID de las imagenes a vincular
        let document_id = [];
        // Cargamos los headers correspondientes
        let header = get_upload_headers({s_token: session_token});
        // Iteramos sobre todos los archivos a enviar
        for(let filesIndex = 0; filesIndex < files.length; filesIndex++){
            // Separamos por variable el archivo a subir
            let file = files[filesIndex];
            // Obtenemos el formdata para el archivo actual
            let formdata = get_formdata_request_upload_file({up_file: file, tkt_id: ticket_id});
            // Generamos la request con la información obtenida
            request({
                uri: URL_DOCUMENT_UPLOAD,
                method: "POST",
                headers: header,
                formData: formdata
            }, function(err, response, body)  {
                // Validamos si existen errores
                if(err) {
                    log.Register(ERROR_LOG + "Error subiendo " + file.originalname + " con nombre temporal " + file.temporaryname + ". Detalle: " + err.message);
                } else {
                    if(is_request_ok({statusCode: response.statusCode})) {
                        // Parseamos el objeto recibido
                        let document_json = JSON.parse(body);
                        // Pusheamos el id sobre el array de documentos
                        document_id.push(document_json.id);
                    } else {
                        // Informamos el error
                        handle_request_errors(response, ERROR_LOG, session_token);
                    }
                }
                // Si es la ultima iteración de todos los archivos, devolvemos como respuesta de la promesa los ID
                if(filesIndex + 1 == files.length) {
                    // Resolvemos con los ID obtenidos de las multiples solicitudes
                    resolve(document_id)
                }
            });
        }        

    });
    // Devolvemos la promesa
    return promise;
}

// Del ticket generado obtenemos el id de usuario
function GetGLPIUserIDByTicket({session_token, ticket_id} = {}) {
    // Generamos los elemetnos de logs
    let API_LOG = "GetGLPIUserIDTicket - ";
    let ERROR_LOG = GLPI_ERROR_LOG_PREFIX + API_LOG;
    // Generamos una nueva promise a devolver
    let promise = new Promise((resolve, reject) => {
        // Validamos si viene con el token
        if(session_token == undefined) return reject(log.Register(ERROR_LOG + "Falta token de sesion"));
        // Validamos si la información de ticket id viene cargada
        if(ticket_id == undefined) return reject(log.Register(ERROR_LOG + "Falta ID de ticket"));
        // Preparamos el header de conexión
        let headers = get_token_headers({s_token: session_token});
        // Realizamos el request usando los parametros indicados
        request({
            uri: URL_TICKET + "/" + ticket_id,
            method: 'GET',
            headers: headers
        }, (error, response, body_response) => {
            // Validamos si existe algún error
            if(error) return reject(log.Register(ERROR_LOG + "Error al procesar la solicitud: " + error));
            // Validamos si el codigo de estado es correcto
            if(is_request_ok({statusCode: response.statusCode})){
                // Parseamos el elemento recibido
                body_response = JSON.parse(body_response);
                // Damos por completada exitosamente la petición usando resolve
                resolve(body_response.users_id_recipient);
            } else {
                // Manejamos la respuesta negativa
                return reject(handle_request_errors(response, ERROR_LOG));
            }
        })
    });
    // Devolvemos la promesa
    return promise;
}

// Luego de subir los archivos y obtener los IDs de documentos como resultados
// Procedemos a vincular los documentos con el ticket generado
// Si hay error en alguna vinculación de un documento, se sigue con los restantes
function LinkDocumentsToTicket({session_token, ticket_id, documents_id, user_id} ={}){
    // Preparamos las constantes en caso de que exista algún error
    let ACTION_LOG = "LinkDocumentsToTicket - ";
    let ERROR_LOG = GLPI_ERROR_LOG_PREFIX + ACTION_LOG;
    // Preparamos la promesa a devolver
    let promise = new Promise((resolve, reject) => {
        // Validamos los campos solicitados
        if(session_token == undefined) return reject(log.Register(ERROR_LOG + "Está faltando el token de sesion para poder operar."));
        // Validamos si se informó ticket
        if(ticket_id == undefined) return reject(log.Register(ERROR_LOG + "No se comunicó ID de ticket."));
        // Validamos si vienen cargados ID de documentos
        if(documents_id == undefined || documents_id.length < 1) return reject(log.Register(ERROR_LOG + "Esta faltando los ID de documentos a vincular."));
        // Obtenemos la cabecera estandard de tickets
        let header = get_token_headers({s_token: session_token});
        // Iteramos sobre todos los documentos
        for(let documentIndex = 0; documentIndex < documents_id.length; documentIndex++){
            // Obtenemos el id del documento
            let document_id = documents_id[documentIndex];
            // Separamos el body de la solicitud
            let body = get_body_request_document_link({doc_id: document_id, tkt_id: ticket_id, usr_id: user_id});            
            // Ejecutamos la request
            request({
                url: URL_DOCUMENT_ITEM,
                method: "POST",
                headers: header,
                body: body
            }, (error, response, body) => {
                // Validamos si existen errores
                if(error) {
                    // Registramos el error a fin de tener datos
                    log.Register(ERROR_LOG + "Error vinculando documento ID " + document_id + ". Detalle: " + error.message);
                } else {
                    if(is_request_ok({statusCode: response.statusCode})){
                        // Parseamos el resultado
                        let link_result = JSON.parse(body);
                        // Verificamos la respuesta
                        if(!link_result.message.includes("agregado")){                            
                            log.Register(ERROR_LOG + "Error vinculando el documento " + document_id + ". Detalle: " + link_result.message);
                        }
                    } else {                        
                        handle_request_errors(response, ERROR_LOG, session_token);
                    }
                }
                // TODO hay que ver si por ser promise todo se maneja asincronamente, esta validacion es por esa duda
                if(documentIndex + 1 == documents_id.length){
                    // Proceso completado
                    resolve("Linkeo correcto")
                }
            })
        }
    });
    // Devolvemos la promesa procesada
    return promise;
}

// Con credenciales de MEGO, se realiza consulta en base a un nombre de usuario, obteniendo un ID de resultado
function GetGLPIUserID({session_token, auth} = {}){
    // Disponemos las opciones de LOG
    let ACTION_LOG = "GetGLPIUserID - ";
    let ERROR_LOG = GLPI_ERROR_LOG_PREFIX + ACTION_LOG;
    // Preparamos la promesa a procesar
    let promise = new Promise((resolve, reject) => { 
        // Validamos si el token fue comunicado -- En este caso el token de MEGO
        if(session_token == undefined) return reject(log.Register(ERROR_LOG + "Está faltando el token de sesion para poder operar"));
        // Validamos si el auth fue comunicado
        if(auth == undefined) return reject(log.Register(ERROR_LOG + "Falta la autorización del usuario para poder chequear el ID"));
        // Obtenemos el usuario desde el auth
        let username = get_user_by_auth({base64_auth: auth});
        // Preparamos el header para la solicitud
        let headers = get_token_headers({s_token: session_token});
        // Construimos la url con el nombre de usuario
        let url = URL_USERS + "?searchText[name]=" + username;        
        // Ejecutamos la request
        request({
            url: url,
            headers: headers,
            method: "get"
        }, (error, response, body_response) => { 
            // Validamos si viene algún error nativo en la libreria
            if(error) return reject(log.Register(ERROR_LOG + error));
            // Validamos si la petición vino con un estado correcto
            if(is_request_ok({statusCode: response.statusCode})) {
                // Convertimos la respuesta a JSON
                let users_json = JSON.parse(body_response);
                // Resolvemos la promesa con el id del usuario
                resolve(users_json[0].id);
            } else { 
                // Devolvemos el error procesado                
                return reject(handle_request_errors(response, ERROR_LOG, session_token));
            }
        })

    });
    // Devolvemos la promesa procesada
    return promise;
}

function KillSession({session_token} = {}){
   // Preparamos los datos de log en caso de error
   let ACTION_LOG = "KillSession - ";
   let ERROR_LOG = GLPI_ERROR_LOG_PREFIX + ACTION_LOG;
   // Preparamos la promesa
   let promise = new Promise((resolve, reject) => {
       // Validamos si el token llegó correctamente
       if(session_token == undefined) return reject(log.Register(ERROR_LOG + "No se ha comunicado el token de session"));
       // Preparamos el header de conexión
       let headers = get_token_headers({s_token: session_token});
       // Ejecutamos la request
       request({
           uri: URL_KILLSESSION,
           headers: headers
       }, (error, response, body_response) => {
           // Validamos si llega algún error en la respuesta
           if(error) return reject(log.Register(ERROR_LOG + error));
           // Controlamos los estados de codigo
           if(is_request_ok({statusCode: response.statusCode})){
               // Resolvemos la petición
               resolve(body_response);
           } else {
               return reject(handle_request_errors(response, ERROR_LOG, session_token));
           }
       })
   });
   // Devolvemos la promesa procesada
   return promise; 
}

// Obtenemos todas las ubicaciones cargadas
function GetLocations({session_token} = {}){
    // Definimos las variables de logs
    let ACTION_LOG = "GetLocations - ";
    let ERROR_LOG = GLPI_ERROR_LOG_PREFIX + ACTION_LOG;
    // Preparamos la promesa para devolver
    let promise = new Promise((resolve, reject) => {
        // Validamos si el token fue comunicado
        if(session_token == undefined) return reject(log.Register(ERROR_LOG + "No se comunico token de inicio de sesión."));
        // Obtenemos los headers para token
        let headers = get_token_headers({s_token: session_token});
        // Ejecutamos el request
        request({
            url: URL_LOCATIONS,
            headers: headers,
            method: 'GET'
        }, (error, response, body_response) => {
            // Validamos si viene con errores
            if(error) return reject(log.Register(ERROR_LOG + error));
            // Comprobamos que el estado recibido sea el correcto
            if(is_request_ok({statusCode: response.statusCode})) {
                // Parseamos las respuestas recibidas a formato JSON
                let locations_json = JSON.parse(body_response);
                // Para acumular las ubicaciones finales en devoluciones
                let locations_return = [];
                // Disponemos el array de ubicaciones
                locations_json.forEach(location => {
                    // Agregamos al objeto de devolución la ubicación
                    locations_return.push( location.completename );
                })
                // Devolvemos los grupos procesados
                resolve(locations_return);
            } else { 
                // Devolvemos el mensaje según la respuesta
                return reject(handle_request_errors(response, ERROR_LOG, session_token));
            }
        })
    });
    // Devolvemos la promesa
    return promise;
}

function GetWorkstations({session_token, user_id} ={}){
    // Definimos las variables de log
    let ACTION_LOG = "GetUserWorkstations - ";
    let ERROR_LOG = GLPI_ERROR_LOG_PREFIX + ACTION_LOG;
    // Preparamos una promesa para devolver
    let promise = new Promise((resolve, reject) => { 
        // Rechazamos la petición si no hay token
        if(session_token == undefined) return reject(log.Register(ERROR_LOG + "Falta indicar un token para realizar esta solicitud"));
        // Preparamos los headers de petición
        let headers = get_token_headers({s_token : session_token});
        // Disponemos del url de consulta para PC
        let url = URL_COMPUTER.replace("%user_id%", user_id);        
        // Ejecutamos el request
        request({ 
            url: url,
            headers: headers,
            method: 'GET'
        }, (error, response, body_response) => { 
            // Validamos que request no haya enviado error
            if(error) return reject(log.Register(ERROR_LOG + error));
            // Validamos el estado en el que haya llegado la respuesta
            if(is_request_ok({statusCode: response.statusCode})) { 
                // Parseamos a modo JSON la respuesta
                let computers_JSON = JSON.parse(body_response);
                // Disponemos un acumulador para guardar las computadoras
                let computers_result = [];                
                if(computers_JSON.hasOwnProperty('data')) {
                    // En la respuesta de la API, en el Key viaja el ID de la computadora
                    Object.keys(computers_JSON.data).forEach(computer_id => {                        
                        // Agregamos la PC al listado de equipos
                        computers_result.push({id: computer_id, name: computers_JSON.data[computer_id][COMPUTER_NAME_FIELD]});
                    });
                } // end if
                // Resolvemos con el array
                resolve(computers_result);
            } else { 
                // Rechazamos la petición
                return reject(handle_request_errors(response, ERROR_LOG, session_token));
            }
        });
    });
    // Devolvemos la promesa procesada
    return promise;
}

function SetWorkstationOnTicket({session_token, ticket_id, workstation_id} = {}){
    // Variables de LOG
    let ACTION_LOG = "PutWorkstationTicket - ";
    let ERROR_LOG = GLPI_ERROR_LOG_PREFIX + ACTION_LOG;
    // Prepramos la promesa a devolver
    let promise = new Promise((resolve, reject) => {
        // Rechazamos la promesa sobre campos obligatorios
        if(session_token == undefined) return reject(log.Register(ERROR_LOG + "No se comunicó el token de inicio de sesión."));
        if(ticket_id == undefined) return reject(log.Register(ERROR_LOG + "No se recibió número de ticket."));
        if(workstation_id == undefined) return reject(log.Register(ERROR_LOG + "No se indicó el ID de la estación de trabajo."));
                
        let headers = get_token_headers({s_token: session_token});
        let body = get_body_request_workstation_add({tkt_id: ticket_id, wks_id: workstation_id});
        
        request({ 
            url: URL_ITEM_TICKET,
            headers: headers,
            method: "POST",
            body: body
        },(error, response, body_response) => {
            if(error) return reject(log.Register(ERROR_LOG + " Request Error - " + error));

            if(is_request_ok({statusCode: response.statusCode})) {
                // Al estar ok la respuesta ya no es necesario realizar ninguna acción
                resolve(true);
            } else {
                return reject(handle_request_errors(response, ERROR_LOG, session_token));
            }
        });
    });
    // Devolvemos la promesa procesada
    return promise;
}

function GetGroupTicket({session_token, ticket_id} = {}) {
    // Definimos variables de log relacionada a la función
    let ACTION_LOG = "GetGroupTicket - ";
    let ERROR_LOG = GLPI_ERROR_LOG_PREFIX + ACTION_LOG;
    // Preparamos la promesa a procesar
    let promise = new Promise((resolve, reject) => {
        // Validamos que el token de session venga cargado
        if(session_token == undefined) return reject(log.Register(ERROR_LOG + "No se comunicó el token de inicio de sesion."));
        // Validamos que el ticket venga con id cargado
        if(ticket_id == undefined) return reject(log.Register(ERROR_LOG + "No se comunicó número de ticket para realizar la consulta."));
        // Preparamos los headers de consulta
        let headers = get_token_headers({s_token: session_token});
        // Preparamos la URL de consulta con parametros queryString
        let url = URL_GROUPTICKET + "?searchText[tickets_id]=" + ticket_id +"&searchText[type]=2&expand_dropdowns=true";        
        // Ejecutamos la consulta
        request({
            url: url,
            headers: headers,
            method: "GET"
        }, (error, response, body_response) => {
            // Validamos si existen errores
            if(error) return reject(log.Register(ERROR_LOG + error));
            // Validamos si la petición llego con el estado correcto
            if(is_request_ok({statusCode: response.statusCode})){
                // Parseamos el objeto como JSON
                body_response = JSON.parse(body_response);
                // Almacenamos una varible para los grupos
                let groups = [];
                // Iteramos sobre todos los resultados
                body_response.forEach(group => groups.push(group.groups_id));                
                // Resolvemos la petición con el objeto
                resolve(groups);
            } else { 
                // Devolvemos el error de mensaje procesado
                return reject(handle_request_errors(response, ERROR_LOG));
            }
        })
    });
    // Devolvemos la promesa procesada
    return promise;
}

function SetMegoOnTicket({session_token, ticket_id} = {}){
    // Preparamos las variables para los logs
    let ACTION_LOG = "SetMegoOnTicket - ";
    let ERROR_LOG = GLPI_ERROR_LOG_PREFIX + ACTION_LOG;
    // Generamos una nueva promesa para devolver en proceso
    let promise = new Promise((resolve, reject) => {
        // Validamos si el token de session fue cargado
        if(session_token == undefined) return reject(log.Register(ERROR_LOG + "El token de inicio de sesión no fue comunicado"));
        // Validamos el número de ticket
        if(ticket_id == undefined) return reject(log.Register(ERROR_LOG + "El número de ticket no fué comunicado"));
        // Preparamos la cabecera de conexión
        let headers = get_token_headers({s_token: session_token});
        // Preparamos el cuerpo de la solicitud
        let body = get_body_request_mego_modify_ticket({tkt_id: ticket_id});
        // Ejecutamos la solicitud a la web api
        request({
            url: URL_TICKETUSER,
            headers: headers,
            method: "POST",
            body: body
        }, (error, response, body_response) => {
            // Validamos si la petición llega con errores
            if(error) return reject(log.Register(ERROR_LOG + error));
            // Validamos el estado de respuesta
            if(is_request_ok({statusCode: response.statusCode})){
                // Damos por cerrado la promesa usando el resolve
                resolve(true);
            } else { // En caso de no ser el esperado
                return reject(handle_request_errors(response, ERROR_LOG));
            }
        });
        
    });
    // Devolvemos la promesa generada
    return promise;
}

function SetMegoSolutionAndGetSolutionID({session_token, ticket_id} = {}){
    // Preparamos las constantes de log
    let ACTION_LOG = "SetMegoSolution - ";
    let ERROR_LOG = GLPI_ERROR_LOG_PREFIX + ACTION_LOG;
    // Generamos un nueva promesa
    let promise = new Promise((resolve, reject) => {
        // Validamos si el token de Session fue cargado
        if(session_token == undefined) return reject(log.Register(ERROR_LOG + "Está faltando el token de session"));
        // Validamos si el ticket fue cargado
        if(ticket_id == undefined) return reject(log.Register(ERROR_LOG + "Es necesario el número de ticket para poder establecer solución"));
        // Preparamos los headers de petición
        let headers = get_token_headers({s_token: session_token});
        // Preparamos el body de la petición
        let body = get_body_request_mego_set_solution({tkt_id: ticket_id});
        // Realizamos la petición a la API
        request({
            url: URL_ITILSOLUTION,
            headers: headers,
            method: "POST",
            body: body
        }, (error, response, body_response) => {
            // Validamos si existe error en la petición
            if(error) return reject(log.Register(ERROR_LOG + error));
            // Controlamos el estado de codigo de la petición
            if(is_request_ok({statusCode: response.statusCode})) {
                // Parseamos el body
                body_response = JSON.parse(body_response);
                // Resolvemos con el body response
                resolve(body_response.id);
            } else {
                // En caso de fallar procedemos en esta instancia
                return reject(handle_request_errors(response, ERROR_LOG));
            }
        })
    });
    // Devolvemos la promesa
    return promise;
}

function ApproveMegoSolution({session_token, solution_id, user_id} = {}){
    // Disponemos de las constantes de LOG
    let ACTION_LOG = "ApproveMegoSolution - ";
    let ERROR_LOG = GLPI_ERROR_LOG_PREFIX + ACTION_LOG;
    // Preparamos la promesa a devolver
    let promise = new Promise((resolve, reject) => {
        // validamos los parametros de entrada
        if(session_token == undefined) return reject(log.Register(ERROR_LOG + "El token de session no fue informado."));
        // Validamos el número de ID de solucion
        if(solution_id == undefined) return reject(log.Register(ERROR_LOG + "Falta el ID de solución a actualizar"));
        // Validamos si el ID de usuario fue cargado
        if(user_id == undefined) return reject(log.Register(ERROR_LOG + "Falta el ID del usuario al cual habría que aprobar la solución"));
        // Preparamos las cabeceras de la petición
        let headers = get_token_headers({s_token: session_token});
        // Obtenemos el body
        let body = get_body_request_mego_approve_solution({sol_id: solution_id, user_id: user_id});        
        // Preparamos la request
        request({
            url: URL_ITILSOLUTION,
            headers: headers,
            method: "PUT",
            body: body
        }, (error, response, body_response) => {
            // Validamos si existen errores
            if(error) return reject(log.Register(ERROR_LOG + error));
            // Validamos los códigos de estado
            if(is_request_ok({statusCode: response.statusCode})){
                resolve(true);                
            } else {
                // Resolvemos el rechazo
                return reject(handle_request_errors(response, ERROR_LOG));
            }
        })

    });
    // Devolvemos la promesa preparada
    return promise;
}

function AddCommentApproveSolution({session_token, ticket_id, user_id} = {}){
    // Disponemos las constantes de logs
    let ACTION_LOG = "AddCommentApproveSolution - ";
    let ERROR_LOG = GLPI_ERROR_LOG_PREFIX + ACTION_LOG;
    // Preparamos la promesa
    let promise = new Promise((resolve, reject) => {
        // Validamos que el token haya sido cargado
        if(session_token == undefined) return reject(log.Register(ERROR_LOG + "Falta el token de sessión"));
        // Validamos que haya cargado el ID del ticket
        if(ticket_id == undefined) return reject(log.Register(ERROR_LOG + "Falta el número de ticket en la petición"));
        // Validamos que el usuario haya sido cargado
        if(user_id == undefined) return reject(log.Register(ERROR_LOG + "Falta el id del usuario"));
        // Generamos header
        let headers = get_token_headers({s_token: session_token});
        // Generamos el body con la información
        let body = get_body_request_user_approve_comment({tkt_id: ticket_id, user_id: user_id});
        // Mandamos la requests
        request({
            url: URL_ITILFOLLOWUP,
            headers: headers,
            method: "POST",
            body: body
        }, (error, response, body_response) => {
            // Validamos si existe error en la petición
            if(error) return reject(log.Register(ERROR_LOG + error));
            // Validamos el estado de respuesta
            if(is_request_ok({statusCode: response.statusCode})){
                // Si se llega a esta instancia la solicitud esta correcta
                resolve(true);
            } else {
                // Manejamos el evento de rechazo
                return reject(log.Register(handle_request_errors(response, ERROR_LOG)));                
            }
        })
    });
    // Devolvemos la promesa
    return promise;
}

function CloseTicketByMego({session_token, ticket_id}={}){
    // Preparamos las constantes para registrar los logs
    let ACTION_LOG = "CloseTicketByMego - ";
    let ERROR_LOG = GLPI_ERROR_LOG_PREFIX + ACTION_LOG;
    // Preparamos una promesa para devolver
    let promise = new Promise((resolve, reject) => {
        // Validamos si viene el token cargado
        if(session_token == undefined) return reject(log.Register(ERROR_LOG + "El token de session no viene cargado"));
        // Validamos si el id del ticket vino cargado
        if(ticket_id == undefined) return reject(log.Register(ERROR_LOG + "El ticket no fue informado"));
        // Obtenemos headers
        let headers = get_token_headers({s_token: session_token});
        // Obtenemos el body
        let body = get_body_request_close_ticket({tkt_id: ticket_id});
        // Enviamos el request
        request({
            url: URL_TICKET,
            headers: headers,
            method: "PUT",
            body: body
        }, (error, response, body_response) => {
            // Validamos si llega algun error
            if(error) return reject(log.Register(ERROR_LOG + error));
            // Validamos si el código de estado es correcto
            if(is_request_ok({statusCode: response.statusCode})){
                resolve(body_response);
            } else {
                // Rechazamos la petición informando el mensaje de error
                return reject(log.Register(handle_request_errors(response, ERROR_LOG)));
            }
        });

    });
    // Devolvemos la promesa procesada
    return promise;
}




module.exports = function({user_auth, tkt_title, tkt_description, tkt_category, is_req, workstation_id, files_to_upload} = {}) {
    // Validamos los parametros de entrada
    if(user_auth == undefined) return log.Register(GLPI_ERROR_LOG_PREFIX + "Para generar una instancia de módulo se necesita la autorización en formato usuario:clave en formato base64");
    // Almacenamos los datos de instancia
    this._user_auth = user_auth;
    this._ticket_title = tkt_title;
    this._ticket_description = tkt_description;
    this._ticket_category = tkt_category;
    this._ticket_request = is_req;
    this._workstation_id = workstation_id;
    this._files_to_upload = files_to_upload;
    
    //Creación de ticket y devolución de ID
    this._createTicketWithIDAndGroupInfo = function() {
        // Nos conectamos para obtener el token de GLPI
        return ConnectGLPIUserAndGetSessionToken({base_64_authorization: this._user_auth}).
        then(token_id => {
            // Guardamos el token
            this._token = token_id;
            // Llamamos a la instancia de generación de tickets
            return ChangeActiveProfileToEmployee({session_token: this._token});
            
        }).
        then(change_to_employee_success => {
            // Una vez cambiado a empleado ej
            return CreateTicketOnUserName({session_token: this._token, ticket_title: this._ticket_title, ticket_description: this._ticket_description, ticket_category: this._ticket_category, is_request: this._ticket_request});
        }).
        then(ticket_id => {
            this._ticket_id = ticket_id;
            // Generamos una solicitud para obtener el número de ID del usuario, que servira para otras solicitudes
            return GetGLPIUserIDByTicket({session_token: this._token, ticket_id: this._ticket_id});            
        }).
        then(user_id => {
            // Guardamos el ID del usuario
            this._user_id = user_id;
            // Preparamos las modificaciones de MEGO sobre GLPI, para lo cual vamos a iniciar session en GLPI
            return ConnectGLPIUserAndGetSessionToken({base_64_authorization: MEGO_AUTHORIZATION});
        }).
        then(token_mego => {
            // Guardamos el token de mego
            this._mego_token = token_mego;
                        
            // En caso de existir id, se carga, la solicitud no necesita viajar sincronicamente, asi que no la encadenamos con la secuencia de promesas
            if(this._workstation_id) {
                SetWorkstationOnTicket({session_token: this._mego_token, ticket_id: this._ticket_id, workstation_id: this._workstation_id});
            }
            // Realizamos una consulta sobre el ticket en cuestión para verificar si tiene grupos asignados.
            return GetGroupTicket({session_token: this._mego_token, ticket_id: this._ticket_id});
        })
        .then(assigned_groups => {
            // Guardamos los grupos en una variable
            this._assigned_groups = assigned_groups;
            // En la siguiente petición vamos a realizar una solicitud para registrar a Mego como modificador de tickets
            return SetMegoOnTicket({session_token: this._mego_token, ticket_id: this._ticket_id});
        })
        .catch(error => console.log(error));        
    }

    this._createTicketAndClose = function() {
        // Procesamos la generación de tickets normal
        return this._createTicketWithIDAndGroupInfo().
        then(normal_process_completed => {
            // Procedemos a cargar una solución
            return SetMegoSolutionAndGetSolutionID({session_token: this._mego_token, ticket_id: this._ticket_id});
        }).
        then(solution_id => {
            // Almacenamos el ID de solución
            this._solution_id = solution_id;
            // Procedemos a actualizar la solución
            return ApproveMegoSolution({session_token: this._mego_token, solution_id: this._solution_id, user_id: this._user_id});
        }).
        then(solution_approved => {
            // Aqui debemos generar un comentario del usuario sobre el FollowUp de GLPI, para dar credibilidad al cierre de ticket
            return AddCommentApproveSolution({session_token: this._mego_token, ticket_id: this._ticket_id, user_id: this._user_id});
        }).then(comment_succesfull_added => {
            // En ultima parte del proceso debemos dar cierre al ticket, utilizando la función API dispuesta procederemos
            return CloseTicketByMego({session_token: this._mego_token, ticket_id: this._ticket_id});
        })
        .then(ticket_successfull_closed => {
            // Al llegar aqui todas las secuencias del proceso han sido completadas correctamente.
        }).catch(error => console.log(error));
    }

    // Devuelve una promesa con todas las ubicaciones del usuario
    this._getAllUserLocations = function() {        
        return ConnectGLPIUserAndGetSessionToken({base_64_authorization: this._user_auth})
        .then(token_id => {
            this._token_id = token_id;
            // Cambiamos a perfil empleado
            return ChangeActiveProfileToEmployee({session_token: this._token_id});
        })
        .then(success => { 
            // Obtenemos las ubicaciones del usuario
            return GetLocations({session_token: this._token_id});
        })
        .catch(error => console.log(error));
    }

    // Devuelve una promesa con todas las máquinas del usuario
    this._getAllWorkstations =  function() {
        // Conectamos a GLPI usando credenciales de MEGO
        return ConnectGLPIUserAndGetSessionToken({base_64_authorization: MEGO_AUTHORIZATION})
        .then(token_id => {
            this._mego_token = token_id;            
            // Obtenemos el ID de usuario basado en autorización
            return GetGLPIUserID({session_token: this._mego_token, auth: this._user_auth});
        }).then(user_id => { 
            // Obtenemos las máquinas en base al ID
            return GetWorkstations({session_token: this._mego_token, user_id: user_id})
        }).catch(error => console.log(error));
    }

    this._clean_instance = function(){        
        // Validamos si el token de mego viene cargado con información
        if(this._mego_token){
            // Matamos la sessión del token en la API
            KillSession({session_token: this._mego_token}).catch(); // En caso de error el log registrara esta falla );
            // Destruimos la variable de session
            delete this["_mego_token"];
        }    
        // Validamos si hay token de usuario guardado
        if(this._token){
            // Ejecutamos la función para terminar la sesión
            // TODO: Revisar por que motivo la sessión de token del usuario está finalizada sin haber llamado a KillSession antes
            // KillSession({session_token: this._token}).then(success => console.log("Session de mego matada")).catch(error => console.log(error));
            // Destruimos el token almacenado en la variable de instancia
            delete this["_token"];            
        }        
    }

    // Método público dispuesto para obtener un ticket nuevo y los grupos asignados
    this.CreateTicketAndRetrieveIDAndGroups = async() =>{
        // Ejecutamos las validaciones de campos, deben estar cargados titulo, descripcion y categoria para crear un ticket
        if(this._ticket_title == undefined) return log.Register(GLPI_ERROR_LOG_PREFIX + "Para generar una instancia de módulo se necesita el título de ticket");
        if(this._ticket_description == undefined) return log.Register(GLPI_ERROR_LOG_PREFIX + "Para generar una instancia de módulo se necesita la descripción del ticket");
        if(this._ticket_category == undefined) return log.Register(GLPI_ERROR_LOG_PREFIX + "Para generar una instancia de módulo se necesita la categoria del ticket");
        // Preparamos las variables a devolver en el proceso
        let ticket_info = {};
        // Procesamos por los métodos del módulo la solicitud de API
        await this._createTicketWithIDAndGroupInfo().then(success => {
            // En petición exitosa guardamos las variables
            ticket_info.id = this._ticket_id;
            ticket_info.groups = this._assigned_groups;
        }).catch(error => {
            return log.Register(GLPI_ERROR_LOG_PREFIX + "Error al procesar el ticket nuevo. Verificar log de sistema para obtener más información.");
        });
        // Limpiamos instancia
        this._clean_instance();
        // Se devuelve la información del ticket solicitada
        return ticket_info;
    }

    this.CreateTicketAndClose = async() => {
        // Ejecutamos las validaciones de campos, deben estar cargados titulo, descripcion y categoria para crear un ticket
        if(this._ticket_title == undefined) return log.Register(GLPI_ERROR_LOG_PREFIX + "Para generar una instancia de módulo se necesita el título de ticket");
        if(this._ticket_description == undefined) return log.Register(GLPI_ERROR_LOG_PREFIX + "Para generar una instancia de módulo se necesita la descripción del ticket");
        if(this._ticket_category == undefined) return log.Register(GLPI_ERROR_LOG_PREFIX + "Para generar una instancia de módulo se necesita la categoria del ticket");        
        // Preparamos las variables de ticket a informar
        let ticket_info = {};
        // Ejecutamos la solicitud utilizando los métodos de la API
        await this._createTicketAndClose().then(success => {
            // Almacenamos el ID resultante del proceso
            ticket_info.id = this._ticket_id;
        }).catch(error => {            
            return log.Register(GLPI_ERROR_LOG_PREFIX + "Error al procesar el ticket nuevo. Verificar log de sistema para obtener más información.");
        });
        // Limpiamos instancia
        this._clean_instance();
        // Devolvemos el valor del ticket
        return ticket_info;
    }

    // Método público que devuelve un listado de ubicaciones a las cuales el usuario tiene acceso
    this.GetAllUsersLocations = async() => {
        // Variable que se devolverá al final del proceso
        let user_locations = [];
        // Ejecutamos la función asincrónica esperando la respuesta
        await this._getAllUserLocations()
        .then(locs => user_locations = locs)
        .catch(error => { return log.Register(GLPI_ERROR_LOG_PREFIX + "Error al obtener el listado de ubicaciones. Verfiicar log para mas información.")} );
        // Limpiamos instancia
        this._clean_instance();
        // Devolvemos la variable procesada
        return user_locations;
    }

    this.GetUsersWorkstation = async () => {
        // Preparamos el listado de máquinas a procesar
        let workstations = [];
        // Ejecutamos la solicitud a GLPi y esperamos la respuesta
        await this._getAllWorkstations()
        .then(ws => workstations = ws)
        .catch(error => {return log.Register(GLPI_ERROR_LOG_PREFIX + "Error al obtener los equipos del usuario")});        
        // limpiamos las instancias
        this._clean_instance();
        // Devolvemos el listado de máquinas procesadas
        return workstations;
    }
    return this;
}

// UploadFilesToGLPI({session_token: "797l0jpikjbc83mph4av3csse4", files:[
//     {originalname: "imagen.png", temporaryname: "UPLOAD000003.png"},
//     {originalname: "texto.txt", temporaryname: "UPLOAD000001.txt"},
//     {originalname: "documento.pdf", temporaryname: "UPLOAD000002.pdf"}
// ], ticket_id: 296 } ).then(doc_ids => console.log(doc_ids));

// LinkDocumentsToTicket({session_token: "797l0jpikjbc83mph4av3csse4", ticket_id: 296, documents_id: [56, 57, 58], user_id: 9}).then(respuesta => {
//     console.log(respuesta);
// } )

// UploadFilesToGLPI({session_token: "797l0jpikjbc83mph4av3csse4", files:[
//     {originalname: "imagen.png", temporaryname: "UPLOAD000003.png"},
//     {originalname: "texto.txt", temporaryname: "UPLOAD000001.txt"},
//     {originalname: "documento.pdf", temporaryname: "UPLOAD000002.pdf"}
// ], ticket_id: 296 } ).then(doc_ids => console.log(doc_ids));

// Unit Test, locations
// GetLocations({session_token: "vv3ferjkajr81s9e32lp3f6dl4"}).then(locs => console.log(locs));



// Generamos un ticket
// GLPI.CreateTicketWithIDAndGroupInfo().then(success => {
//     console.log(GLPI._ticket_id, GLPI._assigned_groups);
// });

// GLPI.CreateTicketAndClose().then(success => {
//     console.log(GLPI._ticket_id, GLPI._groups);
// }).finally(function(){
//     GLPI._clean_instance();
// })

//module.exports =
// UNIT TESTINGS

// Conexion y obtener Token de conexión
// ConnectGLPIUserAndGetSessionToken({ base_64_authorization: MEGO_AUTHORIZATION}).
//    then(token => { console.log(token); } ).catch(err => console.log(err));

// KillSession({session_token: "nrgcqpvqc9l5b4b8dvban54ol0"}).then(respuesta => { console.log(respuesta) });

// CreateTicketOnUserName({ 
//     session_token: "kho0nbgh63rjfv24ukf439sm90", 
//     ticket_title: "No funciona Word", 
//     ticket_category: 8, 
//     ticket_description: "Tengo errores al operar con word"}).
//     then(newticket => console.log(newticket)).
//     catch(error => console.log(error));

// GetGLPIUserID({
//     session_token: "dcbnmbkngckjuig29b5u84ebb1",
//     ticket_id: 16
// }).then(userId => console.log(userId)).catch(error => console.log(error));

// GetGroupTicket({session_token: "1gilaro9v3hvjssjstlk20r8f0", ticket_id: 16}).then(response => console.log(response));

// SetMegoOnTicket({session_token: "1gilaro9v3hvjssjstlk20r8f0", ticket_id: 16}).then(response => console.log(response));

// SetMegoSolution({session_token: "1gilaro9v3hvjssjstlk20r8f0", ticket_id:16}).then(response => console.log(response));

// Exportamos los métodos que utilizarán las otras librerías al operar

// ApproveMegoSolution({session_token: "1gilaro9v3hvjssjstlk20r8f0", solution_id: 14, user_id: 36}).then(respuesta => console.log(respuesta));

// AddCommentApproveSolution({session_token: "1gilaro9v3hvjssjstlk20r8f0", ticket_id: 25, user_id: 36 }).then(result => console.log(result)).catch(error => console.log(error));

// CloseTicketByMego({session_token: "1gilaro9v3hvjssjstlk20r8f0", ticket_id: 16}).then(response => console.log(response));