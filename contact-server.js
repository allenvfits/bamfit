require('dotenv').config();
const app = require('./server');
const PORT = Number(process.env.PORT || 4000);

if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => console.log(`BAM FIT API running on port ${PORT}`));
}

module.exports = app;
