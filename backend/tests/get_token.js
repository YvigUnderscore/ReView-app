const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'CHANGE_ME_IN_PROD_PLEASE';

const token = jwt.sign({ id: 1, email: 'admin@test.com', role: 'admin' }, JWT_SECRET);
console.log(token);
