const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./docs/swagger');
const routes = require('./routes');

const app = express();

// body parser
app.use(express.json());

// CORS básico (teu middleware)
app.use(function(req, res, next){
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  res.setHeader("Access-Control-Allow-Credentials", true);
  next();
});

// rotas da API
app.use('/', routes);

// docs Swagger
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.listen(8080, function () {
  console.log('Aplicação executando na porta 8080! Docs em http://localhost:8080/docs');
});
