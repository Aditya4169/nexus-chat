const jwt = require('jsonwebtoken');

const authMiddleware = (request, response, next) => {
  const authorizationHeader = request.headers.authorization;
  const [scheme, token] = authorizationHeader ? authorizationHeader.split(' ') : [];

  if (scheme !== 'Bearer' || !token) {
    return response.status(401).json({ message: 'Authentication token is required.' });
  }

  try {
    request.user = jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch (_error) {
    return response.status(401).json({ message: 'Invalid or expired authentication token.' });
  }
};

module.exports = authMiddleware;
