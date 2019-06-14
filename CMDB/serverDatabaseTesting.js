var express = require('express');
var app = express();

var CMDB = require('CMDB');

var machine = CMDB.GetByUser({username: "sebastian.arabito"}).then((resultados) => {
    console.log(resultados);
});

app.listen(2004);