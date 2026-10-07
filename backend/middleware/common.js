export const logger = (req, res, next) => {
  const start = Date.now();
  res.on("finish", () =>
    console.log(`${new Date().toISOString()} ${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`)
  );
  next();
};

export const notFound = (req, res) =>
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });

export const errorHandler = (err, req, res, next) => {
  let status = err.status || 500;
  let message = err.message || "Internal server error";
  if (err.type === "entity.parse.failed") { status = 400; message = "Invalid JSON body"; }
  else if (err.name === "ValidationError") { status = 400; }
  else if (err.code === 11000) { status = 409; message = "Duplicate value"; }
  if (status === 500) console.error(err);
  res.status(status).json({ success: false, message });
};
