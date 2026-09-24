const { ValidationError } = require('../../errors');

function validateRequest(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message
      }));
      return next(new ValidationError(details));
    }
    req.body = result.data;
    next();
  };
}

module.exports = validateRequest;
