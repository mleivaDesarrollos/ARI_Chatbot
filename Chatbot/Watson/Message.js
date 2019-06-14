// Cargamos la librería request
var request = require('request');
var log = require('../../Log');

// Definimos constanets
const predefined_welcome_message = [
    "Bienvenido, mi nombre es Ari, ¿En qué te ayudo $u?",
    "Hola, soy Ari y estoy para ayudarte. ¿Que estás necesitando $u?",
    "Hola $u, soy Ari ¿Te puedo ayudar en algo?"
];

const predefined_ticket_message = [
    "Se informa que el usuario está reportando lo siguiente:\n",
    "El usuario reporta el siguiente problema:\n",
    "Se reporta que el usuario está teniendo el siguiente inconveniente:\n",
]

// Cuando se solicitan los equipos asignados al usuario, se utiliza este mensaje como plantilla
const MESSAGE_SHOW_WORKSTATION = {
    type: "option",
    text: "¿Cual de estos equipos sería el que tiene el problema?",
    description: "Listado de equipos asignados"
}

// Plantilla de mensaje predefinida para mostrar las ubicaciones
const MESSAGE_SHOW_LOCATIONS = {
    type: "option",
    text: "¿Cual de estás ubicaciones sería donde estarías necesitando el servicio?",
    description: "Listado de ubicaciones"
}

// Cuando hay que se hacer carga de otra dirección que no sea las listadas
const OTHER_LOCATION = { description: "Otra dirección fuera del listado", value: "OTHER_LOCATION" };

const OTHER_WORKSTATION = { description: "Otro equipo fuera del listado", value: "OTHER_WS" };

const GET_TICKET_CONTEXT_DATA = "require_ticket";
const GET_WORKSTATION_NUMBER = "require_workstation";
const GET_REQUEST_ALL_USER_LOCATIONS = "require_user_locations";
const GET_TICKET_PLACEHOLDER = "TICKET_NUMBER";

const CONTEXT_CONVERSATION_ID = "conversation_id";
const CONTEXT_SYSTEM = "system";
const CONTEXT_REQUEST = "is_request";

var filter_message_by_type = function({ message } = {}) {
    // Preparamos el mensaje de respuesta
    var return_message = {}
        // Validamos por tipo de mensaje
    switch (message.response_type) {
        case "text":
            // Filtramos el mensaje recibdo
            return_message.type = "text";
            return_message.text = message.text;
            break;
        case "option":
            // generamos un acumulador de opciones
            var arrOptions = [];
            // Iteramos sobre todas las opciones que estan contenidas
            message.options.forEach(option => {
                // Filtramos las opciones
                var filteredOption = {
                        description: option.label,
                        value: option.value.input.text
                    }
                    // agregamos la opcion al listado
                arrOptions.push(filteredOption);
            });
            // Filtramos el mensaje
            return_message.text = message.title;
            // Validamos si el mensaje contiene description            
            if (message.description != undefined) return_message.description = message.description;
            return_message.type = "option";
            return_message.options = arrOptions;
            break;
        default:
            throw "WatsonMessage: Tipo de mensaje de respuesta no reconocido o no soportado";
    }
    // Devolvemos el mensaje
    return return_message;
}

var CheckTicketRequestAndGenerateTicketNumber = async({ caller_context, filtered_messages, authorization }) => {
    // Verificamos si Watson nos solicita tickets
    var require_ticket = caller_context.hasOwnProperty(GET_TICKET_CONTEXT_DATA);
    // Validamos si en la petición enviada llego un mensaje donde solicita ticket
    if (require_ticket) {
        // var MSC = require("../../Ticket/MSC");
        // Eliminamos la propiedad de requerimiento de ticket para no generar duplicados
        delete caller_context["require_ticket"];
        // Levantamos una variable que almacene el contenido del mensaje que será enviado al cliente
        var description = predefined_ticket_message[Math.floor(Math.random() * predefined_ticket_message.length)];
        // Disponemos una variable para el título
        var title;
        // Disponemos una variable para el código de categoría
        var category;
        // Disponemos una variable que este disponible en caso de solicitud
        var request;
        // Variable que se usará en caso de que venga un ID de terminal en contexto
        var terminal_id;
        // Iteramos sobre los elementos del contexto
        for (var property in caller_context) {
            // Validamos si la propiedad son las bases
            if (property == CONTEXT_CONVERSATION_ID || property == CONTEXT_SYSTEM || property == "require_ticket") {
                continue;
            }
            // Validamos si el tipo de problema viene cargado
            if (property.toLowerCase().includes("tipo_de_problema")) {
                // Guardamos el tipo de problema como si fuera el título del ticket
                title = caller_context[property];
            }
            // Validamos si el contexto presente corresponde al ID de terminal
            else if (property.toLowerCase().includes("terminal_id")) {
                terminal_id = caller_context[property];
            }
            // Validamos si en la iteración actual viene el id de Categoria
            else if (property.toLowerCase().includes("categoria")) {
                // Guardamos el contexto en la variable
                category = caller_context[property];
            } else if (property.toLowerCase().includes(CONTEXT_REQUEST)) {
                // Si la propiedad viene con valor true
                if (caller_context[property] == true) {
                    // En este caso necesitamos que el ticket se cargue como solicitud
                    request = true;
                }
            } else {
                // Preparamos la descripción del tipo de dato a agregar al ticket
                var label = property.replace(/_/g, " ");
                // Guardamos el dato que viene en la etiqueta
                var information = caller_context[property];
                // Almacenamos la información dentro del ticket
                description += "-" + label + " : " + information + "\n";
            }
        }
        // Dejamos un acumulador de numero de tickets
        var ticket = {};
        // Si todos los campos estan cargados
        if (description && title && category) {
            // Generamos un nuevo ticket usando GLPI
            var GLPIClass = require('../../Ticket/GLPI');
            // Instanciamos un nuevo objeto GLPI
            var GLPI = new GLPIClass({ user_auth: authorization, tkt_title: title, tkt_description: description, tkt_category: category, is_req: request, workstation_id: terminal_id });
            // Solicitamos la generación de tickets
            await GLPI.CreateTicketAndRetrieveIDAndGroups().then(ticket_result => {
                // Guardamos las variables recibidas
                ticket.id = ticket_result.id;
                ticket.groups = ticket_result.groups;
            }).catch(function() {
                ticket.id = "ERROR"
            });
        } else {
            // Informamos el error
            ticket.id = "ERROR";
            // Logueamos en sistema
            log.Register("Error - WatsonMessage - En el contexto está faltando la descripción, la categoria o el titulo.");
        }
        // // Generamos un nuevo ticket y aguardamos el resultado
        // await MSC.Get({ message_details: cliente_details }).then((ticketNumber) => 
        // { ticket_number = ticketNumber })
        // .catch((error) => {
        //     ticket_number = "ERROR"
        // });
        // Iteramos sobre los mensajes filtrados
        for (let i = 0; i < filtered_messages.length; i++) {
            // Iteramos hasta encontrar el mensaje con el placeholder del ticket
            if (filtered_messages[i].text.includes(GET_TICKET_PLACEHOLDER)) {
                // Guardamos el mensaje en una variable
                let message = filtered_messages[i];
                // Validamos si el mensaje llega en estado error
                if (ticket.id != "ERROR") {
                    // Preparamos el mensaje de reemplazo
                    let replace_info = ticket.id;
                    // Iteramos sobre los grupos que recibimos
                    if (ticket.groups != undefined && ticket.groups.length > 0) {
                        // Agregamos la info del grupo
                        replace_info += " y esta asignado a ";
                        // Validamos si es mas de un grupo
                        if (ticket.groups.length > 1) {
                            replace_info += "los grupos ";
                        } else {
                            replace_info += "el grupo ";
                        }
                        for (let i = 0; i < ticket.groups.length; i++) {
                            // Validamos si llegamos al final del recorrido de grupos
                            if (i + 1 < ticket.groups.length - 1) {
                                // Cuando hay mas grupos para agregar agregamos una coma
                                replace_info += ticket.groups[i] + ", ";
                            } else if (i + 1 == ticket.groups.length - 1) {
                                // Cuando queda un grupo más por mostrar
                                replace_info += ticket.groups[i] + " y ";
                            } else {
                                // Cuando es el ultimo o unico grupo
                                replace_info += ticket.groups[i];
                            }
                        }
                    }
                    // Una vez encontrado, reemplazamos el texto con el ticket encontrado
                    message.text = message.text.replace(GET_TICKET_PLACEHOLDER, replace_info);
                } else {
                    message.text = "Lamentablemente el sistema de tickets actualmente no está funcionando. Intenta nuevamente mas tarde.";
                }
                // Reemplazamos el elemento del array en la ubicación
                filtered_messages[i] = message;
            }
        }
    }
    // Retornamos los mensajes filtrados con el reemplazo hecho sobre el array de mensajes que recibimos por parametro
    return {
        messages: filtered_messages,
        context: caller_context
    };
}

var CheckWorkstationRequirementAndRetrieveMessageWithWorkstationList = async({ caller_context, authorization, filtered_messages }) => {
    var require_workstation = caller_context.hasOwnProperty(GET_WORKSTATION_NUMBER);
    // Si dentro de las variables de contexto llega la información de que se necesita el equipo, agregamos un mensaje adicional al listado de mensajes
    if (require_workstation) {
        // Definimos un array de elementos que contendrá los equipos consultados
        var arrWorkstations = [];
        var arrOptions = [];
        // // Cargamos la libreria de CMDB
        // var CMDB = require('../../CMDB/CMDB');        
        // // Almacenamos los equipos en el array
        // await CMDB.GetByUser({ username: username }).then((workstation) => arrWorkstations = workstation);
        // Cargamos la librería de GLPI
        let GLPIClass = require('../../Ticket/GLPI');
        // Instanciamos un nuevo objeto GLPI
        let GLPI = new GLPIClass({ user_auth: authorization });
        // Traemos los equipos relacionados a este usuario
        await GLPI.GetUsersWorkstation().then(ws => arrWorkstations = ws);
        // Duplicamos la instancia de solicitud de mensaje para workstation
        var message_with_workstations = MESSAGE_SHOW_WORKSTATION;
        // Definimos que el mensaje viaja con propiedad workstation_select en true
        message_with_workstations.workstation_select = true;
        // Iteramos sobre todos los elementos del array obtenido para guardarlo en formato adecuado
        arrWorkstations.forEach(workstation => {
            // Agregamos la opcion
            var option = {
                    description: workstation.name,
                    value: workstation.id
                }
                // Anexamos la opción al array de opciones
            arrOptions.push(option);
        });
        // Agregamos la opcion de que se trate de un equipo fuera del listado asignado del usuario
        arrOptions.push(OTHER_WORKSTATION);
        // Guardamos las opciones en el objeto clonado
        message_with_workstations.options = arrOptions;
        // Empujamos el mensaje filtrado al arrMessages
        filtered_messages.push(message_with_workstations);
    }
    // Devolvemos el listado de mensajes procesados
    return filtered_messages;
}

var retrieveUserLocationListOnContextRequest = async({ caller_context, authorization, filtered_messages }) => {
    // Verificamos si existe la propiedad que se dispone para pedir todas las ubicaciones
    let require_user_locations = caller_context.hasOwnProperty(GET_REQUEST_ALL_USER_LOCATIONS);
    // Validamos si está definido esta variable, para proceder a contactar a la herramienta de tickets para pedir ubicaciones
    if (require_user_locations) {
        // Eliminamos la propiedad para que en proximas solicitudes no vuelva a ingresar
        delete caller_context[GET_REQUEST_ALL_USER_LOCATIONS];
        // Disponemos de la variable de ubicaciones
        let user_locs = [];
        // Generamos una nueva instancia de clase GLPI requiriendo la libreria
        let GLPIClass = require('../../Ticket/GLPI');
        // Generamos una nueva instancia de clase para hacer uso de los metodos del módulo
        let GLPI = new GLPIClass({ user_auth: authorization });
        // Disponemos el array donde guardaremos las opciones procesadas
        let options_for_message = [];
        // Generamos la solicitud esperando a que finalice
        await GLPI.GetAllUsersLocations().then(locs => {
            user_locs = locs;
        });
        // Hacemos una copia del template de mensaje de tipo opcion con ubicaciones
        let message_with_locations = MESSAGE_SHOW_LOCATIONS;
        // Iteramos sobre las ubicaciones que nos devolvió GLPI
        user_locs.forEach(location => {
            // Generamos una nueva opción
            let option = {
                description: location,
                value: location
            };
            // Agregamos las opciones al listado
            options_for_message.push(option);
        });
        // Para dejar al usuario la posibilidad de cargue una ubicación fuera del listado
        options_for_message.push(OTHER_LOCATION);
        // Agregamos las opciones
        message_with_locations.options = options_for_message;
        // Agregamos el mensaje al listado de mensajes filtrados
        filtered_messages.push(message_with_locations);
    }
    // Devolvemos todos los mensajes filtrados
    return {
        context: caller_context,
        messages: filtered_messages
    }
}

var CheckUserSendingAddressAndSaveOnContext = function({ caller_context, address_to_send }) {
    // Validamos si el usuario esta en tareas de envio de direccion
    if (caller_context.sending_address) {
        // Guardamos la variable de contexto para que la visualice watson
        caller_context.Direccion_donde_esta_el_equipo = address_to_send;
        // Eliminamos la propiedad proveniente del cliente
        delete caller_context.sending_address;
    }
    // Devolvemos el valor procesado
    return caller_context;
}

var CheckAndRestartChat = function({ caller_context }) {
    // Validamos si en en el contexto viaja la reinicialización del chat
    if (caller_context.restart_chat) {
        // Iteramos sobre todas las propiedades guardadas
        for (property in caller_context) {
            // Validamos si son las propiedades básicas de watson
            if (property == CONTEXT_CONVERSATION_ID || property == CONTEXT_SYSTEM) {
                continue;
            }
            // Llegando a esta instancia, significa que estas propiedades pueden ser eliminadas
            delete caller_context[property];
        }
    }
    // Devolvemos el valor procesado
    return caller_context;
}

// Disponemos el método para obtener la información
var getData = function(messageToConvert, context) {
    var body = {
        input: {
            text: messageToConvert
        },
        context: context
    };
    // Devolvemos el string procesado y convertido a string
    return JSON.stringify(body);
}

// Función que manejaría la interacción con la ticketera, obteniendo un ticket en el proceso
// Se debe formatear la información obtenida en el chat. La información debería venir del chat. Habria que almacenar todo lo relevante a la conversación con el bot.
// Este número de ticket se enviara a Watson para que procese un mensaje tomando la variable de contexto que le enviaremos
// Una de los posibles formateos debería ser : detectar en los intents si se inicio por microinformatica, infraestructura, o administrativo
// Este mensaje se enviará al cliente como respuesta. El mensaje debe enviarlo la funcion mensaje

module.exports = function({ param_workspace, param_version, param_headers, param_username, param_firstname, param_fullname, param_auth } = {}) {
    // Validamos si la información viene cargada correctamente
    if (param_workspace == undefined || param_version == undefined) throw 'No es posible generar instancia de mensaje sin Workspace y Version';
    // Almacenamos los elementos en sus correspondientes ubicaciones
    this._workspace = param_workspace;
    this._version = param_version;
    this._headers = param_headers;
    this._username = param_username;
    this._firstname = param_firstname;
    this._fullname = param_fullname;
    this._auth = param_auth;
    // Método que controla los mensajes
    this.message = function({ userInput, context } = {}) {
        // Configuramos el URI para poder realizar las consultas a la API
        const URI = "https://gateway.watsonplatform.net/assistant/api/v1/workspaces/" + this._workspace + "/message?version=" + this._version;
        // Definimos método        
        const METHOD = "POST";
        var promise = new Promise(async(resolve, reject) => {
            // Validamos si el mensaje viene vacio
            if (userInput != '' && userInput != undefined) {
                // Validamos si la solicitud viaja con la terminal
                if (context != undefined) {
                    // Validamos si el usuario está enviando las direcciones
                    context = CheckUserSendingAddressAndSaveOnContext({ caller_context: context, address_to_send: userInput });
                }
                // Ejecutamos la petición de envío de mensajes
                request({
                    headers: this._headers,
                    uri: URI,
                    method: METHOD,
                    body: getData(userInput, context)
                }, async(err, response, watsonResponse) => {
                    // Validamos si la petición viene con errores
                    if (err) {
                        return reject("Error: Se ha producido un error al enviar mensaje: " + err);
                    }
                    // Parseamos la respuesta
                    watsonResponse = JSON.parse(watsonResponse);
                    // Si pasamos la fase de validación en primera instancia logueamos lo obtenido
                    var processed_response = {};
                    var arrMessages = [];
                    // Levantamos todos los mensajes recibidos de respuesta
                    var messages = watsonResponse.output.generic;
                    var context = watsonResponse.context;
                    // Iteramos sobre todos los mensajes
                    messages.forEach(_message => {
                        try {
                            // Filtramos el mensaje
                            var filtered_message = filter_message_by_type({ message: _message });
                            // Agregamos el mensaje filtrado
                            arrMessages.push(filtered_message);
                        } catch (error) {
                            // Si hay errores en la consulta se muestra en consola
                            console.error(error);
                        }
                    });
                    // Agregamos los mensajes filtrados y el contexto a la respuesta procesada
                    processed_response.messages = arrMessages;
                    processed_response.context = context;
                    // Validamos si dentro del contexto llega una solicitud de ticket
                    processed_response = await CheckTicketRequestAndGenerateTicketNumber({ caller_context: context, username: this._username, fullname: this._fullname, filtered_messages: arrMessages, authorization: this._auth });
                    // Validamos si dentro del contexto llega una solicitud
                    processed_response = await CheckWorkstationRequirementAndRetrieveMessageWithWorkstationList({ caller_context: context, authorization: this._auth, filtered_messages: arrMessages });
                    // Validamos si dentro del contexto llega una solicitud pidiendo todas las ubicaciones del usuario
                    processed_response = await retrieveUserLocationListOnContextRequest({ caller_context: context, authorization: this._auth, filtered_messages: arrMessages });
                    // Validamos si la solicitud tiene un requerimiento de reinicio
                    context = CheckAndRestartChat({ caller_context: context });
                    // Resolvemos la promise                
                    resolve(processed_response);
                });
            } else { // Si no hay mensaje enviado por el usuario, se considera como solicitud de inicio de interaccion, 
                // para lo cual en vez de solicitar a watson un saludo y consumir un API innecesario enviamos una respuesta predefinida
                // Generamos un saludo random                
                var msg = predefined_welcome_message[Math.floor(Math.random() * predefined_welcome_message.length)];
                // Cambiamos el placeholder de usuario por el nombre comunicado
                // Validamos si el usuario vino cargado con la solicitud     
                if (this._firstname != undefined) {
                    msg = msg.replace("$u", this._firstname);
                } else { // Si no vino cargado reemplazamos el comodin
                    msg = msg.replace(" $u", "");
                }
                // Preparamos el objeto JSON para enviar
                var finalMessage = {
                        messages: [{ type: "text", text: msg }]
                    }
                    // Resolvemos con contenido del mensaje
                resolve(finalMessage);
            }
        });
        return promise;
    }
}