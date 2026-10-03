const db = require('../models/db');

db.assertRemoteDatabaseConfiguration();
db.initDb()
  .then(async () => {
    console.log(`Hosted database schema is ready (${db.getDbType()}).`);
    await db.getClient().close();
  })
  .catch((error) => {
    console.error('Database setup failed:', error.message);
    process.exitCode = 1;
  });