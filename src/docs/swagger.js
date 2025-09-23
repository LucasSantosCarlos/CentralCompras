// src/docs/swagger.js
const swaggerJSDoc = require('swagger-jsdoc');

const options = {
    definition: {
        openapi: '3.0.3',
        info: {
            title: 'CentralCompras API',
            version: '1.0.0',
            description: 'API documentada com OpenAPI 3.0',
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
                },
                Supplier: {
                    type: 'object',
                    properties: {
                        id: { type: 'string' },
                        supplier_name: { type: 'string' },
                        supplier_category: { type: 'string' },
                        contact_email: { type: 'string', format: 'email' },
                        phone_number: { type: 'string', description: 'Apenas dígitos' },
                        status: { type: 'string', enum: ['on', 'off'] }
                    },
                    required: ['id', 'supplier_name', 'contact_email', 'status'],
                    example: {
                        id: '7a6cc128-2c5f-6ec0-235a-cd2bfa780145',
                        supplier_name: 'Judite Heeler',
                        supplier_category: 'Informatica, Segurança',
                        contact_email: 'j.heeler@gmail.com',
                        phone_number: '4896965858',
                        status: 'on'
                    }
                },
                SupplierCreate: {
                    type: 'object',
                    properties: {
                        supplier_name: { type: 'string' },
                        supplier_category: { type: 'string' },
                        contact_email: { type: 'string', format: 'email' },
                        phone_number: { type: 'string' },
                        status: { type: 'string', enum: ['on', 'off'] }
                    },
                    required: ['supplier_name', 'contact_email'],
                    example: {
                        supplier_name: 'Judite Heeler',
                        supplier_category: 'Informatica, Segurança',
                        contact_email: 'j.heeler@gmail.com',
                        phone_number: '48 9696 5858',
                        status: 'on'
                    }
                },
                SupplierUpdate: {
                    type: 'object',
                    properties: {
                        supplier_name: { type: 'string' },
                        supplier_category: { type: 'string' },
                        contact_email: { type: 'string', format: 'email' },
                        phone_number: { type: 'string' },
                        status: { type: 'string', enum: ['on', 'off'] }
                    }
                },
                Store: {
                    type: 'object',
                    properties: {
                        id: { type: 'string' },
                        store_name: { type: 'string' },
                        cnpj: { type: 'string' },
                        address: { type: 'string' },
                        phone_number: { type: 'string' },
                        contact_email: { type: 'string', format: 'email' },
                        status: { type: 'string', enum: ['on', 'off'] }
                    },
                    required: ['id', 'store_name', 'cnpj', 'contact_email', 'status'],
                },
                StoreCreate: {
                    type: 'object',
                    properties: {
                        store_name: { type: 'string' },
                        cnpj: { type: 'string' },
                        address: { type: 'string' },
                        phone_number: { type: 'string' },
                        contact_email: { type: 'string', format: 'email' },
                        status: { type: 'string', enum: ['on', 'off'] }
                    },
                    required: ['store_name', 'cnpj', 'contact_email'],
                },
                StoreUpdate: {
                    type: 'object',
                    properties: {
                        store_name: { type: 'string' },
                        cnpj: { type: 'string' },
                        address: { type: 'string' },
                        phone_number: { type: 'string' },
                        contact_email: { type: 'string', format: 'email' },
                        status: { type: 'string', enum: ['on', 'off'] }
                    }
                }
            }
        }
    },
    // Vai ler as anotações JSDoc nas rotas
    apis: ['src/routes/*.js'],
};

module.exports = swaggerJSDoc(options);
