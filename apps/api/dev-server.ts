import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, ".env.local") });

import handler from "./api/receipt/parse";

const app = express();
app.use(cors());

app.post("/api/receipt/parse", (req: any, res: any) => {
  handler(req, res);
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`API dev server running on http://localhost:${PORT}`);
});
