// src/docs/swagger.js
const swaggerJSDoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'CentralCompras API',
      version: '1.0.0',
      description: 'API de usuários (CRUD + login) documentada com OpenAPI 3.0',
    },
    servers: [
      { url: 'http://localhost:8080', description: 'Local' }
    ],
    components: {
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            contact_email: { type: 'string', format: 'email' },
            user: { type: 'string' },
            level: { type: 'string', enum: ['admin', 'user'] },
            status: { type: 'string', enum: ['on', 'off'] }
          },
          required: ['id', 'name', 'contact_email', 'user', 'level', 'status'],
          example: {
            id: '3e8c4b64-0c03-46b6-8a88-0e6b8ef0a3a9',
            name: 'Maria Oliveira',
            contact_email: 'maria.oliveira@unesc.net',
            user: 'mariaoliveira',
            level: 'user',
            status: 'on'
          }
        },
        UserCreate: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            contact_email: { type: 'string', format: 'email' },
            user: { type: 'string' },
            pwd: { type: 'string', description: 'senha em texto; será salva como hash' },
            level: { type: 'string', enum: ['admin', 'user'] },
            status: { type: 'string', enum: ['on', 'off'] }
          },
          required: ['name', 'contact_email', 'user', 'pwd'],
          example: {
            name: 'Maria Oliveira',
            contact_email: 'maria.oliveira@unesc.net',
            user: 'mariaoliveira',
            pwd: 'senhaSecreta!',
            level: 'user',
            status: 'on'
          }
        },
        UserUpdate: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            contact_email: { type: 'string', format: 'email' },
            user: { type: 'string' },
            pwd: { type: 'string' },
            level: { type: 'string', enum: ['admin', 'user'] },
            status: { type: 'string', enum: ['on', 'off'] }
          }
        },
        LoginRequest: {
          type: 'object',
          properties: {
            user: { type: 'string' },
            pwd: { type: 'string' }
          },
          required: ['user', 'pwd'],
          example: { user: 'mariaoliveira', pwd: 'senhaSecreta!' }
        },
        LoginResponse: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            user: { $ref: '#/components/schemas/User' }
          },
          example: {
            message: 'ok',
            user: {
              id: '3e8c4b64-0c03-46b6-8a88-0e6b8ef0a3a9',
              name: 'Maria Oliveira',
              contact_email: 'maria.oliveira@unesc.net',
              user: 'mariaoliveira',
              level: 'user',
              status: 'on'
            }
          }
        }
      }
    }
  },
  // Vai ler as anotações JSDoc nas rotas
  apis: ['src/routes/*.js'],
};

module.exports = swaggerJSDoc(options);
