require("dotenv").config();
const { createServer } = require("./src/app");

const PORT = process.env.PORT || 3000;
const app = createServer();

app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});
