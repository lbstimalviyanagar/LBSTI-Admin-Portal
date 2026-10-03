function errorHandler(err, req, res, next) {
  console.error('[SERVER ERROR]', err);
  const status = err.status || err.statusCode || 500;
  const message = status >= 500
    ? 'An unexpected error occurred on the server.'
    : (err.message || 'The request could not be completed.');
  
  res.status(status).json({
    ok: false,
    message,
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {})
  });
}

module.exports = errorHandler;
